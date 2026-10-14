import {openapi} from '@elysiajs/openapi'
import {Elysia} from 'elysia'
import z from 'zod'

import {env} from './env'
import {cronRoutes} from './routes/cron'
import {healthRoutes} from './routes/health'
import {createPhalaCloudWebhookRoutes} from './routes/phalaCloudWebhook'
import {createSyncEventsRoutes} from './routes/syncEvents'
import {getServices} from './services'

// Pure error mapping function
const mapErrorResponse = (code: string | number, error: unknown) => {
  const codeStr = String(code)
  const errorMap = {
    VALIDATION: {status: 400, error: 'Validation failed'},
    NOT_FOUND: {status: 404, error: 'Not found'},
    DEFAULT: {status: 500, error: 'Internal server error'},
  } as const

  const response =
    errorMap[codeStr as keyof typeof errorMap] || errorMap.DEFAULT
  const message =
    error instanceof Error
      ? error.message
      : error?.toString() || 'Unknown error'

  return {
    status: response.status,
    body: {error: response.error, message},
  }
}

// Pure app factory
export const createApp = () => {
  const app = new Elysia()
    .use(
      openapi({
        mapJsonSchema: {
          zod: z.toJSONSchema,
        },
      }),
    )
    .use(cronRoutes)
    .use(
      createPhalaCloudWebhookRoutes({
        secret: env.PHALA_CLOUD_API_KEY,
        ingest: (event) => getServices().ingest.ingest(event),
      }),
    )
    .use(
      createSyncEventsRoutes({
        apiKey: env.CRON_API_KEY,
        events: {list: (options) => getServices().syncEvents.list(options)},
      }),
    )
    .group('/health', (app) => app.use(healthRoutes))
    .onError(({code, error, set}) => {
      console.error('[ERROR]', code, error)
      const response = mapErrorResponse(code, error)
      set.status = response.status
      return response.body
    })

  return app
}
