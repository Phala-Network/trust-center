import { Elysia, t } from 'elysia'

import type { VerificationFlags } from '../../config'
import type { AppMetadata } from '../../types'
import type { AppConfigType, VerificationTaskStatus } from '../db/schema'
import { getServices } from '../services/index'

// Validation schemas for structured types
const OSSourceInfoSchema = t.Object({
  github_repo: t.String(),
  git_commit: t.String(),
  version: t.String(),
})

const AppSourceInfoSchema = t.Object({
  github_repo: t.String(),
  git_commit: t.String(),
  version: t.String(),
  model_name: t.Optional(t.String()),
})

const HardwareInfoSchema = t.Object({
  cpuManufacturer: t.String(),
  cpuModel: t.String(),
  securityFeature: t.String(),
  hasNvidiaSupport: t.Optional(t.Boolean()),
})

const GovernanceInfoSchema = t.Object({
  blockchain: t.String(),
  blockchainExplorerUrl: t.String(),
  chainId: t.Optional(t.Number()),
})

const AppMetadataSchema = t.Object({
  osSource: OSSourceInfoSchema,
  appSource: t.Optional(AppSourceInfoSchema),
  hardware: HardwareInfoSchema,
  governance: t.Optional(GovernanceInfoSchema),
})

const VerificationFlagsSchema = t.Object({
  hardware: t.Boolean(),
  os: t.Boolean(),
  sourceCode: t.Boolean(),
  teeControlledKey: t.Boolean(),
  certificateKey: t.Boolean(),
  dnsCAA: t.Boolean(),
  ctLog: t.Boolean(),
})

// Types
interface TaskCreateRequest {
  appId: string
  appName: string
  appConfigType: AppConfigType
  contractAddress: string
  modelOrDomain: string
  appMetadata?: AppMetadata
  verificationFlags?: VerificationFlags
}

interface TaskStatusResponse {
  taskId: string
  appId: string
  appName: string
  appConfigType: string
  contractAddress: string
  modelOrDomain: string
  appMetadata?: AppMetadata
  verificationFlags?: VerificationFlags
  status: string
  bullJobId?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  errorMessage?: string
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
}

interface BatchCreateRequest {
  tasks: TaskCreateRequest[]
}

interface TaskListQuery {
  status?: string
  appId?: string
  appName?: string
  appConfigType?: string
  contractAddress?: string
  modelOrDomain?: string
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
  appConfigType: task.appConfigType as string,
  contractAddress: task.contractAddress as string,
  modelOrDomain: task.modelOrDomain as string,
  appMetadata: task.appMetadata as AppMetadata | undefined,
  verificationFlags: task.verificationFlags as VerificationFlags | undefined,
  status: task.status as string,
  bullJobId: task.bullJobId as string | undefined,
  createdAt: task.createdAt as string,
  startedAt: task.startedAt as string | undefined,
  finishedAt: task.finishedAt as string | undefined,
  errorMessage: task.errorMessage as string | undefined,
  s3Filename: task.s3Filename as string | undefined,
  s3Key: task.s3Key as string | undefined,
  s3Bucket: task.s3Bucket as string | undefined,
})

// Route handlers
const handleTaskCreation = async (body: TaskCreateRequest) => {
  const services = getServices()
  const taskId = await services.queue.addTask({
    appId: body.appId,
    appName: body.appName,
    appConfigType: body.appConfigType,
    contractAddress: body.contractAddress,
    modelOrDomain: body.modelOrDomain,
    appMetadata: body.appMetadata,
    verificationFlags: body.verificationFlags,
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
        appConfigType: task.appConfigType,
        contractAddress: task.contractAddress,
        modelOrDomain: task.modelOrDomain,
        appMetadata: task.appMetadata,
        verificationFlags: task.verificationFlags,
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
    status: query.status as VerificationTaskStatus | undefined,
    appId: query.appId,
    appName: query.appName,
    appConfigType: query.appConfigType as AppConfigType | undefined,
    contractAddress: query.contractAddress,
    modelOrDomain: query.modelOrDomain,
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
export const taskRoutes = new Elysia({ tags: ['Tasks'] })
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
        appConfigType: t.Union([
          t.Literal('redpill'),
          t.Literal('phala_cloud'),
        ]),
        contractAddress: t.String(),
        modelOrDomain: t.String(),
        appMetadata: t.Optional(AppMetadataSchema),
        verificationFlags: t.Optional(VerificationFlagsSchema),
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
            appConfigType: t.Union([
              t.Literal('redpill'),
              t.Literal('phala_cloud'),
            ]),
            contractAddress: t.String(),
            modelOrDomain: t.String(),
            appMetadata: t.Optional(AppMetadataSchema),
            verificationFlags: t.Optional(VerificationFlagsSchema),
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
            appConfigType: t.String(),
            contractAddress: t.String(),
            modelOrDomain: t.String(),
            appMetadata: t.Optional(AppMetadataSchema),
            verificationFlags: t.Optional(VerificationFlagsSchema),
            status: t.String(),
            bullJobId: t.Optional(t.String()),
            createdAt: t.String(),
            startedAt: t.Optional(t.String()),
            finishedAt: t.Optional(t.String()),
            errorMessage: t.Optional(t.String()),
            s3Filename: t.Optional(t.String()),
            s3Key: t.Optional(t.String()),
            s3Bucket: t.Optional(t.String()),
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
        appConfigType: t.Optional(t.String()),
        contractAddress: t.Optional(t.String()),
        modelOrDomain: t.Optional(t.String()),
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
              appConfigType: t.String(),
              contractAddress: t.String(),
              modelOrDomain: t.String(),
              appMetadata: t.Optional(AppMetadataSchema),
              verificationFlags: t.Optional(VerificationFlagsSchema),
              status: t.String(),
              bullJobId: t.Optional(t.String()),
              createdAt: t.String(),
              startedAt: t.Optional(t.String()),
              finishedAt: t.Optional(t.String()),
              errorMessage: t.Optional(t.String()),
              s3Filename: t.Optional(t.String()),
              s3Key: t.Optional(t.String()),
              s3Bucket: t.Optional(t.String()),
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

        if (!task.s3Key) {
          set.status = 404
          return {
            success: false,
            error: 'Task result not found in storage',
          }
        }

        // Return S3-compatible storage information for client to fetch
        return {
          success: true as const,
          storageInfo: {
            s3Key: task.s3Key,
            s3Bucket: task.s3Bucket || '',
            s3Filename: task.s3Filename || undefined,
            message:
              'Task completed. Use storage information to fetch result from S3-compatible storage.',
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
            s3Key: t.String(),
            s3Bucket: t.String(),
            s3Filename: t.Optional(t.String()),
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
