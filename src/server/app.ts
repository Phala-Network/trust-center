import { openapi } from '@elysiajs/openapi'
import { Elysia } from 'elysia'

import { authMiddleware } from './plugin/auth'
import { healthRoutes } from './routes/health'
import { queueRoutes } from './routes/queue'
import { taskRoutes } from './routes/tasks'

// Pure error mapping function
const mapErrorResponse = (code: string | number, error: unknown) => {
  const codeStr = String(code)
  const errorMap = {
    VALIDATION: { status: 400, error: 'Validation failed' },
    NOT_FOUND: { status: 404, error: 'Not found' },
    DEFAULT: { status: 500, error: 'Internal server error' },
  } as const

  const response =
    errorMap[codeStr as keyof typeof errorMap] || errorMap.DEFAULT
  const message =
    error instanceof Error
      ? error.message
      : error?.toString() || 'Unknown error'

  return {
    status: response.status,
    body: { error: response.error, message },
  }
}

// Pure app factory
export const createApp = () => {
  const app = new Elysia()
    .use(openapi())
    .group('/health', (app) => app.use(healthRoutes))
    .group('/api/v1', (app) =>
      app
        .group('/tasks', (app) => app.use(authMiddleware).use(taskRoutes))
        .group('/queue', (app) => app.use(authMiddleware).use(queueRoutes)),
    )
    .onError(({ code, error, set }) => {
      console.error('[ERROR]', code, error)
      const response = mapErrorResponse(code, error)
      set.status = response.status
      return response.body
    })

  return app
}
