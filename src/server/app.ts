import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'

import { healthRoutes } from './routes/health'
import { queueRoutes } from './routes/queue'
import { taskRoutes } from './routes/tasks'

// Pure configuration objects
const corsConfig = {
  origin: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}

const swaggerConfig = {
  documentation: {
    info: {
      title: 'DStack Verifier API',
      version: '1.0.0',
      description: 'TEE Attestation Verification Service with Queue Management',
    },
    tags: [
      { name: 'health', description: 'Health check endpoints' },
      { name: 'tasks', description: 'Verification task management' },
      { name: 'queue', description: 'Queue status and management' },
    ],
  },
}

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

// Functional plugin composition
const withCors = (app: Elysia) => app.use(cors(corsConfig))
const withSwagger = (app: Elysia) => app.use(swagger(swaggerConfig))
const withRoutes = (app: Elysia) =>
  app
    .group('/health', (app) => app.use(healthRoutes))
    .group('/api/v1', (app) =>
      app
        .group('/tasks', (app) => app.use(taskRoutes))
        .group('/queue', (app) => app.use(queueRoutes)),
    )

const withErrorHandler = (app: Elysia) =>
  app.onError(({ code, error, set }) => {
    console.error('[ERROR]', code, error)
    const response = mapErrorResponse(code, error)
    set.status = response.status
    return response.body
  })

// Functional composition pipeline
const compose =
  (...fns: Array<(app: Elysia) => Elysia>) =>
  (app: Elysia) =>
    fns.reduce((acc, fn) => fn(acc), app)

const appPipeline = compose(withCors, withSwagger, withRoutes, withErrorHandler)

// Pure app factory
export const createApp = (): Elysia => appPipeline(new Elysia())
