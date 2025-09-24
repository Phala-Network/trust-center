import { Elysia } from 'elysia'
import { z } from 'zod'

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

export const queueRoutes = new Elysia({ tags: ['Queue'] })
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
      response: z.object({
        success: z.boolean(),
        queue: z
          .object({
            waiting: z.number(),
            active: z.number(),
            completed: z.number(),
            failed: z.number(),
            delayed: z.number().optional(),
            paused: z.boolean().optional(),
          })
          .optional(),
        error: z.string().optional(),
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
      params: z.object({
        jobId: z.string(),
      }),
      response: z.object({
        success: z.boolean(),
        job: z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
            data: z.any(),
            progress: z.any().optional(),
            processedOn: z.number().optional(),
            finishedOn: z.number().optional(),
            failedReason: z.string().optional(),
            returnvalue: z.any().optional(),
            opts: z.any(),
            attemptsMade: z.number().optional(),
          })
          .optional(),
        error: z.string().optional(),
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
      params: z.object({
        jobId: z.string(),
      }),
      response: z.object({
        success: z.boolean(),
        message: z.string().optional(),
        error: z.string().optional(),
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
      params: z.object({
        jobId: z.string(),
      }),
      response: z.object({
        success: z.boolean(),
        message: z.string().optional(),
        error: z.string().optional(),
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
      response: z.object({
        success: z.boolean(),
        message: z.string().optional(),
        error: z.string().optional(),
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
      response: z.object({
        success: z.boolean(),
        message: z.string().optional(),
        error: z.string().optional(),
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
      query: z.object({
        grace: z.number().min(0).optional(),
        status: z
          .union([
            z.literal('completed'),
            z.literal('failed'),
            z.literal('delayed'),
          ])
          .optional(),
        limit: z.number().min(1).max(1000).optional(),
      }),
      response: z.object({
        success: z.boolean(),
        message: z.string().optional(),
        cleanedCount: z.number().optional(),
        error: z.string().optional(),
      }),
      detail: {
        summary: 'Clean queue',
        description: 'Clean completed, failed, or stalled jobs from the queue',
      },
    },
  )
