import {createHmac, timingSafeEqual} from 'node:crypto'

// Request authentication for the Phala Cloud integration API, using the exact
// same HMAC scheme as the push webhook (apps/server/src/routes/phalaCloudWebhook.ts):
//
//   X-Phala-Timestamp: <unix seconds>
//   X-Phala-Signature: sha256=<hex HMAC_SHA256(secret, "{timestamp}.{body}")>
//
// GET requests have no body, so the signed payload is "{timestamp}." — the same
// expression Cloud already uses for pushes with an empty body.
const MAX_AGE_SECONDS = 300

export type CloudAuthResult =
  | {ok: true}
  | {ok: false; status: number; error: string}

export function verifyCloudHmac(
  request: Request,
  secret: string | undefined,
  now: number = Date.now(),
): CloudAuthResult {
  if (!secret) {
    return {ok: false, status: 503, error: 'Cloud API not configured'}
  }
  const timestamp = request.headers.get('x-phala-timestamp') ?? ''
  const signature = request.headers.get('x-phala-signature') ?? ''
  if (
    !/^\d{1,12}$/.test(timestamp) ||
    !/^sha256=[0-9a-f]{64}$/.test(signature) ||
    Math.abs(now / 1000 - Number(timestamp)) > MAX_AGE_SECONDS
  ) {
    return {ok: false, status: 401, error: 'Invalid authentication'}
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).digest()
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) {
    return {ok: false, status: 401, error: 'Invalid authentication'}
  }
  return {ok: true}
}
