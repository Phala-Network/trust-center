import { z } from 'zod'

import type { VerificationFlags as ConfigVerificationFlags } from '../../../config'
import type { VerificationFlags as ApiVerificationFlags } from '../../../types'
import type { AppConfigType, VerificationTaskStatus } from '../../db/schema'
import { getServices } from '../../services/index'
import { TASK_CONSTANTS } from './constants'
import type {
  TaskBatchCreateResponse,
  TaskCancelResponse,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskDetailResponse,
  TaskListQuery,
  TaskListResponse,
  TaskStatsResponse,
} from './types'

// Zod schemas for API request validation
const VerificationFlagsSchema = z.object({
  hardware: z.boolean().optional(),
  os: z.boolean().optional(),
  sourceCode: z.boolean().optional(),
  teeControlledKey: z.boolean().optional(),
  certificateKey: z.boolean().optional(),
  dnsCAA: z.boolean().optional(),
  ctLog: z.boolean().optional(),
})

const AppConfigSchema = z.object({
  metadata: z.object({
    osSource: z.object({
      github_repo: z.string(),
      git_commit: z.string(),
      version: z.string(),
    }),
    appSource: z
      .object({
        github_repo: z.string(),
        git_commit: z.string(),
        version: z.string(),
        model_name: z.string().optional(),
      })
      .optional(),
    hardware: z.object({
      cpuManufacturer: z.string(),
      cpuModel: z.string(),
      securityFeature: z.string(),
      hasNvidiaSupport: z.boolean().optional(),
    }),
  }),
})

const ApiTaskCreateRequestSchema = z.object({
  app_id: z.string(),
  app_name: z.string(),
  app_config_type: z.enum(['redpill', 'phala_cloud']),
  contract_address: z.string(),
  model_or_domain: z.string(),
  app_config: AppConfigSchema,
  flags: VerificationFlagsSchema.optional(),
})

const ApiBatchCreateRequestSchema = z.object({
  tasks: z.array(ApiTaskCreateRequestSchema),
})

// Inferred types from Zod schemas
type ApiTaskCreateRequest = z.infer<typeof ApiTaskCreateRequestSchema>
type ApiBatchCreateRequest = z.infer<typeof ApiBatchCreateRequestSchema>

import {
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

// Helper function to convert VerificationTask to TaskResponse
const convertTaskToResponse = (task: any) => ({
  id: task.id,
  appId: task.appId,
  appName: task.appName,
  appConfigType: task.appConfigType,
  contractAddress: task.contractAddress,
  modelOrDomain: task.modelOrDomain,
  verificationFlags: task.verificationFlags as ApiVerificationFlags | undefined,
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
) => ({
  currentPage: page,
  perPage: limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext,
  hasPrev: page > 1,
})

// Convert API request format to handler format using Zod validation
const convertApiRequestToHandler = (rawRequest: unknown): TaskCreateRequest => {
  try {
    const apiRequest = ApiTaskCreateRequestSchema.parse(rawRequest)

    return {
      appId: apiRequest.app_id,
      appName: apiRequest.app_name,
      appConfigType: apiRequest.app_config_type,
      contractAddress: apiRequest.contract_address,
      modelOrDomain: apiRequest.model_or_domain,
      appMetadata: apiRequest.app_config.metadata,
      verificationFlags: apiRequest.flags || {},
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid request data: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
      )
    }
    throw error
  }
}

// Task creation handler
export const handleTaskCreation = async (
  rawRequest: unknown,
): Promise<TaskCreateResponse> => {
  const body = convertApiRequestToHandler(rawRequest)
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
    taskId,
    message: `Task created successfully with ID: ${taskId}`,
  }
}

// Batch task creation handler
export const handleBatchCreation = async (
  rawRequest: unknown,
): Promise<TaskBatchCreateResponse> => {
  const apiRequest = ApiBatchCreateRequestSchema.parse(rawRequest)
  const services = getServices()
  const results = []

  for (let i = 0; i < apiRequest.tasks.length; i++) {
    const apiTask = apiRequest.tasks[i]
    if (!apiTask) {
      results.push({
        index: i,
        success: false,
        taskId: null,
        error: 'Task data is missing',
      })
      continue
    }

    try {
      const task = convertApiRequestToHandler(apiTask)
      const taskId = await services.queue.addTask({
        appId: task.appId,
        appName: task.appName,
        appConfigType: task.appConfigType,
        contractAddress: task.contractAddress,
        modelOrDomain: task.modelOrDomain,
        appMetadata: task.appMetadata,
        verificationFlags: convertVerificationFlags(task.verificationFlags),
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
    total: apiRequest.tasks.length,
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
  // For now, we'll just return success as cancellation is not implemented
  // TODO: Implement actual task cancellation logic
  return {
    taskId,
    message: 'Task cancellation requested (not yet implemented)',
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
    },
  }
}
