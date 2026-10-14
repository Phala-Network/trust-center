import {
  appsTable,
  eq,
  profilesTable,
  syncEventsTable,
} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {afterAll, beforeEach, describe, expect, test} from 'bun:test'
import {createHmac} from 'node:crypto'

import {createAppService} from '../services/appService'
import {createPhalaCloudIngestService} from '../services/phalaCloudIngestService'
import {createProfileService} from '../services/profileService'
import type {QueueService} from '../services/queue'
import {createSyncEventService} from '../services/syncEventService'
import {convertToAppRecord, createSyncService} from '../services/syncService'
import {
  createPhalaCloudWebhookRoutes,
  MAX_PUSH_BYTES,
} from './phalaCloudWebhook'
import {createSyncEventsRoutes} from './syncEvents'

const url = process.env.TEST_DATABASE_URL
if (
  url &&
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
) {
  throw new Error(
    'Webhook tests require a disposable loopback PostgreSQL database',
  )
}
const suite = url ? describe : describe.skip
const connectionUrl = url ?? 'postgres://postgres@127.0.0.1:1/unused_test_db'
const secret = 'test-only-not-a-deployment-secret'
const profile = (id: number, name = `User ${id}`) => ({
  entity_type: 'user' as const,
  entity_id: id,
  display_name: name,
  avatar_url: null,
  description: null,
  custom_domain: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
})
const appRow = (id: number) => ({
  dstack_app_id: id.toString(16).padStart(40, '0'),
  app_id: id,
  app_name: `App ${id}`,
  workspace_id: 1,
  creator_id: 1,
  chain_id: null,
  kms_contract_address: null,
  contract_address: null,
  base_image: 'dstack-0.5.3',
  tproxy_base_domain: null,
  gateway_domain_suffix: 'example.test',
  listed: true,
  username: null,
  email: null,
  app_created_at: '2026-01-01T00:00:00Z',
  vm_created_at: '2026-01-01T00:00:00Z',
  docker_compose_file: 'services: {}',
})
const event = (overrides: Record<string, unknown> = {}) => ({
  event_id: crypto.randomUUID(),
  sent_at: new Date().toISOString(),
  profiles: [],
  deleted_profiles: [],
  apps: [],
  deleted_apps: [],
  ...overrides,
})
function request(
  body: unknown,
  options: {
    timestamp?: string
    signature?: string
    raw?: string
    signingKey?: string
  } = {},
) {
  const raw = options.raw ?? JSON.stringify(body)
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000))
  const signature =
    options.signature ??
    `sha256=${createHmac('sha256', options.signingKey ?? secret)
      .update(`${timestamp}.${raw}`)
      .digest('hex')}`
  return new Request('http://localhost/webhooks/phala-cloud', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Phala-Timestamp': timestamp,
      'X-Phala-Signature': signature,
    },
    body: raw,
  })
}

