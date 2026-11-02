import {describe, expect, test} from 'bun:test'
import {createHmac} from 'node:crypto'

import type {CloudAppStatus} from '../services/cloudStatusService'
import {createCloudStatusRoutes} from './cloudStatus'

const secret = 'test-only-not-a-deployment-secret'

const status = (overrides: Partial<CloudAppStatus> = {}): CloudAppStatus => ({
  present: true,
  listed: true,
  deleted: false,
  hidden: false,
  hasCompletedTask: true,
  lastIndexedAt: '2026-10-31T00:00:00.000Z',
  latestTask: {
    taskId: 'task-1',
    status: 'completed',
    finishedAt: '2026-10-31T00:00:00.000Z',
    errorMessage: null,
  },
  ...overrides,
})

const signedHeaders = (timestamp: string, sigSecret: string = secret) => ({
  'x-phala-timestamp': timestamp,
  'x-phala-signature': `sha256=${createHmac('sha256', sigSecret).update(`${timestamp}.`).digest('hex')}`,
})

const serve = (config: {
  secret?: string
  getStatus?: (appId: string) => Promise<CloudAppStatus>
}) => {
  const app = createCloudStatusRoutes({
    secret: config.secret,
    getStatus: config.getStatus ?? (async () => status()),
  })
  return (path: string, init?: RequestInit) =>
    app.handle(new Request(`http://localhost${path}`, init))
}

describe('GET /api/cloud/apps/:app_id/status', () => {
  test('returns the status payload for a valid signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const response = await serve({secret})(
      '/api/cloud/apps/app-1/status',
      {headers: signedHeaders(timestamp)},
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      app_id: 'app-1',
      present: true,
      indexed: true,
      listed: true,
      deleted: false,
      page_url: 'https://trust.phala.com/app/app-1',
      last_indexed_at: '2026-10-31T00:00:00.000Z',
      verification: {status: 'completed', task_id: 'task-1'},
    })
  })

  test('indexed is false for hidden apps even when verified', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const response = await serve({
      secret,
      getStatus: async () => status({hidden: true}),
    })('/api/cloud/apps/app-1/status', {headers: signedHeaders(timestamp)})
    const body = (await response.json()) as {
      indexed: boolean
      listed: boolean
    }
    expect(body.indexed).toBe(false)
    expect(body.listed).toBe(true)
  })

  test('401 for a bad signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const response = await serve({secret})(
      '/api/cloud/apps/app-1/status',
      {headers: signedHeaders(timestamp, 'wrong-secret')},
    )
    expect(response.status).toBe(401)
  })

  test('401 for a stale timestamp', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 400)
    const response = await serve({secret})(
      '/api/cloud/apps/app-1/status',
      {headers: signedHeaders(timestamp)},
    )
    expect(response.status).toBe(401)
  })

  test('401 for malformed headers', async () => {
    const response = await serve({secret})('/api/cloud/apps/app-1/status', {
      headers: {'x-phala-timestamp': 'abc', 'x-phala-signature': 'bogus'},
    })
    expect(response.status).toBe(401)
  })

  test('503 when the secret is not configured', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const response = await serve({secret: undefined})(
      '/api/cloud/apps/app-1/status',
      {headers: signedHeaders(timestamp)},
    )
    expect(response.status).toBe(503)
  })
})
