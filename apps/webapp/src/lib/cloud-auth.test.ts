import {createHmac} from 'node:crypto'

import {describe, expect, test} from 'bun:test'

import {verifyCloudHmac} from './cloud-auth'

const SECRET = 'test-secret'

function sign(timestamp: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.`).digest('hex')}`
}

function request(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/cloud/apps/x/status', {headers})
}

describe('verifyCloudHmac', () => {
  test('accepts a valid signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const result = verifyCloudHmac(
      request({
        'x-phala-timestamp': timestamp,
        'x-phala-signature': sign(timestamp),
      }),
      SECRET,
    )
    expect(result.ok).toBe(true)
  })

  test('rejects a wrong secret', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const result = verifyCloudHmac(
      request({
        'x-phala-timestamp': timestamp,
        'x-phala-signature': sign(timestamp, 'other-secret'),
      }),
      SECRET,
    )
    expect(result).toEqual({ok: false, status: 401, error: 'Invalid authentication'})
  })

  test('rejects a stale timestamp', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 400)
    const result = verifyCloudHmac(
      request({
        'x-phala-timestamp': timestamp,
        'x-phala-signature': sign(timestamp),
      }),
      SECRET,
    )
    if (result.ok) throw new Error('expected auth to fail')
    expect(result.status).toBe(401)
  })

  test('rejects malformed headers', () => {
    const cases: Record<string, string>[] = [
      {'x-phala-timestamp': 'abc', 'x-phala-signature': sign('123')},
      {
        'x-phala-timestamp': '123',
        'x-phala-signature': 'not-sha256',
      },
      {},
    ]
    for (const headers of cases) {
      const result = verifyCloudHmac(request(headers), SECRET)
      if (result.ok) throw new Error('expected auth to fail')
      expect(result.status).toBe(401)
    }
  })

  test('returns 503 when the secret is not configured', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const result = verifyCloudHmac(
      request({
        'x-phala-timestamp': timestamp,
        'x-phala-signature': sign(timestamp),
      }),
      undefined,
    )
    expect(result).toEqual({
      ok: false,
      status: 503,
      error: 'Cloud API not configured',
    })
  })
})
