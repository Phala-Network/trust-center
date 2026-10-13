import {
  appsTable,
  profilesTable,
  type UpstreamAppData,
  type UpstreamProfileData,
} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test'

import {createAppService} from './appService'
import {createProfileService} from './profileService'
import type {QueueService} from './queue'
import {createSyncEventService, getSyncErrorMessage} from './syncEventService'
import {convertToAppRecord, createSyncService} from './syncService'

const url = process.env.TEST_DATABASE_URL
if (
  url &&
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
) {
  throw new Error(
    'Sync tests require a disposable loopback PostgreSQL database',
  )
}
const suite = url ? describe : describe.skip
const connectionUrl = url ?? 'postgres://postgres@127.0.0.1:1/unused_test_db'

const profile = (id: number): UpstreamProfileData => ({
  entity_type: 'user',
  entity_id: id,
  display_name: `User ${id}`,
  avatar_url: null,
  description: null,
  custom_domain: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
})
const app = (id: number): UpstreamAppData => ({
  dstack_app_id: `app-${id}`,
  app_id: id,
  app_name: `App ${id}`,
  workspace_id: 1,
  creator_id: 1,
  chain_id: null,
  kms_contract_address: null,
  contract_address: null,
  base_image: '0.5.3',
  tproxy_base_domain: null,
  gateway_domain_suffix: 'example.test',
  listed: true,
  username: null,
  email: null,
  app_created_at: '2026-01-01T00:00:00Z',
  vm_created_at: '2026-01-01T00:00:00Z',
  docker_compose_file: null,
})

describe('sync error redaction', () => {
  test('redacts SQL parameters even when hidden in a nested cause', () => {
    const cause = Object.assign(new Error('query with private payload'), {
      query: 'INSERT private payload',
      params: ['secret'],
    })
    expect(getSyncErrorMessage(new Error('wrapper secret', {cause}))).toBe(
      'Database query failed',
    )
  })
})

