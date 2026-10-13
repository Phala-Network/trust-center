import {expect, test} from 'bun:test'

// Configuration is evaluated at import time; isolate it from any developer or
// deployment environment. No server, queue, storage or database is contacted.
test('a short webhook secret does not prevent ordinary server configuration from loading', async () => {
  const module = new URL('./env.ts', import.meta.url).href
  const child = Bun.spawn(
    [
      process.execPath,
      '--no-env-file',
      '-e',
      `
    import {env} from ${JSON.stringify(module)};
    if (env.PHALA_CLOUD_WEBHOOK_SECRET !== 'short') throw new Error('configuration failed');
    if (env.PROFILE_CRON_PATTERN !== '*/10 * * * *') throw new Error('profile default failed');
    if (env.APP_CRON_PATTERN !== '*/1 * * * *') throw new Error('app default changed');
    console.log('configuration ready');
  `,
    ],
    {
      env: {
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_ACCESS_KEY_ID: 'test-only',
        S3_SECRET_ACCESS_KEY: 'test-only',
        S3_BUCKET: 'test-only',
        CRON_API_KEY: 'test-only',
        PHALA_CLOUD_WEBHOOK_SECRET: 'short',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const output = await new Response(child.stdout).text()
  const error = await new Response(child.stderr).text()
  expect(await child.exited).toBe(0)
  expect(error).toBe('')
  expect(output.trim()).toBe('configuration ready')
})
