import {
  appsTable,
  type DbExecutor,
  profilesTable,
  sql,
  type UpstreamAppData,
  UpstreamAppDataArraySchema,
  type UpstreamProfileData,
} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from 'bun:test'

import {createAppService} from './appService'
import {createProfileService} from './profileService'
import type {QueueService} from './queue'
import {createSyncEventService} from './syncEventService'
import {
  convertAppsWithTolerance,
  convertToAppRecord,
  createSyncService,
} from './syncService'

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

describe('tolerant upstream app conversion', () => {
  // Parsing normally produces plain objects; introduce an access fault only
  // after validation to exercise the real converter's failure boundary.
  const faultyApp = () => {
    const [validated] = UpstreamAppDataArraySchema.parse([app(2)])
    return Object.defineProperty(validated!, 'base_image', {
      get() {
        throw new Error('conversion access fault')
      },
    })
  }

  test('a real converter fault skips only that app and keeps upstream IDs', () => {
    const upstreamApps = [app(1), faultyApp(), app(3)]
    expect(convertAppsWithTolerance(upstreamApps).map((row) => row.id)).toEqual(
      ['app-1', 'app-3'],
    )
    // Reconciliation must still use the complete upstream snapshot, including
    // IDs whose conversion failed, rather than treating them as deletions.
    expect(upstreamApps.map((row) => row.app_id)).toEqual([1, 2, 3])
  })

  test('an all-bad nonempty snapshot fails before reconciliation can mutate data', () => {
    expect(() => convertAppsWithTolerance([faultyApp()])).toThrow(
      'No upstream apps could be converted',
    )
  })

  test('an empty snapshot remains a safe no-op', () => {
    expect(convertAppsWithTolerance([])).toEqual([])
  })
})

suite('full sync audit with real PostgreSQL', () => {
  const schema = `full_sync_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = postgres(connectionUrl, {max: 1, onnotice: () => {}})
  const client = postgres(connectionUrl, {
    max: 5,
    onnotice: () => {},
    connection: {search_path: schema, application_name: schema},
  })
  const db = drizzle(client, {casing: 'snake_case'})
  const baseApps = createAppService(connectionUrl)
  // The shared DB factory is a singleton. Route all fixture operations through
  // our isolated executor without changing production service configuration.
  const apps = {
    ...baseApps,
    getDb: () => db,
    upsertApps: (
      records: Parameters<typeof baseApps.upsertApps>[0],
      tx: DbExecutor = db,
    ) => baseApps.upsertApps(records, tx),
    getAllApps: (tx: DbExecutor = db) => baseApps.getAllApps(tx),
  }
  const baseProfiles = createProfileService(connectionUrl)
  const profiles = {
    ...baseProfiles,
    syncProfiles: (records: UpstreamProfileData[], tx: DbExecutor = db) =>
      baseProfiles.syncProfiles(records, tx),
  }
  const audit = createSyncEventService(db)
  // Full entity sync never uses the queue collaborator.
  const sync = createSyncService(
    {phalaCloudApiKey: 'test-only-api-key'},
    {} as QueueService,
    profiles,
    apps,
  )
  let fetchMock: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>

  beforeAll(async () => {
    await admin`CREATE SCHEMA ${admin(schema)}`
    for (const table of [
      'sync_events',
      'profiles',
      'verification_tasks',
      'apps',
    ]) {
      await admin.unsafe(
        `CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
      )
    }
  })
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
    try {
      await admin`DROP SCHEMA IF EXISTS ${admin(schema)} CASCADE`
    } finally {
      await admin.end()
    }
  })

  function upstream(data: unknown) {
    fetchMock.mockImplementation(
      Object.assign(async () => Response.json({data}), {preconnect: () => {}}),
    )
  }

  for (const entity of ['apps', 'profiles'] as const) {
    test(`${entity} full snapshot is fetched only after an in-flight push releases the lock`, async () => {
      const locked = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      let latestName = 'Before push'
      const push = db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(74190311)`)
        locked.resolve()
        await release.promise
        if (entity === 'apps') {
          await apps.upsertApps(
            [convertToAppRecord({...app(1), app_name: 'After push'})],
            tx,
          )
        } else {
          await profiles.syncProfiles(
            [{...profile(1), display_name: 'After push'}],
            tx,
          )
        }
        await audit.record(
          {
            id: crypto.randomUUID(),
            source: 'push',
            result: 'success',
            rowsChanged: 1,
            receivedAt: new Date(),
            finishedAt: new Date(),
          },
          tx,
        )
        latestName = 'After push'
      })
      await locked.promise
      fetchMock.mockImplementation(
        Object.assign(
          async () =>
            Response.json({
              data:
                entity === 'apps'
                  ? [{...app(1), app_name: latestName}]
                  : [{...profile(1), display_name: latestName}],
            }),
          {preconnect: () => {}},
        ),
      )
      const fullSync = entity === 'apps' ? sync.syncApps() : sync.syncProfiles()
      try {
        // Observe an actual PostgreSQL lock wait, not a timing-based assumption.
        const deadline = Date.now() + 3000
        let waiting = false
        while (Date.now() < deadline) {
          const [row] = await admin<{waiting: boolean}[]>`
            SELECT EXISTS (
              SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
              WHERE l.locktype = 'advisory' AND l.objid = 74190311
                AND NOT l.granted AND a.application_name = ${schema}
            ) AS waiting`
          if (row?.waiting) {
            waiting = true
            break
          }
          await Bun.sleep(10)
        }
        expect(waiting).toBe(true)
        expect(fetchMock).not.toHaveBeenCalled()
      } finally {
        release.resolve()
        await Promise.all([push, fullSync])
      }
      expect(fetchMock).toHaveBeenCalledTimes(1)
      if (entity === 'apps') {
        expect((await apps.getAllApps())[0]?.appName).toBe('After push')
      } else {
        expect((await db.select().from(profilesTable))[0]?.displayName).toBe(
          'After push',
        )
      }
      const events = await audit.list()
      expect(events).toHaveLength(2)
      expect(events.find((event) => event.source === 'push')?.rowsChanged).toBe(
        1,
      )
      expect(
        events.find((event) => event.source === `cron-${entity}`)?.rowsChanged,
      ).toBe(0)
      expect(events.every((event) => event.result === 'success')).toBe(true)
    })
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
    const firstSync = (await apps.getAllApps()).find(
      (row) => row.id === 'app-1',
    )
    await Bun.sleep(10)
    expect((await sync.syncApps()).appsSynced).toBe(2)
    const secondSync = (await apps.getAllApps()).find(
      (row) => row.id === 'app-1',
    )
    expect(secondSync?.lastSyncedAt?.getTime()).toBeGreaterThan(
      firstSync!.lastSyncedAt!.getTime(),
    )

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
