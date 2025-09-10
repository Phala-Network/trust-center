import type { AppMetadata } from '../../../types'
import type {
  AppConfigType,
  VerificationTask,
  VerificationTaskStatus,
} from '../../db/schema'
import { getServices } from '../../services/index'
import { TASK_CONSTANTS } from './constants'
import type {
  BatchCreateRequest,
  TaskBatchCreateResponse,
  TaskCancelResponse,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskDeleteResponse,
  TaskDetailResponse,
  TaskListQuery,
  TaskListResponse,
  TaskResponse,
  TaskRetryResponse,
  TaskStatsResponse,
  VerificationFlags,
} from './schemas'
import {
  sanitizeKeyword,
  validatePaginationParams,
  validateSortParams,
} from './utils'

// Helper function to convert VerificationTask to TaskResponse
const convertTaskToResponse = (task: VerificationTask): TaskResponse => ({
  id: task.id,
  appId: task.appId,
  appName: task.appName,
  appConfigType: task.appConfigType,
  contractAddress: task.contractAddress,
  modelOrDomain: task.modelOrDomain,
  verificationFlags: task.verificationFlags as VerificationFlags | undefined,
  status: task.status,
  errorMessage: task.errorMessage ?? undefined,
  s3Filename: task.s3Filename ?? undefined,
  s3Key: task.s3Key ?? undefined,
  s3Bucket: task.s3Bucket ?? undefined,
  createdAt: task.createdAt.toISOString(),
  startedAt: task.startedAt?.toISOString(),
  finishedAt: task.finishedAt?.toISOString(),
})

// Helper function to create pagination object
const createPagination = (
  page: number,
  limit: number,
  total: number,
  hasNext: boolean,
): TaskListResponse['pagination'] => ({
  currentPage: page,
  perPage: limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext,
  hasPrev: page > 1,
})

// Task creation handler
export const handleTaskCreation = async (
  body: TaskCreateRequest,
): Promise<TaskCreateResponse> => {
  const services = getServices()
  const taskId = await services.queue.addTask({
    appId: body.appId,
    appName: body.appName,
    appConfigType: body.appConfigType,
    contractAddress: body.contractAddress,
    modelOrDomain: body.modelOrDomain,
    appMetadata: body.appConfig?.metadata,
    verificationFlags: body.flags,
  })

  return {
    taskId,
    message: `Task created successfully with ID: ${taskId}`,
  }
}

// Batch task creation handler
export const handleBatchCreation = async (
  body: BatchCreateRequest,
): Promise<TaskBatchCreateResponse> => {
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
        appMetadata: task.appConfig?.metadata,
        verificationFlags: task.flags,
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

  const successful = results.filter((r) => r.success).length
  const failed = results.length - successful

  return {
    total: body.tasks.length,
    successful,
    failed,
    results: results,
  }
}

// Task status handler
export const handleTaskStatus = async (
  taskId: string,
): Promise<TaskDetailResponse> => {
  const services = getServices()
  const task = await services.verificationTask.getVerificationTask(taskId)

  if (!task) {
    throw new Error(`Task with ID '${taskId}' not found`)
  }

  return {
    task: convertTaskToResponse(task),
  }
}

// Task list handler
export const handleTasksList = async (
  query: TaskListQuery,
): Promise<TaskListResponse> => {
  const services = getServices()

  // Validate and convert query parameters
  const status =
    query.status &&
    TASK_CONSTANTS.VALID_STATUSES.includes(
      query.status as VerificationTaskStatus,
    )
      ? (query.status as VerificationTaskStatus)
      : undefined

  const appConfigType =
    query.app_config_type &&
    TASK_CONSTANTS.VALID_APP_CONFIG_TYPES.includes(
      query.app_config_type as AppConfigType,
    )
      ? (query.app_config_type as AppConfigType)
      : undefined

  // Validate pagination and sorting parameters
  const { page, limit } = validatePaginationParams(query.page, query.per_page)
  const { sortBy, sortOrder } = validateSortParams(
    query.sort_by,
    query.sort_order,
  )

  // Sanitize keyword input
  const sanitizedKeyword = sanitizeKeyword(query.keyword)

  const result = await services.verificationTask.listVerificationTasks({
    status: status as VerificationTaskStatus | undefined,
    appId: query.app_id,
    appName: query.app_name,
    appConfigType: appConfigType as AppConfigType | undefined,
    contractAddress: query.contract_address,
    keyword: sanitizedKeyword,
    sortBy,
    sortOrder,
    page,
    limit,
  })

  return {
    tasks: result.data.map(convertTaskToResponse),
    pagination: createPagination(
      result.page,
      result.limit,
      result.total,
      result.hasNext,
    ),
  }
}

