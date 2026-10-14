import {
  type DbConnection,
  profilesTable,
  type UpstreamProfileData,
} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'bun:test'

import {createProfileService, type ProfileService} from './profileService'

// Requires a migrated disposable loopback database. Every service query uses
// an isolated executor; the DB factory's public singleton is never queried.
const url = process.env.TEST_DATABASE_URL
if (
  url &&
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
) {
  throw new Error('Profile tests require disposable loopback PostgreSQL')
}
const suite = url ? describe : describe.skip
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

suite('Full profile reconciliation with real PostgreSQL', () => {
  const schema = `profile_perf_${crypto.randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres>
  let client: ReturnType<typeof postgres>
  let db: DbConnection
  let service: ProfileService
  let queries: {query: string; parameters: number}[] | undefined
  const sync = (snapshot: UpstreamProfileData[]) =>
    db.transaction((tx) => service.syncProfiles(snapshot, tx))
  const measure = async (snapshot: UpstreamProfileData[]) => {
    queries = []
    try {
      const counts = await sync(snapshot)
      return {counts, queries}
    } finally {
      queries = undefined
    }
  }

  beforeAll(async () => {
    admin = postgres(url!, {max: 1, onnotice: () => {}})
    await admin`CREATE SCHEMA ${admin(schema)}`
    await admin`CREATE TABLE ${admin(`${schema}.profiles`)} (LIKE public.profiles INCLUDING ALL)`
    client = postgres(url!, {
      max: 2,
      connection: {search_path: schema, application_name: schema},
      debug: (_id, query, parameters) => {
        queries?.push({query, parameters: parameters.length})
      },
    })
    db = drizzle(client, {casing: 'snake_case'})
    service = createProfileService(url!)
  })
  beforeEach(async () => {
    await client`TRUNCATE profiles`
  })
  afterAll(async () => {
    await client?.end()
    if (admin) {
      try {
        await admin`DROP SCHEMA IF EXISTS ${admin(schema)} CASCADE`
      } finally {
        await admin.end()
      }
    }
  })

  test('regression: unchanged full snapshots spend no bound-parameter budget; one change sends only one profile', async () => {
    const snapshot = Array.from({length: 1001}, (_, i) => profile(i + 1))
    expect(await sync(snapshot)).toEqual({upserted: 1001, deleted: 0})

    const unchanged = await measure(snapshot)
    expect(unchanged.counts).toEqual({upserted: 0, deleted: 0})
    expect(unchanged.queries.reduce((sum, q) => sum + q.parameters, 0)).toBe(0)
    expect(unchanged.queries.length).toBeLessThanOrEqual(3)

    snapshot[0] = {...snapshot[0]!, description: 'Changed description'}
    const changed = await measure(snapshot)
    expect(changed.counts).toEqual({upserted: 1, deleted: 0})
    expect(changed.queries.reduce((sum, q) => sum + q.parameters, 0)).toBe(8)
    expect(changed.queries.length).toBeLessThanOrEqual(4)
    const rows = await db.select().from(profilesTable)
    expect(rows).toHaveLength(1001)
    expect(rows.find((row) => row.entityId === 1)?.description).toBe(
      'Changed description',
    )
    expect(rows.find((row) => row.entityId === 1001)?.displayName).toBe(
      'User 1001',
    )
  })

  test('regression: legacy sub-millisecond PostgreSQL timestamps reconcile to the upstream Date value exactly once', async () => {
    const snapshot = [
      {...profile(1), updated_at: '2026-01-01T02:00:00.123+02:00'},
    ]
    await sync(snapshot)
    await client`UPDATE profiles SET updated_at = '2026-01-01 00:00:00.123456'::timestamp`
    const [before] = await db.select().from(profilesTable)
    expect(before!.updatedAt?.toISOString()).toBe('2026-01-01T00:00:00.123Z')

    expect(await sync(snapshot)).toEqual({upserted: 1, deleted: 0})
    const [stored] =
      await client`SELECT to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS value FROM profiles`
    expect(stored!.value).toBe('2026-01-01T00:00:00.123000')
    const unchanged = await measure(snapshot)
    expect(unchanged.counts).toEqual({upserted: 0, deleted: 0})
    expect(unchanged.queries.reduce((sum, q) => sum + q.parameters, 0)).toBe(0)
  })

  test('invariant: each persisted business field preserves distinct/null semantics and timestamp offsets', async () => {
    const blank = {...profile(1), display_name: null}
    await sync([blank])
    const changes = [
      {
        input: {...blank, display_name: 'Name'},
        field: 'displayName',
        expected: 'Name',
      },
      {
        input: {...blank, avatar_url: 'https://example.test/avatar.png'},
        field: 'avatarUrl',
        expected: 'https://example.test/avatar.png',
      },
      {
        input: {...blank, description: 'Description'},
        field: 'description',
        expected: 'Description',
      },
      {
        input: {...blank, custom_domain: 'custom.example.test'},
        field: 'customDomain',
        expected: 'custom.example.test',
      },
      {
        input: {...blank, updated_at: '2026-01-01T02:00:00.123+02:00'},
        field: 'updatedAt',
        expected: new Date('2026-01-01T00:00:00.123Z'),
      },
    ] as const
    for (const change of changes) {
      expect(await sync([change.input])).toEqual({upserted: 1, deleted: 0})
      const [stored] = await db.select().from(profilesTable)
      expect(stored![change.field]).toEqual(change.expected)
      expect(await sync([change.input])).toEqual({upserted: 0, deleted: 0})
      if (change.field === 'updatedAt') {
        expect(
          await sync([{...blank, updated_at: '2026-01-01T00:00:00.123Z'}]),
        ).toEqual({upserted: 0, deleted: 0})
      }
      expect(await sync([blank])).toEqual({upserted: 1, deleted: 0})
      const [cleared] = await db.select().from(profilesTable)
      expect(cleared![change.field]).toBeNull()
    }
    expect(await sync([{...blank, display_name: ''}])).toEqual({
      upserted: 1,
      deleted: 0,
    })
    expect(await sync([blank])).toEqual({upserted: 1, deleted: 0})
    // created_at is not updated by the existing upsert contract; falsy upstream
    // updated_at is mapped to null, just as in partial writes.
    const unchanged = await measure([
      {...blank, created_at: '2020-01-01', updated_at: ''},
    ])
    expect(unchanged.counts).toEqual({upserted: 0, deleted: 0})
    expect(unchanged.queries.reduce((sum, q) => sum + q.parameters, 0)).toBe(0)
  })

  test('invariant: full-snapshot deletion, guards, deduplication and partial writes retain their contracts', async () => {
    const user = profile(1)
    const workspace = {...profile(1), entity_type: 'workspace' as const}
    const app = {...profile(1), entity_type: 'app' as const}
    expect(await sync([user, workspace, app])).toEqual({
      upserted: 3,
      deleted: 0,
    })
    expect(await sync([])).toEqual({upserted: 0, deleted: 0})
    expect(
      await sync([
        {...user, entity_type: 'invalid'} as unknown as UpstreamProfileData,
      ]),
    ).toEqual({upserted: 0, deleted: 0})
    expect(await db.select().from(profilesTable)).toHaveLength(3)
    expect(
      await db.transaction((tx) =>
        service.upsertProfiles([{...user, display_name: 'Partial'}], tx),
      ),
    ).toBe(1)
    expect(
      await db.transaction((tx) =>
        service.upsertProfiles([{...user, display_name: 'Partial'}], tx),
      ),
    ).toBe(0)
    expect(await db.select().from(profilesTable)).toHaveLength(3)
    expect(
      await sync([user, {...user, display_name: 'Last'}, workspace]),
    ).toEqual({upserted: 1, deleted: 1})
    const rows = await db
      .select()
      .from(profilesTable)
      .orderBy(profilesTable.entityType)
    expect(
      rows.map((row) => [row.entityType, row.displayName, row.updatedAt]),
    ).toEqual([
      ['user', 'Last', null],
      ['workspace', 'User 1', null],
    ])
    const unchanged = await measure([
      {...user, display_name: 'Last'},
      workspace,
    ])
    expect(unchanged.counts).toEqual({upserted: 0, deleted: 0})
    expect(unchanged.queries.reduce((sum, q) => sum + q.parameters, 0)).toBe(0)
  })

  test('invariant: an unchanged full snapshot locks compared rows until its transaction finishes', async () => {
    await sync([profile(1)])
    let release!: () => void
    let compared!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const ready = new Promise<void>((resolve) => {
      compared = resolve
    })
    const full = db.transaction(async (tx) => {
      const counts = await service.syncProfiles([profile(1)], tx)
      compared()
      await gate
      return counts
    })
    await ready
    let partialFinished = false
    const partial = db
      .transaction((tx) =>
        service.upsertProfiles(
          [{...profile(1), description: 'After full sync'}],
          tx,
        ),
      )
      .then((count) => {
        partialFinished = true
        return count
      })
    try {
      let waiting = false
      for (let attempt = 0; attempt < 100 && !partialFinished; attempt++) {
        const [state] =
          await admin`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = ${schema} AND wait_event_type = 'Lock') AS waiting`
        waiting = state!.waiting
        if (waiting) break
        await Bun.sleep(10)
      }
      expect(waiting).toBe(true)
      expect(partialFinished).toBe(false)
    } finally {
      release()
      await Promise.all([full, partial])
    }
    expect(await full).toEqual({upserted: 0, deleted: 0})
    expect(await partial).toBe(1)
    const [stored] = await db.select().from(profilesTable)
    expect(stored!.description).toBe('After full sync')
  })
})
