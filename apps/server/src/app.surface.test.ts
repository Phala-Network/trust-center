import {expect, test} from 'bun:test'

// env is evaluated at import time, so each NODE_ENV runs in an isolated child.
const run = async (nodeEnv: 'production' | 'development') => {
  const appModule = new URL('./app.ts', import.meta.url).href
  const child = Bun.spawn(
    [
      process.execPath,
      '--no-env-file',
      '-e',
      `
      const {createApp} = await import(${JSON.stringify(appModule)});
      const app = createApp();
      for (const cron of Object.values(app.store.cron ?? {})) cron.stop();
      const get = (path, key) => app.handle(new Request('http://localhost' + path, {
        headers: key ? {Authorization: 'Bearer ' + key} : {},
      }));
      const result = {openapi: (await get('/openapi')).status, cron: []};
      for (let i = 0; i < 11; i++) result.cron.push((await get('/cron/status', 'wrong')).status);
      result.cronValidAfterLockout = (await get('/cron/status', 'cron-admin-key')).status;
      console.log(JSON.stringify(result));
      process.exit(0);
      `,
    ],
    {
      env: {
        NODE_ENV: nodeEnv,
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_ACCESS_KEY_ID: 'test-only',
        S3_SECRET_ACCESS_KEY: 'test-only',
        S3_BUCKET: 'test-only',
        CRON_API_KEY: 'cron-admin-key',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const output = await new Response(child.stdout).text()
  // stderr carries the app's own [ERROR] NOT_FOUND log for /openapi.
  const error = await new Response(child.stderr).text()
  expect(await child.exited, error).toBe(0)
  return JSON.parse(output.trim()) as {
    openapi: number
    cron: number[]
    cronValidAfterLockout: number
  }
}

test('production does not publish the OpenAPI route map', async () => {
  expect((await run('production')).openapi).toBe(404)
}, 15000)

test('development still serves OpenAPI docs', async () => {
  expect((await run('development')).openapi).toBe(200)
}, 15000)

test('cron management rejects wrong keys, then rate limits all callers', async () => {
  const {cron, cronValidAfterLockout} = await run('production')
  expect(cron.slice(0, 10)).toEqual(Array(10).fill(401))
  expect(cron[10]).toBe(429)
  expect(cronValidAfterLockout).toBe(429)
}, 15000)
