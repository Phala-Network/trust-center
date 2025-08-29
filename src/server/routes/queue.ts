import { Elysia, t } from 'elysia'

import { getServices } from '../services'

// Pure response builders
const buildSuccessResponse = <T>(data: T) => ({
  success: true as const,
  ...data,
})

// Pure handler functions
const handleQueueStatus = async () => {
  const services = getServices()
  const stats = await services.queue.getStats()
  return buildSuccessResponse({ queue: stats })
}

const handleJobDetails = async (jobId: string) => {
  const services = getServices()
  const job = await services.queue.getJob(jobId)

  if (!job) {
    throw new Error('Job not found')
  }

  return buildSuccessResponse({ job })
}

const handleJobRetry = async (jobId: string) => {
  const services = getServices()
  const result = await services.queue.retryJob(jobId)

  if (!result) {
    throw new Error('Job not found or cannot be retried')
  }

  return buildSuccessResponse({ message: 'Job retried successfully' })
}

const handleJobRemoval = async (jobId: string) => {
  const services = getServices()
  const result = await services.queue.removeJob(jobId)

  if (!result) {
    throw new Error('Job not found')
  }

  return buildSuccessResponse({ message: 'Job removed successfully' })
}

const handleQueuePause = async () => {
  const services = getServices()
  await services.queue.pause()
  return buildSuccessResponse({ message: 'Queue paused successfully' })
}

const handleQueueResume = async () => {
  const services = getServices()
  await services.queue.resume()
  return buildSuccessResponse({ message: 'Queue resumed successfully' })
}

const handleQueueClean = async (query: {
  grace?: number
  status?: 'completed' | 'failed' | 'delayed'
  limit?: number
}) => {
  const services = getServices()
  const cleaned = await services.queue.clean({
    grace: query.grace || 1000 * 60 * 60, // 1 hour default
    status: query.status || 'completed',
    limit: query.limit || 100,
  })

  return buildSuccessResponse({
    message: `Cleaned ${cleaned} jobs`,
    cleanedCount: cleaned,
  })
}

export const queueRoutes = new Elysia({ tags: ['queue'] })
  .get(
    '/status',
    async () => {
      try {
        return await handleQueueStatus()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      response: t.Object({
        success: t.Boolean(),
        queue: t.Optional(
          t.Object({
            waiting: t.Number(),
            active: t.Number(),
            completed: t.Number(),
            failed: t.Number(),
            delayed: t.Optional(t.Number()),
            paused: t.Optional(t.Boolean()),
          }),
        ),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get queue status',
        description: 'Retrieve current queue statistics and status',
      },
    },
  )

  .get(
    '/jobs/:jobId',
    async ({ params }) => {
      try {
        return await handleJobDetails(params.jobId)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        job: t.Optional(
          t.Object({
            id: t.Optional(t.String()),
            name: t.Optional(t.String()),
            data: t.Any(),
            progress: t.Optional(t.Any()),
            processedOn: t.Optional(t.Number()),
            finishedOn: t.Optional(t.Number()),
            failedReason: t.Optional(t.String()),
            returnvalue: t.Optional(t.Any()),
            opts: t.Any(),
            attemptsMade: t.Optional(t.Number()),
          }),
        ),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Get job details',
        description: 'Retrieve details of a specific queue job',
      },
    },
  )

  .post(
    '/jobs/:jobId/retry',
    async ({ params }) => {
      try {
        return await handleJobRetry(params.jobId)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Retry failed job',
        description: 'Retry a failed or stalled queue job',
      },
    },
  )

  .delete(
    '/jobs/:jobId',
    async ({ params }) => {
      try {
        return await handleJobRemoval(params.jobId)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Remove job',
        description: 'Remove a job from the queue',
      },
    },
  )

  .post(
    '/pause',
    async () => {
      try {
        return await handleQueuePause()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Pause queue',
        description: 'Pause the verification queue',
      },
    },
  )

  .post(
    '/resume',
    async () => {
      try {
        return await handleQueueResume()
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Resume queue',
        description: 'Resume the paused verification queue',
      },
    },
  )

  .post(
    '/clean',
    async ({ query }) => {
      try {
        return await handleQueueClean(query)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Operation failed'
        throw new Error(message)
      }
    },
    {
      query: t.Object({
        grace: t.Optional(t.Number({ minimum: 0 })),
        status: t.Optional(
          t.Union([
            t.Literal('completed'),
            t.Literal('failed'),
            t.Literal('delayed'),
          ]),
        ),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
      }),
      response: t.Object({
        success: t.Boolean(),
        message: t.Optional(t.String()),
        cleanedCount: t.Optional(t.Number()),
        error: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Clean queue',
        description: 'Clean completed, failed, or stalled jobs from the queue',
      },
    },
  )
