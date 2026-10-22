import {expect, test} from 'bun:test'

import {createAdminAuth} from './adminAuth'

const key = 'admin-test-only'
const bearer = (value: string) => `Bearer ${value}`
const response = () =>
  ({headers: {}}) as {
    status?: number | string
    headers: Record<string, string | number>
  }

test('accepts only the exact bearer key', () => {
  const authorize = createAdminAuth({apiKey: key})
  expect(authorize(bearer(key), response())).toBeUndefined()

  for (const header of [null, '', key, bearer(`${key}x`), bearer('wrong')]) {
    const set = response()
    expect(authorize(header, set)).toEqual({error: 'Unauthorized'})
    expect(set.status).toBe(401)
  }
})

test('an empty configured key authorizes nothing', () => {
  const authorize = createAdminAuth({apiKey: ''})
  const set = response()
  expect(authorize(bearer(''), set)).toEqual({error: 'Unauthorized'})
  expect(set.status).toBe(401)
})

test('locks out every caller after too many failures until the window resets', () => {
  let time = 1_000_000
  const authorize = createAdminAuth({
    apiKey: key,
    maxFailures: 3,
    windowMs: 60_000,
    now: () => time,
  })
  for (let i = 0; i < 3; i++) authorize(bearer('wrong'), response())

  const set = response()
  expect(authorize(bearer(key), set)).toEqual({error: 'Too Many Requests'})
  expect(set.status).toBe(429)
  expect(set.headers['Retry-After']).toBe('60')

  time += 59_000
  expect(authorize(bearer(key), response())).toEqual({
    error: 'Too Many Requests',
  })

  time += 1_000
  expect(authorize(bearer(key), response())).toBeUndefined()
})

test('successful requests do not consume the failure budget', () => {
  const authorize = createAdminAuth({
    apiKey: key,
    maxFailures: 2,
    now: () => 0,
  })
  for (let i = 0; i < 20; i++) {
    expect(authorize(bearer(key), response())).toBeUndefined()
  }
  authorize(bearer('wrong'), response())
  expect(authorize(bearer(key), response())).toBeUndefined()
})
