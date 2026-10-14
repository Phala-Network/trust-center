import {type DbExecutor, type UpstreamAppData} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {describe, expect, spyOn, test} from 'bun:test'
import {createHmac} from 'node:crypto'
import net from 'node:net'

import {createPhalaCloudWebhookRoutes} from '../routes/phalaCloudWebhook'
import {createAppService} from './appService'
import {createPhalaCloudIngestService} from './phalaCloudIngestService'
import {createProfileService} from './profileService'
import type {QueueService} from './queue'
import {createSyncService} from './syncService'

const url = process.env.TEST_DATABASE_URL
if (
  url &&
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
) {
  throw new Error(
    'App performance tests require disposable loopback PostgreSQL',
  )
}
const suite = url ? describe : describe.skip

// Transparent TCP transport delay, not a sleep injected into service/SQL mocks.
// Every chunk is forwarded unchanged at arrival + the current one-way delay.
function latencyProxy(target: URL) {
  let delayMs = 0
  let backendBytes = 0
  const sockets = new Set<net.Socket>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const server = net.createServer((frontend) => {
    const backend = net.connect({
      host: target.hostname,
      port: Number(target.port || 5432),
    })
    for (const socket of [frontend, backend]) {
      sockets.add(socket)
      socket.setNoDelay(true)
      socket.on('close', () => sockets.delete(socket))
      socket.on('error', () => {
        frontend.destroy()
        backend.destroy()
      })
    }
    for (const [source, destination] of [
      [frontend, backend],
      [backend, frontend],
    ] as const) {
      source.on('data', (chunk: Buffer) => {
        if (source === backend) backendBytes += chunk.length
        if (delayMs === 0) destination.write(chunk)
        else {
          const timer = setTimeout(() => {
            timers.delete(timer)
            if (!destination.destroyed) destination.write(chunk)
          }, delayMs)
          timers.add(timer)
        }
      })
      source.on('end', () => destination.end())
    }
  })
  return {
    backendBytes: () => backendBytes,
    setDelay: (ms: number) => {
      delayMs = ms
    },
    listen: async () => {
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      )
      return (server.address() as net.AddressInfo).port
    },
    close: async () => {
      for (const timer of timers) clearTimeout(timer)
      for (const socket of sockets) socket.destroy()
      if (server.listening)
        await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

// Synthetic valid observed-shape records, NOT production payload or credentials.
const upstream: UpstreamAppData[] = Array.from({length: 588}, (_, i) => ({
  dstack_app_id: (i + 1).toString(16).padStart(40, '0'),
  app_id: i + 1,
  app_name: `Synthetic app ${i + 1}`,
  workspace_id: (i % 80) + 1,
  creator_id: (i % 200) + 1,
  chain_id: null,
  kms_contract_address: null,
  contract_address: null,
  base_image: 'dstack-0.5.3',
  tproxy_base_domain: null,
  gateway_domain_suffix: 'gateway.example.test',
  listed: i % 4 === 0,
  username: null,
  email: null,
  app_created_at: '2026-01-01T00:00:00Z',
  vm_created_at: '2026-01-02T00:00:00Z',
  docker_compose_file: 'services: {}',
}))

suite('app full-sync performance with real PostgreSQL', () => {
  test('regression: a signed profile push arriving during unchanged 588-app sync succeeds within the five-second apply-lock budget at controlled 250ms RTT', async () => {
    const connectionUrl = url!
    const schema = `app_perf_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = postgres(connectionUrl, {
      max: 1,
      onnotice: () => {},
      connection: {statement_timeout: 2000},
    })
    const proxy = latencyProxy(new URL(connectionUrl))
    const clients: ReturnType<typeof postgres>[] = []
    const operations: Promise<unknown>[] = []
    let created = false
    let stopObserver = false
    let observer: Promise<void> | undefined
    let fetchMock:
      | ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>
      | undefined
    try {
      await admin`CREATE SCHEMA ${admin(schema)}`
      created = true
      for (const table of [
        'apps',
        'profiles',
        'verification_tasks',
        'sync_events',
      ]) {
        await admin.unsafe(
          `CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
        )
      }
      const delayedUrl = new URL(connectionUrl)
      delayedUrl.hostname = '127.0.0.1'
      delayedUrl.port = String(await proxy.listen())
      const firstSelect = Promise.withResolvers<void>()
      let measuring = false
      const fullClient = postgres(delayedUrl.toString(), {
        max: 1,
        onnotice: () => {},
        connection: {
          search_path: `${schema},public`,
          application_name: schema,
          statement_timeout: 8000,
        },
        debug: (_id, query) => {
          // Resolves only at the real first batch read, after lock acquisition
          // and actual upstream parse/conversion. Never pauses the full sync.
          if (measuring && query.includes('for update')) firstSelect.resolve()
        },
      })
      const pushClient = postgres(connectionUrl, {
        max: 1,
        onnotice: () => {},
        connection: {
          search_path: `${schema},public`,
          application_name: schema,
          statement_timeout: 8000,
        },
      })
      clients.push(fullClient, pushClient)
      const fullDb = drizzle(fullClient, {casing: 'snake_case'})
      const pushDb = drizzle(pushClient, {casing: 'snake_case'})
      const baseApps = createAppService(connectionUrl)
      const apps = {
        ...baseApps,
        getDb: () => fullDb,
        upsertApps: (
          records: Parameters<typeof baseApps.upsertApps>[0],
          tx: DbExecutor = fullDb,
        ) => baseApps.upsertApps(records, tx),
        getAllApps: (tx: DbExecutor = fullDb) => baseApps.getAllApps(tx),
      }
      const profiles = createProfileService(connectionUrl)
      let queueCalls = 0
      const queue = {
        addTask: async (
          _task: Parameters<QueueService['addTask']>[0],
        ): Promise<string> => {
          queueCalls++
          return crypto.randomUUID()
        },
      } as QueueService
      const sync = createSyncService(
        {phalaCloudApiKey: 'synthetic-test-only'},
        queue,
        profiles,
        apps,
      )
      const ingest = createPhalaCloudIngestService({
        db: pushDb,
        profileService: profiles,
        appService: apps,
        syncSelectedTasks: sync.syncSelectedTasks,
      })
      const secret = 'synthetic-test-only'
      const api = createPhalaCloudWebhookRoutes({secret, ingest: ingest.ingest})
      fetchMock = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(
          async (request: string | URL | Request) => {
            expect(String(request)).toBe(
              'https://cloud-api.phala.com/api/v1/stats/dstack_app',
            )
            return new Response(JSON.stringify({data: upstream}), {
              headers: {'content-type': 'application/json'},
            })
          },
          {preconnect: () => {}},
        ),
      )
      // Warm both actual connections and the actual unchanged service path.
      const [fullOwner] = await fullClient`select pg_backend_pid() as pid`
      const [pushOwner] = await pushClient`select pg_backend_pid() as pid`
      await sync.syncApps()
      await sync.syncApps()
      const before =
        await pushClient`select id, updated_at, last_synced_at from apps order by id`
      await pushClient`TRUNCATE sync_events`
      proxy.setDelay(125)
      measuring = true

      // Direct-local observer brackets actual PostgreSQL ownership, rather than
      // treating delayed COMMIT acknowledgement as the exact release instant.
      const samples: {start: number; end: number; held: boolean}[] = []
      let sawHeld = false
      observer = (async () => {
        const deadline = performance.now() + 10000
        while (!stopObserver && performance.now() < deadline) {
          const start = performance.now()
          const [state] =
            await admin`select exists(select 1 from pg_locks where locktype = 'advisory' and objid = 74190311 and pid = ${fullOwner!.pid} and granted) as held`
          samples.push({start, end: performance.now(), held: state!.held})
          if (state!.held) sawHeld = true
          if (sawHeld && !state!.held) return
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
      })()
      const full = sync.syncApps()
      operations.push(full)
      await Promise.race([
        firstSelect.promise,
        full.then(() => {
          throw new Error('Full sync completed without observed batch read')
        }),
      ])
      const [lock] =
        await admin`select count(*)::int as count from pg_locks where locktype = 'advisory' and objid = 74190311 and pid = ${fullOwner!.pid} and granted`
      expect(lock!.count).toBe(1)

      const eventId = crypto.randomUUID()
      const raw = JSON.stringify({
        event_id: eventId,
        sent_at: new Date().toISOString(),
        profiles: [
          {
            entity_type: 'user',
            entity_id: 900001,
            display_name: 'Synthetic pushed profile',
            avatar_url: null,
            description: null,
            custom_domain: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: null,
          },
        ],
        deleted_profiles: [],
        apps: [],
        deleted_apps: [],
      })
      const timestamp = String(Math.floor(Date.now() / 1000))
      const signature = createHmac('sha256', secret)
        .update(`${timestamp}.${raw}`)
        .digest('hex')
      const pushStart = performance.now()
      const push = api.handle(
        new Request('http://localhost/webhooks/phala-cloud', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-phala-timestamp': timestamp,
            'x-phala-signature': `sha256=${signature}`,
          },
          body: raw,
        }),
      )
      operations.push(push)
      // Assert the request truly contends on the same real PG advisory lock.
      let sawWaitingPush = false
      for (let i = 0; i < 100; i++) {
        const [waiting] =
          await admin`select exists(select 1 from pg_locks where locktype = 'advisory' and objid = 74190311 and pid = ${pushOwner!.pid} and not granted) as waiting`
        if (waiting!.waiting) {
          sawWaitingPush = true
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      expect(sawWaitingPush).toBe(true)
      const response = await push
      const pushMs = performance.now() - pushStart
      const result = await full
      await observer
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        success: true,
        duplicate: false,
      })
      expect(pushMs).toBeLessThan(5000)
      expect(result.appsSynced).toBe(588)
      const first = samples.findIndex((s) => s.held)
      const last = samples.findLastIndex((s) => s.held)
      expect(first).toBeGreaterThan(0)
      expect(last).toBeLessThan(samples.length - 1)
      const ownershipUpperMs =
        samples[last + 1]!.end - samples[first - 1]!.start
      expect(ownershipUpperMs).toBeLessThan(5000)

      const after =
        await pushClient`select id, updated_at, last_synced_at from apps order by id`
      expect(after).toHaveLength(588)
      for (let i = 0; i < 588; i++) {
        expect(after[i]!.id).toBe(before[i]!.id)
        expect(new Date(after[i]!.updated_at).getTime()).toBeGreaterThan(
          new Date(before[i]!.updated_at).getTime(),
        )
        expect(new Date(after[i]!.last_synced_at).getTime()).toBeGreaterThan(
          new Date(before[i]!.last_synced_at).getTime(),
        )
        expect(new Date(after[i]!.updated_at).getTime()).toBe(
          new Date(after[i]!.last_synced_at).getTime(),
        )
      }
      const [pushed] =
        await pushClient`select entity_id, display_name from profiles`
      expect(pushed).toMatchObject({
        entity_id: 900001,
        display_name: 'Synthetic pushed profile',
      })
      const audits =
        await pushClient`select source, event_id, rows_changed, result, app_count, profile_count from sync_events order by source`
      expect(audits).toHaveLength(2)
      expect(audits[0]).toMatchObject({
        source: 'cron-apps',
        rows_changed: 0,
        result: 'success',
        app_count: 588,
      })
      expect(audits[1]).toMatchObject({
        source: 'push',
        event_id: eventId,
        rows_changed: 1,
        result: 'success',
        profile_count: 1,
      })
      expect(queueCalls).toBe(0)
      console.log('[APP-SYNC-PERF]', {
        oneWayDelayMs: 125,
        ownershipUpperMs,
        pushMs,
        refreshedApps: 588,
      })
    } finally {
      stopObserver = true
      fetchMock?.mockRestore()
      // Interrupt blocked transport before waiting for operations. The test
      // timeout alone does not cancel queries or promises inside the service.
      await proxy.close()
      let settlementTimer: ReturnType<typeof setTimeout> | undefined
      try {
        for (const client of clients) await client.end({timeout: 1})
        await Promise.race([
          Promise.allSettled([...operations, observer]),
          new Promise<void>((resolve) => {
            settlementTimer = setTimeout(resolve, 1000)
          }),
        ])
      } finally {
        clearTimeout(settlementTimer)
        try {
          if (created) await admin`DROP SCHEMA ${admin(schema)} CASCADE`
        } finally {
          await admin.end({timeout: 1})
        }
      }
    }
  }, 12000)

  test('regression: app reconciliation excludes ten thousand historical deleted rows from database response traffic', async () => {
    const connectionUrl = url!
    const schema = `app_history_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = postgres(connectionUrl, {
      max: 1,
      onnotice: () => {},
      connection: {statement_timeout: 2000},
    })
    const proxy = latencyProxy(new URL(connectionUrl))
    let client: ReturnType<typeof postgres> | undefined
    let created = false
    let fetchMock:
      | ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>
      | undefined
    try {
      await admin`CREATE SCHEMA ${admin(schema)}`
      created = true
      for (const table of ['apps', 'verification_tasks', 'sync_events']) {
        await admin.unsafe(
          `CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`,
        )
      }
      const proxyUrl = new URL(connectionUrl)
      proxyUrl.hostname = '127.0.0.1'
      proxyUrl.port = String(await proxy.listen())
      client = postgres(proxyUrl.toString(), {
        max: 1,
        onnotice: () => {},
        connection: {search_path: `${schema},public`, statement_timeout: 8000},
      })
      const db = drizzle(client, {casing: 'snake_case'})
      const baseApps = createAppService(connectionUrl)
      const apps = {
        ...baseApps,
        getDb: () => db,
        upsertApps: (
          records: Parameters<typeof baseApps.upsertApps>[0],
          tx: DbExecutor = db,
        ) => baseApps.upsertApps(records, tx),
        getAllApps: (tx: DbExecutor = db) => baseApps.getAllApps(tx),
      }
      const sync = createSyncService(
        {phalaCloudApiKey: 'synthetic-test-only'},
        {} as QueueService,
        createProfileService(connectionUrl),
        apps,
      )
      fetchMock = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(
          async () => new Response(JSON.stringify({data: upstream})),
          {preconnect: () => {}},
        ),
      )
      await sync.syncApps()
      // Synthetic history is deliberately absent from the upstream snapshot.
      // Warm/setup queries use a separate connection and are not counted.
      await admin.unsafe(`INSERT INTO "${schema}".apps
        (id,profile_id,app_name,app_config_type,contract_address,domain,workspace_id,creator_id,base_image,deleted)
        SELECT 'history-' || n,1000000+n,'Historical','phala_cloud','','',1,1,'0.5.3',true
        FROM generate_series(1,10000) n`)
      await admin.unsafe(`INSERT INTO "${schema}".apps
        (id,profile_id,app_name,app_config_type,contract_address,domain,workspace_id,creator_id,base_image,deleted)
        VALUES ('absent-active',2000000,'Absent active','phala_cloud','','',1,1,'0.5.3',false)`)
      const beforeBytes = proxy.backendBytes()
      expect((await sync.syncApps()).appsSynced).toBe(588)
      const responseBytes = proxy.backendBytes() - beforeBytes
      // The current-row read for the 588 observed apps is legitimate. Returning
      // all historical business rows is not: old getAllApps exceeds this limit.
      expect(responseBytes).toBeLessThan(1000000)
      const [counts] = await admin.unsafe(`SELECT
        count(*) FILTER (WHERE NOT deleted)::int AS active,
        count(*) FILTER (WHERE deleted)::int AS deleted,
        count(*) FILTER (WHERE id LIKE 'history-%' AND deleted AND updated_at IS NULL AND last_synced_at IS NULL)::int AS untouched_history
        FROM "${schema}".apps`)
      expect(counts).toMatchObject({
        active: 588,
        deleted: 10001,
        untouched_history: 10000,
      })
      const [absent] = await admin.unsafe(
        `SELECT deleted,updated_at,last_synced_at FROM "${schema}".apps WHERE id='absent-active'`,
      )
      expect(absent!.deleted).toBe(true)
      expect(absent!.updated_at).not.toBeNull()
      expect(absent!.last_synced_at).toBeNull()
      const [audit] = await admin.unsafe(
        `SELECT rows_changed,deleted_app_count,result FROM "${schema}".sync_events ORDER BY received_at DESC LIMIT 1`,
      )
      expect(audit).toMatchObject({
        rows_changed: 1,
        deleted_app_count: 1,
        result: 'success',
      })
      await sync.syncApps()
      const [repeat] = await admin.unsafe(
        `SELECT rows_changed,deleted_app_count,result FROM "${schema}".sync_events ORDER BY received_at DESC LIMIT 1`,
      )
      expect(repeat).toMatchObject({
        rows_changed: 0,
        deleted_app_count: 0,
        result: 'success',
      })
    } finally {
      fetchMock?.mockRestore()
      await proxy.close()
      try {
        await client?.end({timeout: 1})
      } finally {
        try {
          if (created) await admin`DROP SCHEMA ${admin(schema)} CASCADE`
        } finally {
          await admin.end({timeout: 1})
        }
      }
    }
  }, 12000)
})
