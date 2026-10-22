import {timingSafeEqual} from 'node:crypto'

export interface AdminAuthOptions {
  apiKey: string
  maxFailures?: number
  windowMs?: number
  now?: () => number
}

interface ResponseSet {
  status?: number | string
  headers: Record<string, string | number>
}

// Bearer check for CRON_API_KEY-protected admin routes. Failed attempts are
// counted globally (callers arrive through the dstack gateway, so client IPs
// are not reliable); once the budget is spent every request, including a valid
// one, gets 429 until the window resets. Scheduled crons run in-process and are
// unaffected by a lockout.
export function createAdminAuth({
  apiKey,
  maxFailures = 10,
  windowMs = 60_000,
  now = Date.now,
}: AdminAuthOptions) {
  const expected = Buffer.from(`Bearer ${apiKey}`)
  let windowStart = 0
  let failures = 0

  // Returns undefined when authorized, otherwise the error body to send.
  return (authorization: string | null, set: ResponseSet) => {
    const time = now()
    if (time - windowStart >= windowMs) {
      windowStart = time
      failures = 0
    }
    if (failures >= maxFailures) {
      set.status = 429
      set.headers['Retry-After'] = String(
        Math.ceil((windowStart + windowMs - time) / 1000),
      )
      return {error: 'Too Many Requests'}
    }

    const actual = Buffer.from(authorization ?? '')
    if (
      apiKey &&
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    ) {
      return undefined
    }
    failures++
    set.status = 401
    set.headers['WWW-Authenticate'] =
      'Bearer realm="cron", error="invalid_token"'
    return {error: 'Unauthorized'}
  }
}
