import {
  appsTable,
  type DbExecutor,
  eq,
  type NewAppRecord,
  profilesTable,
  type UpstreamProfileData,
  verificationTasksTable,
} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'bun:test'

import {type AppService, createAppService} from './appService'
import {createProfileService, type ProfileService} from './profileService'

// Requires a migrated, disposable loopback PostgreSQL database. For example:
// TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55439/trust_center_ingest_test \
//   bun test --max-concurrency 1 apps/server/src/services/partialWrites.test.ts
// Every query uses an isolated schema, never the webhook suite's public tables.
const databaseUrl = process.env.TEST_DATABASE_URL
if (
  databaseUrl &&
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname)
) {
  throw new Error(
    'Partial-write tests require a disposable loopback PostgreSQL database',
  )
}
const suite = databaseUrl ? describe : describe.skip

function profile(id: number, name = `User ${id}`): UpstreamProfileData {
  return {
    entity_type: 'user',
    entity_id: id,
    display_name: name,
    avatar_url: null,
    description: null,
    custom_domain: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
  }
}

function app(id = 'dstack-one', profileId = 101): NewAppRecord {
  return {
    id,
    profileId,
    appName: `App ${id}`,
    appConfigType: 'phala_cloud',
    contractAddress: `0x${id}`,
    domain: 'example.test',
    dstackVersion: null,
    workspaceId: 1,
    creatorId: 2,
    chainId: null,
    kmsContractAddress: null,
    baseImage: '0.5.3',
    tproxyBaseDomain: null,
    gatewayDomainSuffix: null,
    isPublic: false,
    username: null,
    email: null,
    customUser: null,
  }
}

