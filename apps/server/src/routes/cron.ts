import {bearer} from '@elysiajs/bearer'
import {cron} from '@elysiajs/cron'
import {Elysia, t} from 'elysia'

import {env} from '../env'
import {getServices} from '../services'

export const cronRoutes = new Elysia()
  // Profile sync cron - configurable via PROFILE_CRON_PATTERN env
  // Profiles change less frequently than apps, so lower sync frequency is acceptable
  .use(
    cron({
      name: 'sync-profiles',
      pattern: env.PROFILE_CRON_PATTERN,
      run: async () => {
        console.log('[CRON:PROFILES] Running scheduled profile sync...')
        try {
          const services = getServices()
          if (!services.sync) {
            console.warn(
              '[CRON:PROFILES] Sync service not configured, skipping...',
            )
            return
          }

          const profilesResult = await services.sync.syncProfiles()
          console.log(
            `[CRON:PROFILES] Sync completed: ${profilesResult.profilesSynced} profiles synced`,
          )
        } catch (error) {
          console.error('[CRON:PROFILES] Sync failed:', error)
        }
      },
    }),
  )
  // App/Task sync cron - configurable via TASKS_CRON_PATTERN env
  // Apps and verification tasks need more frequent updates
  .use(
    cron({
      name: 'sync-tasks',
      pattern: env.TASKS_CRON_PATTERN,
      run: async () => {
        console.log('[CRON:TASKS] Running scheduled app sync...')
        try {
          const services = getServices()
          if (!services.sync) {
            console.warn('[CRON:TASKS] Sync service not configured, skipping...')
            return
          }

          const tasksResult = await services.sync.syncAllTasks()
          console.log(
            `[CRON:TASKS] Sync completed: ${tasksResult.tasksCreated} tasks created`,
          )
        } catch (error) {
          console.error('[CRON:TASKS] Sync failed:', error)
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
          // Get status of all crons
          .get(
            '/status',
            async ({store}: any) => {
              const profilesCron = store?.cron?.['sync-profiles']
              const tasksCron = store?.cron?.['sync-tasks']

              return {
                success: true,
                crons: [
                  {
                    name: 'sync-profiles',
                    pattern: env.PROFILE_CRON_PATTERN,
                    description: 'Profile synchronization',
                    running: profilesCron?.running ?? false,
                  },
                  {
                    name: 'sync-tasks',
                    pattern: env.TASKS_CRON_PATTERN,
                    description: 'App/Task synchronization',
                    running: tasksCron?.running ?? false,
                  },
                ],
              }
            },
            {
              detail: {
                summary: 'Get status of all cron jobs',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Start a specific cron
          .post(
            '/start/:name',
            async ({params, error, store}: any) => {
              const {name} = params
              const cron = store?.cron?.[name]

              if (!cron) {
                return error(404, `Cron '${name}' not found`)
              }

              cron.start()
              return {success: true, message: `Cron '${name}' started`}
            },
            {
              detail: {
                summary: 'Start a specific cron job',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Stop a specific cron
          .post(
            '/stop/:name',
            async ({params, error, store}: any) => {
              const {name} = params
              const cron = store?.cron?.[name]

              if (!cron) {
                return error(404, `Cron '${name}' not found`)
              }

              cron.stop()
              return {success: true, message: `Cron '${name}' stopped`}
            },
            {
              detail: {
                summary: 'Stop a specific cron job',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Trigger a specific cron manually
          .post(
            '/trigger/:name',
            async ({params, error, store}: any) => {
              const {name} = params
              const cron = store?.cron?.[name]

              if (!cron) {
                return error(404, `Cron '${name}' not found`)
              }

              await cron.trigger()
              return {success: true, message: `Cron '${name}' triggered`}
            },
            {
              detail: {
                summary: 'Manually trigger a specific cron job',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Start all crons
          .post(
            '/start-all',
            async ({store}: any) => {
              const profilesCron = store?.cron?.['sync-profiles']
              const tasksCron = store?.cron?.['sync-tasks']

              if (profilesCron) profilesCron.start()
              if (tasksCron) tasksCron.start()

              return {success: true, message: 'All crons started'}
            },
            {
              detail: {
                summary: 'Start all cron jobs',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          )
          // Stop all crons
          .post(
            '/stop-all',
            async ({store}: any) => {
              const profilesCron = store?.cron?.['sync-profiles']
              const tasksCron = store?.cron?.['sync-tasks']

              if (profilesCron) profilesCron.stop()
              if (tasksCron) tasksCron.stop()

              return {success: true, message: 'All crons stopped'}
            },
            {
              detail: {
                summary: 'Stop all cron jobs',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          ),
    ),
  )
