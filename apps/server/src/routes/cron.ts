import {bearer} from '@elysiajs/bearer'
import {cron} from '@elysiajs/cron'
import {Elysia, t} from 'elysia'

import {env} from '../env'
import {getServices} from '../services'

export const cronRoutes = new Elysia()
  // Cleanup failed tasks cron - runs daily to clean up old failed/cancelled tasks
  .use(
    cron({
      name: 'cleanup-failed-tasks',
      pattern: env.CLEANUP_CRON_PATTERN,
      run: async () => {
        console.log('[CRON:CLEANUP] Running scheduled cleanup of failed tasks...')
        try {
          const services = getServices()
          const deletedCount = await services.verificationTask.cleanupFailedTasks(24)
          console.log(
            `[CRON:CLEANUP] Cleanup completed: ${deletedCount} old failed/cancelled tasks deleted`,
          )
        } catch (error) {
          console.error('[CRON:CLEANUP] Cleanup failed:', error)
        }
      },
    }),
  )
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
              const cleanupCron = store?.cron?.['cleanup-failed-tasks']
              const profilesCron = store?.cron?.['sync-profiles']
              const tasksCron = store?.cron?.['sync-tasks']

              return {
                success: true,
                crons: [
                  {
                    name: 'cleanup-failed-tasks',
                    pattern: env.CLEANUP_CRON_PATTERN,
                    description: 'Cleanup old failed/cancelled tasks (24h+)',
                    running: cleanupCron?.running ?? false,
                  },
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
              const cleanupCron = store?.cron?.['cleanup-failed-tasks']
              const profilesCron = store?.cron?.['sync-profiles']
              const tasksCron = store?.cron?.['sync-tasks']

              if (cleanupCron) cleanupCron.start()
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
              const cleanupCron = store?.cron?.['cleanup-failed-tasks']
              const profilesCron = store?.cron?.['sync-profiles']
              const tasksCron = store?.cron?.['sync-tasks']

              if (cleanupCron) cleanupCron.stop()
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
          )
          // Force refresh all apps - creates new verification tasks for all apps (bypasses 24h check)
          .post(
            '/force-refresh-apps',
            async () => {
              console.log('[CRON] Force refresh all apps triggered...')
              try {
                const services = getServices()
                if (!services.sync) {
                  return {
                    success: false,
                    error: 'Sync service not configured',
                  }
                }

                const result = await services.sync.forceRefreshAllApps()
                console.log(
                  `[CRON] Force refresh completed: ${result.tasksCreated} tasks created (bypassing 24h check)`,
                )

                return {
                  success: true,
                  message: `Successfully created ${result.tasksCreated} verification tasks (forced refresh, bypassing 24h duplicate check)`,
                  tasksCreated: result.tasksCreated,
                  appsProcessed: result.apps.length,
                }
              } catch (error) {
                console.error('[CRON] Force refresh failed:', error)
                const errorMessage =
                  error instanceof Error ? error.message : 'Unknown error'
                return {
                  success: false,
                  error: 'Force refresh failed',
                  message: errorMessage,
                }
              }
            },
            {
              detail: {
                summary:
                  'Force refresh all apps and create new verification tasks (bypasses 24h duplicate check)',
                tags: ['Cron'],
                security: [{bearerAuth: []}],
              },
            },
          ),
    ),
  )
