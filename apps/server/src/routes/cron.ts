import {bearer} from '@elysiajs/bearer'
import {cron} from '@elysiajs/cron'
import {Elysia, t} from 'elysia'

import {env} from '../env'
import {getServices} from '../services'

export const cronRoutes = new Elysia()
  .use(
    cron({
      name: 'sync-tasks',
      pattern: '0 0 * * *', // Every day at midnight
      run: async () => {
        console.log('[CRON] Running scheduled sync...')
        try {
          const services = getServices()
          if (!services.sync) {
            console.warn('[CRON] Sync service not configured, skipping...')
            return
          }
          const result = await services.sync.syncAllTasks()
          console.log(
            `[CRON] Sync completed: ${result.tasksCreated} tasks created`,
          )
        } catch (error) {
          console.error('[CRON] Sync failed:', error)
        }
      },
    }),
  )
  // Cron management endpoints (authentication required)
  .group('/cron', (app) =>
    app.use(bearer()).guard(
      {
        beforeHandle({bearer, set}) {
          if (!bearer || bearer !== env.CRON_API_KEY) {
            set.status = 401
            set.headers['WWW-Authenticate'] =
              'Bearer realm="cron", error="invalid_token"'
            return 'Unauthorized'
          }
        },
      },
      (app) =>
        app
          // Start cron
          .post(
            '/start',
            async ({error, store}: any) => {
              const syncCron = store?.cron?.['sync-tasks']
              if (syncCron) {
                syncCron.start()
                return {success: true, message: 'Cron started'}
              }

              return error(404, 'Cron not found')
            },
            {
              detail: {
                summary: 'Start the sync cron job',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Stop cron
          .post(
            '/stop',
            async ({error, store}: any) => {
              const syncCron = store?.cron?.['sync-tasks']
              if (syncCron) {
                syncCron.stop()
                return {success: true, message: 'Cron stopped'}
              }

              return error(404, 'Cron not found')
            },
            {
              detail: {
                summary: 'Stop the sync cron job',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Get cron status
          .get(
            '/status',
            async ({error, store}: any) => {
              const syncCron = store?.cron?.['sync-tasks']
              if (syncCron) {
                return {
                  success: true,
                  name: 'sync-tasks',
                  pattern: '0 */1 * * *',
                  running: syncCron.running,
                }
              }

              return error(404, 'Cron not found')
            },
            {
              detail: {
                summary: 'Get cron job status',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Trigger cron manually
          .post(
            '/trigger',
            async ({error, store}: any) => {
              const syncCron = store?.cron?.['sync-tasks']
              if (syncCron) {
                await syncCron.trigger()
                return {success: true, message: 'Cron triggered'}
              }

              return error(404, 'Cron not found')
            },
            {
              detail: {
                summary: 'Manually trigger the sync cron job',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          ),
    ),
  )
