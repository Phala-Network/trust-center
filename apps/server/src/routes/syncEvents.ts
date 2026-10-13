import {Elysia} from 'elysia'
import {z} from 'zod'
import {timingSafeEqual} from 'node:crypto'

import type {SyncEventService} from '../services/syncEventService'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  source: z.enum(['push', 'cron-profiles', 'cron-apps']).optional(),
  result: z.enum(['pending', 'success', 'error']).optional(),
})

export function createSyncEventsRoutes(config: {
  apiKey: string
  events: Pick<SyncEventService, 'list'>
}) {
  return new Elysia({name: 'private-sync-events'}).get(
    '/cron/sync-events',
    async ({request, set}) => {
      const actual = Buffer.from(request.headers.get('authorization') ?? '')
      const expected = Buffer.from(`Bearer ${config.apiKey}`)
      if (
        !config.apiKey ||
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      ) {
        set.status = 401
        set.headers['WWW-Authenticate'] = 'Bearer realm="cron"'
        return {error: 'Unauthorized'}
      }
      const query = querySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams),
      )
      if (!query.success) {
        set.status = 400
        return {error: 'Invalid audit query'}
      }
      return {success: true, events: await config.events.list(query.data)}
    },
  )
}