// Task cancellation handler
export const handleTaskCancellation = async (
  taskId: string,
): Promise<TaskCancelResponse> => {
  const services = getServices()

  // First, check if the task exists
  const task = await services.verificationTask.getVerificationTask(taskId)
  if (!task) {
    throw new Error(`Task with ID '${taskId}' not found`)
  }

  // Check if the task can be cancelled (only pending or active tasks can be cancelled)
  if (
    task.status === 'completed' ||
    task.status === 'failed' ||
    task.status === 'cancelled'
  ) {
    throw new Error(
      `Task with ID '${taskId}' cannot be cancelled. Current status: ${task.status}`,
    )
  }

  // If the task has a BullMQ job ID, remove it from the queue
  if (task.bullJobId) {
    const jobRemoved = await services.queue.removeJob(task.bullJobId)
    if (!jobRemoved) {
      console.warn(
        `Failed to remove job ${task.bullJobId} from queue for task ${taskId}`,
      )
    }
  }

  // Update the task status to cancelled
  await services.verificationTask.updateVerificationTask(taskId, {
    status: 'cancelled',
    finishedAt: new Date(),
  })

  return {
    taskId,
    message: `Task ${taskId} has been successfully cancelled`,
  }
}

// Task retry handler
export const handleTaskRetry = async (
  taskId: string,
): Promise<TaskRetryResponse> => {
  const services = getServices()

  // First, check if the task exists
  const task = await services.verificationTask.getVerificationTask(taskId)
  if (!task) {
    throw new Error(`Task with ID '${taskId}' not found`)
  }

  // Check if the task can be retried (only failed or cancelled tasks can be retried)
  if (
    task.status === 'pending' ||
    task.status === 'active' ||
    task.status === 'completed'
  ) {
    throw new Error(
      `Task with ID '${taskId}' cannot be retried. Current status: ${task.status}`,
    )
  }

  // If the task has a BullMQ job ID, try to retry the existing job first
  if (task.bullJobId) {
    const jobRetried = await services.queue.retryJob(task.bullJobId)
    if (jobRetried) {
      // Update the task status back to pending
      await services.verificationTask.updateVerificationTask(taskId, {
        status: 'pending',
        startedAt: undefined,
        finishedAt: undefined,
        errorMessage: undefined,
      })

      return {
        taskId,
        message: `Task ${taskId} has been successfully retried using existing job`,
      }
    }
  }

  // If retrying the existing job failed or there's no job ID, create a new job
  // First, reset the task status and clear previous execution data
  await services.verificationTask.updateVerificationTask(taskId, {
    status: 'pending',
    startedAt: undefined,
    finishedAt: undefined,
    errorMessage: undefined,
    s3Filename: undefined,
    s3Key: undefined,
    s3Bucket: undefined,
    bullJobId: undefined,
  })

  // Add the task back to the queue
  await services.queue.addExistingTask({
    postgresTaskId: taskId,
    appId: task.appId,
    appName: task.appName,
    appConfigType: task.appConfigType,
    contractAddress: task.contractAddress,
    modelOrDomain: task.modelOrDomain,
    appMetadata: task.appMetadata as AppMetadata | undefined,
    verificationFlags: task.verificationFlags as
      | Partial<VerificationFlags>
      | undefined,
  })

  return {
    taskId,
    message: `Task ${taskId} has been successfully retried with a new job`,
  }
}

// Task delete handler
export const handleTaskDelete = async (
  taskId: string,
): Promise<TaskDeleteResponse> => {
  const services = getServices()

  // First, check if the task exists
  const task = await services.verificationTask.getVerificationTask(taskId)
  if (!task) {
    throw new Error(`Task with ID '${taskId}' not found`)
  }

  // All task statuses can be deleted - no restrictions

  // If the task has a BullMQ job ID, remove it from the queue first
  if (task.bullJobId) {
    const jobRemoved = await services.queue.removeJob(task.bullJobId)
    if (!jobRemoved) {
      console.warn(
        `Failed to remove job ${task.bullJobId} from queue for task ${taskId}`,
      )
    }
  }

  // Delete the task from the database
  await services.verificationTask.deleteVerificationTask(taskId)

  return {
    taskId,
    message: `Task ${taskId} has been successfully deleted`,
  }
}

// Task stats handler
export const handleTaskStats = async (): Promise<TaskStatsResponse> => {
  const services = getServices()
  const stats = await services.verificationTask.getVerificationTaskStats()

  return {
    stats: {
      total: stats.total,
      pending: stats.pending,
      active: stats.active,
      completed: stats.completed,
      failed: stats.failed,
      cancelled: stats.cancelled,
    },
  }
}
