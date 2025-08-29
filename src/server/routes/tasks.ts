import { Elysia, t } from 'elysia'

import type { VerifierType } from '../db'
import { getServices } from '../services/index'

// Types
interface TaskCreateRequest {
  appId: string
  appName: string
  verifierType: VerifierType
  config?: Record<string, unknown>
  flags?: Record<string, boolean>
  metadata?: Record<string, unknown>
}

interface TaskStatusResponse {
  taskId: string
  appId: string
  appName: string
  verifierType: string
  status: string
  bullJobId?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  errorMessage?: string
  payload: string // JSON string
}

interface BatchCreateRequest {
  tasks: TaskCreateRequest[]
}

interface TaskListQuery {
  status?: string
  appId?: string
  appName?: string
  verifierType?: string
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

// Helper function to build task status response
const buildTaskStatusResponse = (
  task: Record<string, unknown>,
): TaskStatusResponse => ({
  taskId: task.id as string,
  appId: task.appId as string,
  appName: task.appName as string,
  verifierType: task.verifierType as string,
  status: task.status as string,
  bullJobId: task.bullJobId as string | undefined,
  createdAt: task.createdAt as string,
  startedAt: task.startedAt as string | undefined,
  finishedAt: task.finishedAt as string | undefined,
  errorMessage: task.errorMessage as string | undefined,
  payload: task.payload as string, // This is already a JSON string
})

// Route handlers
const handleTaskCreation = async (body: TaskCreateRequest) => {
  const services = getServices()
  const taskId = await services.queue.addTask({
    appId: body.appId,
    appName: body.appName,
    verifierType: body.verifierType,
    config: body.config,
    flags: body.flags,
    metadata: body.metadata,
  })

  return {
    success: true,
    taskId,
    message: 'Task created successfully',
  }
}

const handleBatchCreation = async (body: BatchCreateRequest) => {
  const services = getServices()
  const results = await Promise.allSettled(
    body.tasks.map((task) =>
      services.queue.addTask({
        appId: task.appId,
        appName: task.appName,
        verifierType: task.verifierType,
        config: task.config,
        flags: task.flags,
        metadata: task.metadata,
      }),
    ),
  )

  const successful = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return {
    success: true,
    message: `Batch creation completed. ${successful} successful, ${failed} failed.`,
    results: results.map((r, i) => ({
      index: i,
      success: r.status === 'fulfilled',
      taskId: r.status === 'fulfilled' ? r.value : null,
      error: r.status === 'rejected' ? r.reason : null,
    })),
  }
}

const handleTaskStatus = async (taskId: string) => {
  const services = getServices()
  const task = await services.verificationTask.getVerificationTask(taskId)

  if (!task) {
    return {
      success: false,
      error: 'Task not found',
    }
  }

  return {
    success: true,
    task: buildTaskStatusResponse(task),
  }
}

const handleTasksList = async (query: TaskListQuery) => {
  const services = getServices()
  const result = await services.verificationTask.listVerificationTasks({
    status: query.status as import('../db').VerificationTaskStatus | undefined,
    appId: query.appId,
    appName: query.appName,
    verifierType: query.verifierType as VerifierType | undefined,
    fromDate: query.fromDate,
    toDate: query.toDate,
    page: query.page,
    limit: query.limit,
  })

  return {
    success: true,
    data: result.data.map(buildTaskStatusResponse),
    pagination: {
      total: result.total,
      page: query.page || 1,
      limit: query.limit || 50,
      hasNext: result.hasNext,
    },
  }
}

const handleTaskCancellation = async (taskId: string) => {
  const services = getServices()

  // Get the task first
  const task = await services.verificationTask.getVerificationTask(taskId)
  if (!task) {
    return {
      success: false,
      error: 'Task not found',
    }
  }

  // Cancel the BullMQ job if it exists
  if (task.bullJobId) {
    await services.queue.removeJob(task.bullJobId)
  }

  // Update PostgreSQL task status
  await services.verificationTask.updateVerificationTask(taskId, {
    status: 'failed',
    errorMessage: 'Task cancelled by user',
    finishedAt: new Date(),
  })

  return {
    success: true,
    message: 'Task cancelled successfully',
  }
}

const handleTaskStats = async () => {
  const services = getServices()
  const stats = await services.verificationTask.getVerificationTaskStats()

  return {
    success: true,
    stats,
  }
}

// Task routes
export const taskRoutes = new Elysia({ tags: ['tasks'] })
  .post(
    '/',
    async ({ body, set }) => {
      try {
        const result = await handleTaskCreation(body as TaskCreateRequest)
        if (result.success) {
          return {
            success: true as const,
            taskId: result.taskId,
            message: result.message,
          }
        } else {
          return {
            success: false as const,
            error: (result as { error?: string }).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to create task',
        }
      }
    },
    {
      body: t.Object({
        appId: t.String(),
        appName: t.String(),
        verifierType: t.Union([
          t.Literal('kms'),
          t.Literal('gateway'),
          t.Literal('redpill'),
        ]),
        config: t.Optional(t.Record(t.String(), t.Unknown())),
        flags: t.Optional(t.Record(t.String(), t.Unknown())),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          taskId: t.String(),
          message: t.String(),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      ]),
    },
  )
  .post(
    '/batch',
    async ({ body, set }) => {
      try {
        const result = await handleBatchCreation(body as BatchCreateRequest)
        if (result.success) {
          return {
            success: true as const,
            message: result.message,
            results: result.results,
          }
        } else {
          return {
            success: false as const,
            error: (result as { error?: string }).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to create batch tasks',
        }
      }
    },
    {
      body: t.Object({
        tasks: t.Array(
          t.Object({
            appId: t.String(),
            appName: t.String(),
            verifierType: t.Union([
              t.Literal('kms'),
              t.Literal('gateway'),
              t.Literal('redpill'),
            ]),
            config: t.Optional(t.Record(t.String(), t.Unknown())),
            flags: t.Optional(t.Record(t.String(), t.Unknown())),
            metadata: t.Optional(t.Record(t.String(), t.Unknown())),
          }),
        ),
      }),
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          message: t.String(),
          results: t.Array(
            t.Object({
              index: t.Number(),
              success: t.Boolean(),
              taskId: t.Union([t.String(), t.Null()]),
              error: t.Union([t.String(), t.Null()]),
            }),
          ),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      ]),
    },
  )
  .get(
    '/:taskId',
    async ({ params, set }) => {
      try {
        const result = await handleTaskStatus(params.taskId)
        return result
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to get task status',
        }
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Object({
        success: t.Boolean(),
        task: t.Optional(
          t.Object({
            taskId: t.String(),
            appId: t.String(),
            appName: t.String(),
            verifierType: t.String(),
            status: t.String(),
            bullJobId: t.Optional(t.String()),
            createdAt: t.String(),
            startedAt: t.Optional(t.String()),
            finishedAt: t.Optional(t.String()),
            errorMessage: t.Optional(t.String()),
            payload: t.String(), // JSON string
          }),
        ),
        error: t.Optional(t.String()),
      }),
    },
  )
  .get(
    '/',
    async ({ query, set }) => {
      try {
        const result = await handleTasksList(query as TaskListQuery)
        if (result.success) {
          return {
            success: true as const,
            data: result.data,
            pagination: result.pagination,
          }
        } else {
          return {
            success: false as const,
            error: (result as { error?: string }).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to list tasks',
        }
      }
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        appId: t.Optional(t.String()),
        appName: t.Optional(t.String()),
        verifierType: t.Optional(t.String()),
        fromDate: t.Optional(t.String()),
        toDate: t.Optional(t.String()),
        page: t.Optional(t.Number()),
        limit: t.Optional(t.Number()),
      }),
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          data: t.Array(
            t.Object({
              taskId: t.String(),
              appId: t.String(),
              appName: t.String(),
              verifierType: t.String(),
              status: t.String(),
              bullJobId: t.Optional(t.String()),
              createdAt: t.String(),
              startedAt: t.Optional(t.String()),
              finishedAt: t.Optional(t.String()),
              errorMessage: t.Optional(t.String()),
              payload: t.String(), // JSON string
            }),
          ),
          pagination: t.Object({
            total: t.Number(),
            page: t.Number(),
            limit: t.Number(),
            hasNext: t.Boolean(),
          }),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      ]),
    },
  )
  .get(
    '/stats/summary',
    async ({ set }) => {
      try {
        const result = await handleTaskStats()
        if (result.success) {
          return { success: true as const, stats: result.stats }
        } else {
          return {
            success: false as const,
            error: (result as { error?: string }).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to get task statistics',
        }
      }
    },
    {
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          stats: t.Object({
            total: t.Number(),
            pending: t.Number(),
            active: t.Number(),
            completed: t.Number(),
            failed: t.Number(),
          }),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      ]),
    },
  )
  .delete(
    '/:taskId',
    async ({ params, set }) => {
      try {
        const result = await handleTaskCancellation(params.taskId)
        if (result.success) {
          return {
            success: true as const,
            message: result.message || 'Task cancelled successfully',
          }
        } else {
          return {
            success: false as const,
            error: (result as { error?: string }).error || 'Unknown error',
          }
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to cancel task',
        }
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          message: t.String(),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      ]),
    },
  )
  .get(
    '/:taskId/result',
    async ({ params, set }) => {
      try {
        const services = getServices()
        const task = await services.verificationTask.getVerificationTask(
          params.taskId,
        )

        if (!task) {
          set.status = 404
          return {
            success: false,
            error: 'Task not found',
          }
        }

        if (task.status !== 'completed') {
          set.status = 400
          return {
            success: false,
            error: 'Task not completed yet',
          }
        }

        if (!task.r2Key) {
          set.status = 404
          return {
            success: false,
            error: 'Task result not found in storage',
          }
        }

        // Return R2 storage information for client to fetch
        return {
          success: true as const,
          storageInfo: {
            r2Key: task.r2Key,
            r2Bucket: task.r2Bucket || '',
            fileName: task.fileName || undefined,
            message:
              'Task completed. Use storage information to fetch result from R2.',
          },
        }
      } catch (error) {
        set.status = 500
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to get task result',
        }
      }
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
      response: t.Union([
        t.Object({
          success: t.Literal(true),
          storageInfo: t.Object({
            r2Key: t.String(),
            r2Bucket: t.String(),
            fileName: t.Optional(t.String()),
            fileSize: t.Optional(t.Number()),
            message: t.String(),
          }),
        }),
        t.Object({
          success: t.Literal(false),
          error: t.String(),
        }),
      ]),
    },
  )