suite('Transactional partial writes with real PostgreSQL', () => {
  const schema = `partial_writes_${crypto.randomUUID().replaceAll('-', '')}`
  let admin: ReturnType<typeof postgres> | undefined
  let client: ReturnType<typeof postgres> | undefined
  let db: DbExecutor
  let profiles: ProfileService
  let apps: AppService

  beforeAll(async () => {
    admin = postgres(databaseUrl!, {max: 1})
    await admin`CREATE SCHEMA ${admin(schema)}`
    await admin`CREATE TABLE ${admin(`${schema}.profiles`)} (LIKE public.profiles INCLUDING ALL)`
    await admin`CREATE TABLE ${admin(`${schema}.verification_tasks`)} (LIKE public.verification_tasks INCLUDING ALL)`
    await admin`CREATE TABLE ${admin(`${schema}.apps`)} (LIKE public.apps INCLUDING ALL)`
    client = postgres(databaseUrl!, {
      max: 1,
      connection: {search_path: schema},
    })
    db = drizzle(client, {casing: 'snake_case'})
    profiles = createProfileService(databaseUrl!)
    apps = createAppService(databaseUrl!)
  })

  beforeEach(async () => {
    await client!`TRUNCATE profiles, verification_tasks, apps`
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

  test('full profile snapshots insert, update, and delete with changed-row counts', async () => {
    expect(await profiles.syncProfiles([profile(1), profile(2)], db)).toEqual({
      upserted: 2,
      deleted: 0,
    })
    expect(
      await profiles.syncProfiles([profile(1, 'Changed'), profile(3)], db),
    ).toEqual({upserted: 2, deleted: 1})
    const rows = await db
      .select()
      .from(profilesTable)
      .orderBy(profilesTable.entityId)
    expect(rows.map((row) => [row.entityId, row.displayName])).toEqual([
      [1, 'Changed'],
      [3, 'User 3'],
    ])
    expect(await profiles.deleteProfile('user', 1, db)).toBe(1)
    expect(await profiles.deleteProfile('user', 1, db)).toBe(0)
    expect(await db.select().from(profilesTable)).toHaveLength(1)
  })

  test('unchanged full profiles return zero, including null and non-null timestamps', async () => {
    const snapshot = [
      profile(1),
      {...profile(2), updated_at: '2026-10-14T00:00:00Z'},
    ]
    await profiles.syncProfiles(snapshot, db)
    expect(await profiles.syncProfiles(snapshot, db)).toEqual({
      upserted: 0,
      deleted: 0,
    })
    snapshot[0]!.updated_at = '2026-10-15T00:00:00Z'
    expect(await profiles.syncProfiles(snapshot, db)).toEqual({
      upserted: 1,
      deleted: 0,
    })
    snapshot[0]!.updated_at = null
    expect(await profiles.syncProfiles(snapshot, db)).toEqual({
      upserted: 1,
      deleted: 0,
    })
    expect(await profiles.syncProfiles(snapshot, db)).toEqual({
      upserted: 0,
      deleted: 0,
    })
    expect(await profiles.syncProfiles([], db)).toEqual({
      upserted: 0,
      deleted: 0,
    })
    expect(await db.select().from(profilesTable)).toHaveLength(2)
  })

  test('partial profile upsert changes only named entities and handles null transitions', async () => {
    await profiles.syncProfiles([profile(1), profile(2)], db)
    const changed = {
      ...profile(1),
      avatar_url: 'https://example.test/avatar.png',
      description: 'Description',
      custom_domain: 'custom.example.test',
    }
    expect(await profiles.upsertProfiles([changed], db)).toBe(1)
    expect(await profiles.upsertProfiles([changed], db)).toBe(0)
    expect(await profiles.upsertProfiles([profile(1)], db)).toBe(1)
    const rows = await db
      .select()
      .from(profilesTable)
      .orderBy(profilesTable.entityId)
    expect(rows.map((row) => [row.entityId, row.displayName])).toEqual([
      [1, 'User 1'],
      [2, 'User 2'],
    ])
    expect(await profiles.deleteProfile('workspace', 1, db)).toBe(0)
    expect(await db.select().from(profilesTable)).toHaveLength(2)
  })

  test('duplicate profiles keep the last row and large batches count actual changes', async () => {
    const snapshot = Array.from({length: 1001}, (_, id) => profile(id))
    expect(
      await profiles.upsertProfiles([...snapshot, profile(1, 'Last')], db),
    ).toBe(1001)
    expect(
      await profiles.upsertProfiles([...snapshot, profile(1, 'Last')], db),
    ).toBe(0)
    expect(await profiles.syncProfiles([profile(1, 'Last')], db)).toEqual({
      upserted: 0,
      deleted: 1000,
    })
  })

  test('unchanged app upserts return no changed rows and ignore sync timestamps', async () => {
    const initial = app()
    const first = await apps.upsertApps([initial], db)
    expect(first.apps).toHaveLength(1)
    expect(first.revivedCount).toBe(0)
    const second = await apps.upsertApps(
      [
        {
          ...initial,
          updatedAt: new Date('2040-01-01'),
          lastSyncedAt: new Date('2041-01-01'),
        },
      ],
      db,
    )
    expect(second).toEqual({apps: [], revivedCount: 0})
    const rows = await apps.getAllApps(db)
    expect(rows[0]?.updatedAt).toEqual(first.apps[0]?.updatedAt)
    expect(rows[0]?.lastSyncedAt).toEqual(first.apps[0]?.lastSyncedAt)
  })

  test('every mapped app business column triggers an update', async () => {
    const initial = app()
    await apps.upsertApps([initial], db)
    const changes: Partial<NewAppRecord>[] = [
      {profileId: 202},
      {appName: 'Renamed'},
      {appConfigType: 'redpill'},
      {contractAddress: '0xchanged'},
      {domain: 'changed.example.test'},
      {dstackVersion: '0.6.0'},
      {workspaceId: 10},
      {creatorId: 20},
      {chainId: 1},
      {kmsContractAddress: '0xkms'},
      {baseImage: '0.6.0'},
      {tproxyBaseDomain: 'proxy.example.test'},
      {gatewayDomainSuffix: 'gateway.example.test'},
      {isPublic: true},
      {username: 'alice'},
      {email: 'alice@example.test'},
      {customUser: 'Customer'},
    ]
    for (const change of changes) {
      Object.assign(initial, change)
      expect((await apps.upsertApps([initial], db)).apps).toHaveLength(1)
      expect(await apps.upsertApps([initial], db)).toEqual({
        apps: [],
        revivedCount: 0,
      })
    }
    initial.email = null
    expect((await apps.upsertApps([initial], db)).apps).toHaveLength(1)
    expect((await apps.upsertApps([initial], db)).apps).toHaveLength(0)
  })

  test('numeric app tombstones match profile IDs, not dstack IDs, and no others', async () => {
    await apps.upsertApps([app('dstack-one', 101), app('101', 303)], db)
    expect(await apps.markAppDeleted(101, db)).toBe(1)
    expect(await apps.markAppDeleted(101, db)).toBe(0)
    expect(await apps.markAppDeleted(999, db)).toBe(0)
    const rows = await db.select().from(appsTable).orderBy(appsTable.id)
    expect(rows.map((row) => [row.id, row.deleted])).toEqual([
      ['101', false],
      ['dstack-one', true],
    ])
  })

  test('revival is changed, clears only revived app failed tasks, and preserves other tasks', async () => {
    await apps.upsertApps([app(), app('unrelated', 202)], db)
    await db.insert(verificationTasksTable).values([
      {id: 'revived-failed', appId: 'dstack-one', status: 'failed'},
      {id: 'revived-completed', appId: 'dstack-one', status: 'completed'},
      {id: 'revived-pending', appId: 'dstack-one', status: 'pending'},
      {id: 'unrelated-failed', appId: 'unrelated', status: 'failed'},
    ])
    await apps.markAppDeleted(101, db)
    const revived = await apps.upsertApps([app()], db)
    expect(revived.apps).toHaveLength(1)
    expect(revived.apps[0]?.deleted).toBe(false)
    expect(revived.revivedCount).toBe(1)
    const tasks = await db
      .select()
      .from(verificationTasksTable)
      .orderBy(verificationTasksTable.id)
    expect(tasks.map((task) => task.id)).toEqual([
      'revived-completed',
      'revived-pending',
      'unrelated-failed',
    ])
    expect(await apps.upsertApps([app()], db)).toEqual({
      apps: [],
      revivedCount: 0,
    })
  })

  test('multi-batch app upserts deduplicate and count only changed rows', async () => {
    const snapshot = Array.from({length: 101}, (_, id) =>
      app(`dstack-${id}`, id),
    )
    const first = await apps.upsertApps(
      [...snapshot, {...snapshot[0]!, appName: 'Last'}],
      db,
    )
    expect(first.apps).toHaveLength(101)
    expect(first.revivedCount).toBe(0)
    const second = await apps.upsertApps(
      [...snapshot, {...snapshot[0]!, appName: 'Last'}],
      db,
    )
    expect(second).toEqual({apps: [], revivedCount: 0})
    const rows = await db
      .select()
      .from(appsTable)
      .where(eq(appsTable.id, 'dstack-0'))
    expect(rows[0]?.appName).toBe('Last')
  })

  test('caller transaction rolls back profile writes, tombstones, and revival cleanup', async () => {
    await apps.upsertApps([app()], db)
    await apps.markAppDeleted(101, db)
    await db.insert(verificationTasksTable).values({
      id: 'failed-before-transaction',
      appId: 'dstack-one',
      status: 'failed',
    })
    await expect(
      db.transaction(async (tx) => {
        await profiles.upsertProfiles([profile(1)], tx)
        await apps.upsertApps([app()], tx)
        await apps.markAppDeleted(101, tx)
        throw new Error('Injected failure')
      }),
    ).rejects.toThrow('Injected failure')
    expect(await db.select().from(profilesTable)).toHaveLength(0)
    expect((await apps.getAllApps(db))[0]?.deleted).toBe(true)
    expect(await db.select().from(verificationTasksTable)).toHaveLength(1)
  })
})
