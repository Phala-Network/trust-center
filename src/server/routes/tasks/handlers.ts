import type { VerificationFlags as ConfigVerificationFlags } from '../../../config'
import type { VerificationFlags as ApiVerificationFlags } from '../../../types'
import { getServices } from '../../services/index'
import { TASK_CONSTANTS } from './constants'
import type {
  BatchCreateRequest,
  ErrorResponse,
  StorageInfoResponse,
  SuccessResponse,
  TaskCreateRequest,
  TaskDetailResponse,
  TaskListQuery,
  TaskListResponse,
  TaskStatsResponse,
} from './types'
import {
  createErrorResponse,
  sanitizeKeyword,
  validatePaginationParams,
  validateSortParams,
} from './utils'

// Helper function to convert API VerificationFlags to Config VerificationFlags
const convertVerificationFlags = (
  flags: ApiVerificationFlags,
): ConfigVerificationFlags => ({
  hardware: flags.hardware ?? false,
  os: flags.os ?? false,
  sourceCode: flags.sourceCode ?? false,
  teeControlledKey: flags.teeControlledKey ?? false,
  certificateKey: flags.certificateKey ?? false,
  dnsCAA: flags.dnsCAA ?? false,
  ctLog: flags.ctLog ?? false,
})

// Task creation handler
export const handleTaskCreation = async (
  body: TaskCreateRequest,
): Promise<(SuccessResponse & { taskId?: string }) | ErrorResponse> => {
  try {
    const services = getServices()
    const taskId = await services.queue.addTask({
      appId: body.appId,
      appName: body.appName,
      appConfigType: body.appConfigType,
      contractAddress: body.contractAddress,
      modelOrDomain: body.modelOrDomain,
      appMetadata: body.appMetadata,
      verificationFlags: convertVerificationFlags(body.verificationFlags),
    })

    return {
      success: true,
      message: `Task created successfully with ID: ${taskId}`,
      taskId,
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to create task')
  }
}

// Batch task creation handler
export const handleBatchCreation = async (
  body: BatchCreateRequest,
): Promise<SuccessResponse | ErrorResponse> => {
  try {
    const services = getServices()
    const results = []

    for (let i = 0; i < body.tasks.length; i++) {
      const task = body.tasks[i]
      if (!task) {
        results.push({
          index: i,
          success: false,
          taskId: null,
          error: 'Task data is missing',
        })
        continue
      }

      try {
        const taskId = await services.queue.addTask({
          appId: task.appId,
          appName: task.appName,
          appConfigType: task.appConfigType,
          contractAddress: task.contractAddress,
          modelOrDomain: task.modelOrDomain,
          appMetadata: task.appMetadata,
          verificationFlags: task.verificationFlags
            ? convertVerificationFlags(
                task.verificationFlags as ApiVerificationFlags,
              )
            : undefined,
        })
        results.push({ index: i, success: true, taskId, error: null })
      } catch (error) {
        results.push({
          index: i,
          success: false,
          taskId: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      success: true,
      message: `Batch creation completed. ${results.filter((r) => r.success).length}/${results.length} tasks created successfully.`,
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to create batch tasks')
  }
}

// Task status handler
export const handleTaskStatus = async (
  taskId: string,
): Promise<TaskDetailResponse> => {
  try {
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
      task: {
        id: task.id,
        appId: task.appId,
        appName: task.appName,
        appConfigType: task.appConfigType,
        contractAddress: task.contractAddress,
        modelOrDomain: task.modelOrDomain,
        verificationFlags: task.verificationFlags as
          | ApiVerificationFlags
          | undefined,
        status: task.status,
        errorMessage: task.errorMessage ?? undefined,
        s3Filename: task.s3Filename ?? undefined,
        s3Key: task.s3Key ?? undefined,
        s3Bucket: task.s3Bucket ?? undefined,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString(),
        finishedAt: task.finishedAt?.toISOString(),
      },
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to get task status')
  }
}

// Task list handler
export const handleTasksList = async (
  query: TaskListQuery,
): Promise<TaskListResponse | ErrorResponse> => {
  try {
    const services = getServices()

    // Validate and convert query parameters
    const status =
      query.status &&
      TASK_CONSTANTS.VALID_STATUSES.includes(query.status as never)
        ? query.status
        : undefined

    const appConfigType =
      query.appConfigType &&
      TASK_CONSTANTS.VALID_APP_CONFIG_TYPES.includes(
        query.appConfigType as never,
      )
        ? query.appConfigType
        : undefined

    // Validate pagination and sorting parameters
    const { page, limit } = validatePaginationParams(query.page, query.limit)
    const { sortBy, sortOrder } = validateSortParams(
      query.sortBy,
      query.sortOrder,
    )

    // Sanitize keyword input
    const sanitizedKeyword = sanitizeKeyword(query.keyword)

    const result = await services.verificationTask.listVerificationTasks({
      status: status as never,
      appId: query.appId,
      appName: query.appName,
      appConfigType: appConfigType as never,
      contractAddress: query.contractAddress,
      keyword: sanitizedKeyword,
      sortBy,
      sortOrder,
      page,
      limit,
    })

    return {
      success: true,
      data: result.data.map((task) => ({
        id: task.id,
        appId: task.appId,
        appName: task.appName,
        appConfigType: task.appConfigType,
        contractAddress: task.contractAddress,
        modelOrDomain: task.modelOrDomain,
        verificationFlags: task.verificationFlags as
          | ApiVerificationFlags
          | undefined,
        status: task.status,
        errorMessage: task.errorMessage ?? undefined,
        s3Filename: task.s3Filename ?? undefined,
        s3Key: task.s3Key ?? undefined,
        s3Bucket: task.s3Bucket ?? undefined,
        createdAt: task.createdAt.toISOString(),
        startedAt: task.startedAt?.toISOString(),
        finishedAt: task.finishedAt?.toISOString(),
      })),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasNext: result.hasNext,
      },
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to list tasks')
  }
}

// Task cancellation handler
export const handleTaskCancellation = async (
  _taskId: string,
): Promise<SuccessResponse | ErrorResponse> => {
  try {
    // For now, we'll just return success as cancellation is not implemented
    // TODO: Implement actual task cancellation logic
    return {
      success: true,
      message: 'Task cancellation requested (not yet implemented)',
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to cancel task')
  }
}

// Task stats handler
export const handleTaskStats = async (): Promise<
  TaskStatsResponse | ErrorResponse
> => {
  try {
    const services = getServices()
    const stats = await services.verificationTask.getVerificationTaskStats()

    return {
      success: true,
      stats: {
        total: stats.total,
        pending: stats.pending,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
      },
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to get task stats')
  }
}

// Task result handler
export const handleTaskResult = async (
  taskId: string,
): Promise<StorageInfoResponse | ErrorResponse> => {
  try {
    const services = getServices()
    const task = await services.verificationTask.getVerificationTask(taskId)

    if (!task) {
      return {
        success: false,
        error: 'Task not found',
      }
    }

    if (task.status !== 'completed') {
      return {
        success: false,
        error: 'Task not completed yet',
      }
    }

    if (!task.s3Key) {
      return {
        success: false,
        error: 'Task result not found in storage',
      }
    }

    // Return S3-compatible storage information for client to fetch
    return {
      success: true,
      storageInfo: {
        s3Key: task.s3Key,
        s3Bucket: task.s3Bucket || '',
        s3Filename: task.s3Filename || undefined,
        fileSize: undefined, // Could be added if needed
        message: 'Task result available for download',
      },
    }
  } catch (error) {
    return createErrorResponse(error, 'Failed to get task result')
  }
}
