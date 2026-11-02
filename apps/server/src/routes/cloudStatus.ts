import {Elysia} from 'elysia'
import {createHmac, timingSafeEqual} from 'node:crypto'

import type {CloudAppStatus} from '../services/cloudStatusService'

// Request authentication uses the same HMAC scheme as POST
// /webhooks/phala-cloud: X-Phala-Timestamp plus
// X-Phala-Signature = sha256=HMAC_SHA256(secret, "{timestamp}.{body}").
// GET requests have no body, so the signed payload is "{timestamp}." — the same
// expression the pusher uses for pushes with an empty body.
const MAX_AGE_SECONDS = 300

export function createCloudStatusRoutes(config: {
  secret?: string
  getStatus: (appId: string) => Promise<CloudAppStatus>
  now?: () => number
}) {
  return new Elysia({name: 'cloud-status'}).get(
    '/api/cloud/apps/:app_id/status',
    async ({params, request, set}) => {
      if (!config.secret) {
        set.status = 503
        return {error: 'Cloud status API not configured'}
      }
      const timestamp = request.headers.get('x-phala-timestamp') ?? ''
      const signature = request.headers.get('x-phala-signature') ?? ''
      const now = (config.now ?? Date.now)()
      if (
        !/^\d{1,12}$/.test(timestamp) ||
        !/^sha256=[0-9a-f]{64}$/.test(signature) ||
        Math.abs(now / 1000 - Number(timestamp)) > MAX_AGE_SECONDS
      ) {
        set.status = 401
        return {error: 'Invalid authentication'}
      }
      const expected = createHmac('sha256', config.secret)
        .update(`${timestamp}.`)
        .digest()
      if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) {
        set.status = 401
        return {error: 'Invalid authentication'}
      }

      const status = await config.getStatus(params.app_id)
      // Mirrors the public /app/[app-id] route: the page renders only when the
      // app is not hidden and at least one verification task has completed.
      const indexed = !status.hidden && status.hasCompletedTask

      return {
        app_id: params.app_id,
        present: status.present,
        indexed,
        listed: status.listed,
        deleted: status.deleted,
        page_url: `https://trust.phala.com/app/${params.app_id}`,
        last_indexed_at: status.lastIndexedAt,
        verification: {
          status: status.latestTask?.status ?? 'none',
          task_id: status.latestTask?.taskId ?? null,
          finished_at: status.latestTask?.finishedAt ?? null,
          error_message: status.latestTask?.errorMessage ?? null,
        },
      }
    },
  )
}
