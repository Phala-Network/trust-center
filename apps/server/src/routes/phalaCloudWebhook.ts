import {Elysia} from 'elysia'
import {createHmac, timingSafeEqual} from 'node:crypto'

import {
  type PhalaCloudPush,
  PhalaCloudPushSchema,
} from '../types/phalaCloudWebhook'

export const MAX_PUSH_BYTES = 2 * 1024 * 1024
const MAX_AGE_SECONDS = 300

// Consume bytes ourselves: JSON parsing must never precede signature verification.
async function readLimitedBody(request: Request): Promise<Uint8Array | null> {
  const length = request.headers.get('content-length')
  if (length && Number(length) > MAX_PUSH_BYTES) return null
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_PUSH_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function createPhalaCloudWebhookRoutes(config: {
  secret?: string
  ingest: (event: PhalaCloudPush) => Promise<{duplicate: boolean}>
  now?: () => number
}) {
  return new Elysia({name: 'phala-cloud-webhook'}).post(
    '/webhooks/phala-cloud',
    async ({request, set}) => {
      if (!config.secret) {
        set.status = 503
        return {error: 'Webhook not configured'}
      }
      const timestamp = request.headers.get('x-phala-timestamp') ?? ''
      const signature = request.headers.get('x-phala-signature') ?? ''
      const now = (config.now ?? Date.now)()
      const unauthorized = () => {
        set.status = 401
        return {error: 'Invalid webhook authentication'}
      }
      if (
        !/^\d{1,12}$/.test(timestamp) ||
        !/^sha256=[0-9a-f]{64}$/.test(signature) ||
        Math.abs(now / 1000 - Number(timestamp)) > MAX_AGE_SECONDS
      )
        return unauthorized()
      const raw = await readLimitedBody(request)
      if (!raw) {
        set.status = 413
        return {error: 'Webhook body exceeds 2 MiB'}
      }
      const expected = createHmac('sha256', config.secret)
        .update(`${timestamp}.`)
        .update(raw)
        .digest()
      if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex')))
        return unauthorized()
      let json: unknown
      try {
        json = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(raw))
      } catch {
        set.status = 400
        return {error: 'Invalid JSON'}
      }
      const parsed = PhalaCloudPushSchema.safeParse(json)
      if (!parsed.success) {
        set.status = 400
        return {error: 'Invalid webhook payload'}
      }
      if (
        Math.abs(now - Date.parse(parsed.data.sent_at)) >
        MAX_AGE_SECONDS * 1000
      )
        return unauthorized()
      try {
        const result = await config.ingest(parsed.data)
        return {
          success: true,
          event_id: parsed.data.event_id,
          duplicate: result.duplicate,
        }
      } catch {
        set.status = 500
        return {error: 'Webhook processing failed; retry the same event_id'}
      }
    },
    {parse: 'none'},
  )
}
