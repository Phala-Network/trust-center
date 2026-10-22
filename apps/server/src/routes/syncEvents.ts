import {Elysia} from 'elysia'
import {z} from 'zod'

import type {SyncEventService} from '../services/syncEventService'
import {createAdminAuth} from './adminAuth'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
  source: z.enum(['push', 'cron-profiles', 'cron-apps']).optional(),
  result: z.enum(['success', 'error']).optional(),
})

export function createSyncEventsRoutes(config: {
  apiKey: string
  events: Pick<SyncEventService, 'list'>
}) {
  const authorizeAdmin = createAdminAuth({apiKey: config.apiKey})
  return new Elysia({name: 'private-sync-events'}).get(
    '/cron/sync-events',
    async ({request, set}) => {
      const rejected = authorizeAdmin(request.headers.get('authorization'), set)
      if (rejected) return rejected
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