describe('Phala Cloud authentication and transport', () => {
  const api = createPhalaCloudWebhookRoutes({
    secret,
    ingest: async () => ({duplicate: false}),
  })
  test('unsigned and malformed signatures are rejected', async () => {
    for (const signature of ['', 'sha256=bad', `sha256=${'0'.repeat(64)}`]) {
      expect((await api.handle(request(event(), {signature}))).status).toBe(401)
    }
  })
  test('changing whitespace after signing fails raw-body authentication', async () => {
    const req = request(event())
    const raw = await req.text()
    const altered = new Request(req.url, {
      method: 'POST',
      headers: req.headers,
      body: `${raw} `,
    })
    expect((await api.handle(altered)).status).toBe(401)
  })
  test('timestamp is signed and cannot be refreshed by changing only the header', async () => {
    const req = request(event())
    req.headers.set(
      'X-Phala-Timestamp',
      String(Number(req.headers.get('X-Phala-Timestamp')) - 1),
    )
    expect((await api.handle(req)).status).toBe(401)
  })
  test('stale/future headers and stale sent_at are rejected', async () => {
    for (const delta of [-301, 301]) {
      expect(
        (
          await api.handle(
            request(event(), {
              timestamp: String(Math.floor(Date.now() / 1000) + delta),
            }),
          )
        ).status,
      ).toBe(401)
    }
    expect(
      (await api.handle(request(event({sent_at: '2020-01-01T00:00:00Z'}))))
        .status,
    ).toBe(401)
  })
  test('signed malformed JSON, missing arrays, and contradictory tombstones are 400', async () => {
    expect((await api.handle(request(null, {raw: '{'}))).status).toBe(400)
    expect(
      (
        await api.handle(
          request({
            event_id: crypto.randomUUID(),
            sent_at: new Date().toISOString(),
          }),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await api.handle(
          request(
            event({
              profiles: [profile(1)],
              deleted_profiles: [{entity_type: 'user', entity_id: 1}],
            }),
          ),
        )
      ).status,
    ).toBe(400)
    expect(
      (await api.handle(request(event({apps: [appRow(1)], deleted_apps: [1]}))))
        .status,
    ).toBe(400)
    expect(
      (await api.handle(request(event({deleted_apps: [1.5]})))).status,
    ).toBe(400)
  })
  test('upstream +00:00 timestamps support absent and six-digit fractional seconds', async () => {
    const row = {
      ...profile(1),
      created_at: '2026-10-13T18:00:00+00:00',
      updated_at: '2026-10-13T18:00:00.123456+00:00',
    }
    const app = {
      ...appRow(1),
      app_created_at: '2026-10-13T18:00:00+00:00',
      vm_created_at: '2026-10-13T18:00:00.654321+00:00',
    }
    expect(
      (await api.handle(request(event({profiles: [row], apps: [app]})))).status,
    ).toBe(200)
    expect(
      (
        await api.handle(
          request(event({apps: [{...app, vm_created_at: null}]})),
        )
      ).status,
    ).toBe(400)
  })
  test('body size is capped without trusting Content-Length', async () => {
    expect(
      (await api.handle(request(null, {raw: 'x'.repeat(MAX_PUSH_BYTES + 1)})))
        .status,
    ).toBe(413)
  })
  test('an absent existing Cloud API key disables webhook ingress', async () => {
    for (const signingKey of [undefined, '']) {
      const disabled = createPhalaCloudWebhookRoutes({
        secret: signingKey,
        ingest: async () => ({duplicate: false}),
      })
      expect((await disabled.handle(request(event()))).status).toBe(503)
    }
  })
  test('reuses a nonempty existing Cloud API key without a new length requirement', async () => {
    const cloudApiKey = 'legacy-key'
    const existingKeyApi = createPhalaCloudWebhookRoutes({
      secret: cloudApiKey,
      ingest: async () => ({duplicate: false}),
    })
    expect(
      (await existingKeyApi.handle(request(event(), {signingKey: cloudApiKey})))
        .status,
    ).toBe(200)
    expect(
      (
        await existingKeyApi.handle(
          request(event(), {signingKey: 'cron-admin-key'}),
        )
      ).status,
    ).toBe(401)
  })
})

suite('Phala Cloud webhook with real PostgreSQL', () => {
  const client = postgres(connectionUrl, {max: 1})
  const db = drizzle(client, {casing: 'snake_case'})
  const appService = createAppService(connectionUrl)
  const profiles = createProfileService(connectionUrl)
  const queued: string[] = []
  let failQueue = false
  let attempts = 0
  let onAttempt: (() => void) | undefined
  // Only the Redis queue boundary is substituted; HTTP, services and DB are real.
  const queue = {
    addTask: async (data: {appId: string}) => {
      attempts++
      onAttempt?.()
      if (failQueue) throw new Error('test queue offline')
      queued.push(data.appId)
      return crypto.randomUUID()
    },
  } as QueueService
  const sync = createSyncService(
    {phalaCloudApiKey: ''},
    queue,
    profiles,
    appService,
  )
  const ingest = createPhalaCloudIngestService({
    db,
    profileService: profiles,
    appService,
    syncSelectedTasks: sync.syncSelectedTasks,
  })
  const api = createPhalaCloudWebhookRoutes({secret, ingest: ingest.ingest})
  const waitForAttempts = (count: number) => {
    if (attempts >= count) return Promise.resolve()
    return new Promise<void>((resolve) => {
      onAttempt = () => {
        if (attempts >= count) resolve()
      }
    })
  }
  beforeEach(async () => {
    await client`TRUNCATE sync_events, profiles, verification_tasks, apps`
    queued.length = 0
    failQueue = false
    attempts = 0
    onAttempt = undefined
  })
  afterAll(async () => {
    await client.end()
  })

  test('pushing one profile leaves every unrelated profile intact', async () => {
    await profiles.syncProfiles([profile(1), profile(2)])
    expect(
      (await api.handle(request(event({profiles: [profile(1, 'Changed')]}))))
        .status,
    ).toBe(200)
    const rows = await db
      .select()
      .from(profilesTable)
      .orderBy(profilesTable.entityId)
    expect(rows.map((row) => [row.entityId, row.displayName])).toEqual([
      [1, 'Changed'],
      [2, 'User 2'],
    ])
    const audit = await db.select().from(syncEventsTable)
    expect(audit).toHaveLength(1)
    expect(audit[0]?.rowsChanged).toBe(1)
    expect(audit[0]?.result).toBe('success')
  })
  test('tombstones delete only named profiles and numeric app_id matches profileId', async () => {
    await profiles.syncProfiles([profile(1), profile(2)])
    await appService.upsertApps([
      convertToAppRecord(appRow(11)),
      convertToAppRecord(appRow(12)),
    ])
    expect(
      (
        await api.handle(
          request(
            event({
              deleted_profiles: [{entity_type: 'user', entity_id: 1}],
              deleted_apps: [11],
            }),
          ),
        )
      ).status,
    ).toBe(200)
    expect(
      (await db.select().from(profilesTable)).map((p) => p.entityId),
    ).toEqual([2])
    const apps = await db.select().from(appsTable).orderBy(appsTable.profileId)
    expect(apps.map((a) => [a.profileId, a.deleted])).toEqual([
      [11, true],
      [12, false],
    ])
    expect(queued).toEqual([])
    expect((await db.select().from(syncEventsTable))[0]?.rowsChanged).toBe(2)
  })
  test('same event replay and concurrent duplicate do not reapply or enqueue twice', async () => {
    const pushed = appRow(11)
    const payload = event({profiles: [profile(1)], apps: [pushed]})
    const responses = await Promise.all([
      api.handle(request(payload)),
      api.handle(request(payload)),
    ])
    expect(responses.map((r) => r.status)).toEqual([200, 200])
    const bodies = await Promise.all(
      responses.map((r) => r.json() as Promise<{duplicate: boolean}>),
    )
    expect(bodies.map((b) => b.duplicate).sort()).toEqual([false, true])
    await waitForAttempts(1)
    expect(queued).toEqual([pushed.dstack_app_id])
    const replay = await api.handle(
      request({...payload, profiles: [profile(1, 'Ignored replay')]}),
    )
    expect(((await replay.json()) as {duplicate: boolean}).duplicate).toBe(true)
    expect((await db.select().from(profilesTable))[0]?.displayName).toBe(
      'User 1',
    )
    expect(await db.select().from(syncEventsTable)).toHaveLength(1)
    expect(queued).toHaveLength(1)
  })
  test('authentication failures write neither entities nor audit records', async () => {
    const payload = event({profiles: [profile(1)]})
    expect(
      (
        await api.handle(
          request(payload, {signature: `sha256=${'0'.repeat(64)}`}),
        )
      ).status,
    ).toBe(401)
    expect((await api.handle(request(payload, {timestamp: '1'}))).status).toBe(
      401,
    )
    expect(await db.select().from(profilesTable)).toEqual([])
    expect(await db.select().from(syncEventsTable)).toEqual([])
  })
  test('app push verifies exactly the pushed eligible IDs, not unrelated apps', async () => {
    await appService.upsertApps([convertToAppRecord(appRow(99))])
    const pushed = [appRow(11), appRow(12)]
    expect((await api.handle(request(event({apps: pushed})))).status).toBe(200)
    await waitForAttempts(2)
    expect(queued.sort()).toEqual(pushed.map((a) => a.dstack_app_id).sort())
    expect((await db.select().from(appsTable)).length).toBe(3)
  })
  test('failure after profile writes rolls back the entire event and records an error', async () => {
    await appService.upsertApps([convertToAppRecord(appRow(11))])
    const payload = event({
      profiles: [profile(1, 'must roll back')],
      apps: [{...appRow(12), app_id: 11}],
    })
    expect((await api.handle(request(payload))).status).toBe(500)
    expect(await db.select().from(profilesTable)).toEqual([])
    expect((await db.select().from(appsTable)).map((a) => a.id)).toEqual([
      appRow(11).dstack_app_id,
    ])
    const audit = await db.select().from(syncEventsTable)
    expect(audit).toHaveLength(1)
    expect(audit[0]?.result).toBe('error')
    expect(audit[0]?.rowsChanged).toBe(0)
    expect(audit[0]?.errorMessage).toBe('Database apply failed')
    expect(queued).toEqual([])
    expect(
      (await api.handle(request({...payload, apps: [appRow(12)]}))).status,
    ).toBe(200)
    await waitForAttempts(1)
    expect(await db.select().from(syncEventsTable)).toHaveLength(1)
    expect((await db.select().from(profilesTable))[0]?.displayName).toBe(
      'must roll back',
    )
  })
  test('queue failure acknowledges committed entities; ordinary task sync without an outbound key recovers', async () => {
    const payload = event({profiles: [profile(1)], apps: [appRow(11)]})
    failQueue = true
    expect((await api.handle(request(payload))).status).toBe(200)
    await waitForAttempts(1)
    // Yield one event-loop turn so the detached rejection handler can submit its
    // audit update; the same one-connection DB pool orders the following read.
    await new Promise<void>((resolve) => setImmediate(resolve))
    const audit = (await db.select().from(syncEventsTable))[0]
    expect(audit?.result).toBe('success')
    expect(audit?.errorMessage).toBe(
      'Verification enqueue failed; task cron will retry',
    )
    expect((await db.select().from(profilesTable))[0]?.displayName).toBe(
      'User 1',
    )
    failQueue = false
    const replay = await api.handle(
      request({...payload, profiles: [profile(1, 'Never reapplied')]}),
    )
    expect(((await replay.json()) as {duplicate: boolean}).duplicate).toBe(true)
    expect(attempts).toBe(1)
    expect((await db.select().from(profilesTable))[0]?.displayName).toBe(
      'User 1',
    )
    // The task cron invokes this local-DB path even when services.sync is null.
    await sync.syncAllTasks()
    expect(queued).toEqual([appRow(11).dstack_app_id])
  })
  test('queue readiness never delays the HTTP acknowledgement', async () => {
    let release!: () => void
    const offline = new Promise<void>((resolve) => {
      release = resolve
    })
    const delayedQueue = {
      addTask: async (data: {appId: string}) => {
        onAttempt?.()
        await offline
        queued.push(data.appId)
        return crypto.randomUUID()
      },
    } as QueueService
    const delayedSync = createSyncService(
      {phalaCloudApiKey: ''},
      delayedQueue,
      profiles,
      appService,
    )
    const delayed = createPhalaCloudIngestService({
      db,
      profileService: profiles,
      appService,
      syncSelectedTasks: delayedSync.syncSelectedTasks,
    })
    const delayedApi = createPhalaCloudWebhookRoutes({
      secret,
      ingest: delayed.ingest,
    })
    try {
      expect(
        (await delayedApi.handle(request(event({apps: [appRow(11)]})))).status,
      ).toBe(200)
      expect(queued).toEqual([])
    } finally {
      release()
    }
    // Let the queued hint finish before resetting the disposable tables.
    await new Promise<void>((resolve) => setImmediate(resolve))
  })
  test('audit list requires CRON_API_KEY, bounds pagination and exposes only audit fields', async () => {
    await api.handle(request(event({profiles: [profile(1)]})))
    const admin = createSyncEventsRoutes({
      apiKey: 'admin-test-only',
      events: createSyncEventService(db),
    })
    const query = (path: string, key?: string) =>
      new Request(`http://localhost${path}`, {
        headers: key ? {Authorization: `Bearer ${key}`} : {},
      })
    expect((await admin.handle(query('/cron/sync-events'))).status).toBe(401)
    expect(
      (await admin.handle(query('/cron/sync-events', 'wrong'))).status,
    ).toBe(401)
    expect(
      (
        await admin.handle(
          query('/cron/sync-events?limit=101', 'admin-test-only'),
        )
      ).status,
    ).toBe(400)
    const response = await admin.handle(
      query('/cron/sync-events?source=push&limit=1', 'admin-test-only'),
    )
    expect(response.status).toBe(200)
    const rows = (
      (await response.json()) as {events: Record<string, unknown>[]}
    ).events
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        'id',
        'source',
        'eventId',
        'profileCount',
        'deletedProfileCount',
        'appCount',
        'deletedAppCount',
        'rowsChanged',
        'result',
        'errorMessage',
        'receivedAt',
        'finishedAt',
      ].sort(),
    )
    expect(
      (await admin.handle(query('/api/sync-events', 'admin-test-only'))).status,
    ).toBe(404)
  })
})