suite('full sync audit with real PostgreSQL', () => {
  const client = postgres(connectionUrl, {max: 5, onnotice: () => {}})
  const db = drizzle(client, {casing: 'snake_case'})
  const apps = createAppService(connectionUrl)
  const profiles = createProfileService(connectionUrl)
  const audit = createSyncEventService(db)
  // Full entity sync never uses the queue collaborator.
  const sync = createSyncService(
    {phalaCloudApiKey: 'test-only-api-key'},
    {} as QueueService,
    profiles,
    apps,
  )
  let fetchMock: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

  beforeEach(async () => {
    await client`TRUNCATE sync_events, profiles, verification_tasks, apps`
    fetchMock = spyOn(globalThis, 'fetch')
  })
  afterEach(async () => {
    fetchMock.mockRestore()
    await client`DROP TRIGGER IF EXISTS sync_test_fail_app ON apps`
    await client`DROP TRIGGER IF EXISTS sync_test_fail_profile ON profiles`
    await client`DROP FUNCTION IF EXISTS sync_test_fail()`
  })
  afterAll(async () => {
    await client.end()
  })

  function upstream(data: unknown) {
    fetchMock.mockImplementation(
      Object.assign(async () => Response.json({data}), {preconnect: () => {}}),
    )
  }

  test('profile insert audit counts changes; an identical full snapshot changes zero rows', async () => {
    upstream([profile(1), profile(2)])
    expect((await sync.syncProfiles()).profilesSynced).toBe(2)
    expect((await sync.syncProfiles()).profilesSynced).toBe(2)

    const events = await audit.list({source: 'cron-profiles'})
    expect(events).toHaveLength(2)
    expect(events[0]?.rowsChanged).toBe(0)
    expect(events[1]?.rowsChanged).toBe(2)
    expect(events.map((event) => event.profileCount)).toEqual([2, 2])
    expect(new Set(events.map((event) => event.id)).size).toBe(2)
    for (const event of events) {
      expect(event.result).toBe('success')
      expect(event.finishedAt).toBeInstanceOf(Date)
      expect(event.eventId).toBeNull()
    }
  })

  test('app insert audit counts changes; an identical full snapshot changes zero rows', async () => {
    upstream([app(1), app(2)])
    expect((await sync.syncApps()).appsSynced).toBe(2)
    expect((await sync.syncApps()).appsSynced).toBe(2)

    const events = await audit.list({source: 'cron-apps'})
    expect(events).toHaveLength(2)
    expect(events[0]?.rowsChanged).toBe(0)
    expect(events[1]?.rowsChanged).toBe(2)
    expect(events.map((event) => event.appCount)).toEqual([2, 2])
    expect(events.every((event) => event.result === 'success')).toBe(true)
  })

  test('stale profile deletion and app soft deletion count only actual changes', async () => {
    await profiles.syncProfiles([profile(1), profile(2)])
    await apps.upsertApps([
      convertToAppRecord(app(1)),
      convertToAppRecord(app(2)),
    ])
    upstream([profile(1)])
    await sync.syncProfiles()
    upstream([app(1)])
    await sync.syncApps()
    await sync.syncApps()

    const profileEvents = await audit.list({source: 'cron-profiles'})
    expect(profileEvents[0]?.deletedProfileCount).toBe(1)
    expect(profileEvents[0]?.rowsChanged).toBe(1)
    expect(await db.select().from(profilesTable)).toHaveLength(1)
    const appEvents = await audit.list({source: 'cron-apps'})
    expect(appEvents[1]?.deletedAppCount).toBe(1)
    expect(appEvents[1]?.rowsChanged).toBe(1)
    expect(appEvents[0]?.deletedAppCount).toBe(0)
    expect(appEvents[0]?.rowsChanged).toBe(0)
    const rows = await db.select().from(appsTable)
    expect(rows.find((row) => row.id === 'app-2')?.deleted).toBe(true)
  })

  test('empty upstream snapshots are audited without deleting existing entities', async () => {
    await profiles.syncProfiles([profile(1)])
    await apps.upsertApps([convertToAppRecord(app(1))])
    upstream([])
    await sync.syncProfiles()
    await sync.syncApps()
    expect(await db.select().from(profilesTable)).toHaveLength(1)
    expect((await apps.getAllApps())[0]?.deleted).toBe(false)
    expect((await audit.list()).map((event) => event.rowsChanged)).toEqual([
      0, 0,
    ])
  })

  test('upstream failures record safe errors for both sources without response bodies', async () => {
    fetchMock.mockImplementation(
      Object.assign(
        async () => new Response('private upstream secret', {status: 503}),
        {preconnect: () => {}},
      ),
    )
    await expect(sync.syncProfiles()).rejects.toThrow('HTTP 503')
    await expect(sync.syncApps()).rejects.toThrow('HTTP 503')
    const events = await audit.list({result: 'error'})
    expect(events).toHaveLength(2)
    expect(new Set(events.map((event) => event.source))).toEqual(
      new Set(['cron-apps', 'cron-profiles']),
    )
    for (const event of events) {
      expect(event.errorMessage).toContain('HTTP 503')
      expect(event.errorMessage).not.toContain('private upstream secret')
      expect(event.rowsChanged).toBe(0)
      expect(event.finishedAt).toBeInstanceOf(Date)
    }
  })

  test('validation failures save a generic audit without the malformed payload', async () => {
    upstream([{entity_type: 'private malformed payload'}])
    await expect(sync.syncProfiles()).rejects.toThrow()
    const [event] = await audit.list()
    expect(event?.result).toBe('error')
    expect(event?.errorMessage).toBe('Upstream response validation failed')
    expect(event?.rowsChanged).toBe(0)
  })

  test('malformed upstream JSON records a generic error without parser payload excerpts', async () => {
    fetchMock.mockImplementation(
      Object.assign(async () => new Response('private malformed JSON'), {
        preconnect: () => {},
      }),
    )
    await expect(sync.syncApps()).rejects.toThrow()
    const [event] = await audit.list()
    expect(event?.result).toBe('error')
    expect(event?.errorMessage).toBe('Upstream response could not be parsed')
    expect(event?.rowsChanged).toBe(0)
  })

  test('app reconciliation failure rolls back preceding inserts and records a redacted error', async () => {
    await apps.upsertApps([convertToAppRecord(app(2))])
    await client.unsafe(`CREATE FUNCTION sync_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'private database payload'; END $$`)
    await client.unsafe(`CREATE TRIGGER sync_test_fail_app BEFORE UPDATE ON apps
      FOR EACH ROW WHEN (NEW.deleted = true) EXECUTE FUNCTION sync_test_fail()`)
    upstream([app(1)])
    await expect(sync.syncApps()).rejects.toThrow()

    const rows = await apps.getAllApps()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('app-2')
    expect(rows[0]?.deleted).toBe(false)
    const [event] = await audit.list()
    expect(event?.result).toBe('error')
    expect(event?.appCount).toBe(1)
    expect(event?.deletedAppCount).toBe(0)
    expect(event?.rowsChanged).toBe(0)
    expect(event?.errorMessage).toBe('Database query failed')
  })

  test('profile apply failure rolls back stale deletions and records one error', async () => {
    await profiles.syncProfiles([profile(2)])
    await client.unsafe(`CREATE FUNCTION sync_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'private database payload'; END $$`)
    await client.unsafe(`CREATE TRIGGER sync_test_fail_profile BEFORE INSERT ON profiles
      FOR EACH ROW EXECUTE FUNCTION sync_test_fail()`)
    upstream([profile(1)])
    await expect(sync.syncProfiles()).rejects.toThrow()

    const rows = await db.select().from(profilesTable)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.entityId).toBe(2)
    const events = await audit.list()
    expect(events).toHaveLength(1)
    expect(events[0]?.result).toBe('error')
    expect(events[0]?.rowsChanged).toBe(0)
    expect(events[0]?.errorMessage).toBe('Database query failed')
  })

  test('audit listing is filtered, newest first, and caps pagination', async () => {
    for (let i = 0; i < 105; i++) {
      await audit.record({
        id: `audit-${i}`,
        source: i % 2 === 0 ? 'cron-apps' : 'cron-profiles',
        result: i % 2 === 0 ? 'success' : 'error',
        receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      })
    }
    expect(await audit.list()).toHaveLength(50)
    expect(await audit.list({limit: 1000})).toHaveLength(100)
    expect((await audit.list({limit: 1}))[0]?.id).toBe('audit-104')
    expect((await audit.list({limit: 1, offset: 1}))[0]?.id).toBe('audit-103')
    const filtered = await audit.list({source: 'cron-apps', result: 'success'})
    expect(
      filtered.every(
        (event) => event.source === 'cron-apps' && event.result === 'success',
      ),
    ).toBe(true)
    expect(await audit.list({offset: 100000})).toEqual([])
  })
})
