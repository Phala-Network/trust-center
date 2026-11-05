import {appsTable, eq, verificationTasksTable} from '@phala/trust-center-db'
import {drizzle} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {expect, test} from 'bun:test'

const databaseUrl = process.env.TEST_DATABASE_URL
const redisUrl = process.env.TEST_REDIS_URL
for (const url of [databaseUrl, redisUrl]) {
  if (
    url &&
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  ) {
    throw new Error('Cloud status tests require disposable loopback services')
  }
}
const integrationTest = databaseUrl && redisUrl ? test : test.skip
const secret = 'cloud-status-test-only'

// Isolate import-time env and the service singleton from other server tests.
const run = async (
  options: {secret?: string; appId?: string; initializeServices?: boolean} = {},
) => {
  const appModule = new URL('./app.ts', import.meta.url).href
  const servicesModule = new URL('./services/index.ts', import.meta.url).href
  const child = Bun.spawn(
    [
      process.execPath,
      '--no-env-file',
      '-e',
      `
      try {
        const {createHmac} = await import('node:crypto');
        const {createApp} = await import(${JSON.stringify(appModule)});
        const {createServices, closeServices} = await import(${JSON.stringify(servicesModule)});
        const headers = {};
        if (${Boolean(options.initializeServices)}) {
          createServices();
          const timestamp = String(Math.floor(Date.now() / 1000));
          headers['X-Phala-Timestamp'] = timestamp;
          headers['X-Phala-Signature'] = 'sha256=' + createHmac('sha256', process.env.PHALA_CLOUD_API_KEY)
            .update(timestamp + '.').digest('hex');
        }
        const app = createApp();
        for (const cron of Object.values(app.store.cron ?? {})) cron.stop();
        const response = await app.handle(new Request(
          'http://localhost/api/cloud/apps/' + ${JSON.stringify(options.appId ?? 'app-1')} + '/status',
          {headers},
        ));
        const raw = await response.text();
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        const result = {status: response.status, body};
        await closeServices();
        console.log('RESULT ' + JSON.stringify(result));
        process.exit(0);
      } catch (error) {
        console.error(error);
        process.exit(1);
      }
      `,
    ],
    {
      env: {
        NODE_ENV: 'production',
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_ACCESS_KEY_ID: 'test-only',
        S3_SECRET_ACCESS_KEY: 'test-only',
        S3_BUCKET: 'test-only',
        CRON_API_KEY: 'cron-test-only',
        ...(options.secret ? {PHALA_CLOUD_API_KEY: options.secret} : {}),
        ...(options.initializeServices
          ? {
              DATABASE_URL: databaseUrl!,
              REDIS_URL: redisUrl!,
              QUEUE_NAME: `cloud-status-test-${crypto.randomUUID()}`,
            }
          : {}),
      },
      timeout: 10000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const [output, error, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  expect(exitCode, error).toBe(0)
  const result = output.split('\n').find((line) => line.startsWith('RESULT '))
  expect(result, output).toBeDefined()
  return JSON.parse(result!.slice('RESULT '.length)) as {
    status: number
    body: unknown
  }
}

test('regression: createApp exposes cloud status and rejects unsigned requests', async () => {
  expect(await run({secret})).toEqual({
    status: 401,
    body: {error: 'Invalid authentication'},
  })
}, 15000)

test('regression: createApp fails closed when the cloud status secret is absent', async () => {
  expect(await run()).toEqual({
    status: 503,
    body: {error: 'Cloud status API not configured'},
  })
}, 15000)

// Run with TEST_DATABASE_URL and TEST_REDIS_URL pointing to disposable local
// PostgreSQL (migrated) and Redis instances. No internal services are mocked.
for (const latestStatus of ['completed', 'active'] as const) {
  integrationTest(
    `regression: signed createApp requests read ${latestStatus} status through composed services`,
    async () => {
      const client = postgres(databaseUrl!)
      const db = drizzle(client, {casing: 'snake_case'})
      const appId = crypto.randomUUID().replaceAll('-', '').padEnd(40, '0')
      const taskId = crypto.randomUUID()
      try {
        await db.insert(appsTable).values({
          id: appId,
          profileId: -123456789,
          appName: 'Cloud status wiring fixture',
          appConfigType: 'phala_cloud',
          contractAddress: '0x0000000000000000000000000000000000000000',
          domain: 'cloud-status.example.test',
          workspaceId: 1,
          creatorId: 1,
          baseImage: 'dstack-0.5.3',
          isPublic: true,
          deleted: false,
        })
        await db.insert(verificationTasksTable).values({
          id: taskId,
          appId,
          status: 'completed',
          createdAt: new Date('2026-10-31T00:00:00Z'),
          finishedAt: new Date('2026-10-31T00:00:00Z'),
        })
        const latestTaskId =
          latestStatus === 'active' ? crypto.randomUUID() : taskId
        if (latestStatus === 'active') {
          await db.insert(verificationTasksTable).values({
            id: latestTaskId,
            appId,
            status: 'active',
            createdAt: new Date('2026-11-01T00:00:00Z'),
          })
        }

        expect(await run({secret, appId, initializeServices: true})).toEqual({
          status: 200,
          body: {
            app_id: appId,
            present: true,
            indexed: true,
            listed: true,
            deleted: false,
            page_url: `https://trust.phala.com/app/${appId}`,
            last_indexed_at: '2026-10-31T00:00:00.000Z',
            verification: {
              status: latestStatus,
              task_id: latestTaskId,
              finished_at:
                latestStatus === 'active' ? null : '2026-10-31T00:00:00.000Z',
              error_message: null,
            },
          },
        })
      } finally {
        await db
          .delete(verificationTasksTable)
          .where(eq(verificationTasksTable.appId, appId))
        await db.delete(appsTable).where(eq(appsTable.id, appId))
        await client.end()
      }
    },
    15000,
  )
}
