import type {
  AppConfigType,
  VerificationTask,
  VerificationTaskStatus,
} from '../../db/schema'
import { getServices } from '../../services/index'
import { TASK_CONSTANTS } from '../tasks/constants'
import type {
  AppDetailResponse,
  AppsListQuery,
  AppsListResponse,
  AppTasksQuery,
  AppTasksResponse,
  TaskResponse,
  VerificationFlags,
} from '../tasks/schemas'
import {
  sanitizeKeyword,
  validatePaginationParams,
  validateSortParams,
} from '../tasks/utils'

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
) => ({
  currentPage: page,
  perPage: limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNext,
  hasPrev: page > 1,
})

// Apps list handler - returns latest task for each unique app
export const handleAppsList = async (
  query: AppsListQuery,
): Promise<AppsListResponse> => {
  const services = getServices()

  // Validate and convert query parameters
  const appConfigType =
    query.app_config_type &&
    TASK_CONSTANTS.VALID_APP_CONFIG_TYPES.includes(
      query.app_config_type as AppConfigType,
    )
      ? (query.app_config_type as AppConfigType)
      : undefined

  // Validate pagination parameters
  const { page, limit } = validatePaginationParams(query.page, query.per_page)

  // Sanitize keyword input
  const sanitizedKeyword = sanitizeKeyword(query.keyword)

  const sortOrder = query.sort_order === 'desc' ? 'desc' : 'asc'

  // Get latest task for each unique app
  const result = await services.verificationTask.getLatestTasksForUniqueApps({
    appConfigType,
    keyword: sanitizedKeyword,
    sortBy: 'appName',
    sortOrder,
    page,
    limit,
  })

  return {
    apps: result.data.map(convertTaskToResponse),
    pagination: createPagination(
      result.page,
      result.limit,
      result.total,
      result.hasNext,
    ),
  }
}

// App detail handler - returns latest task for the specific app
export const handleAppDetail = async (
  appId: string,
): Promise<AppDetailResponse> => {
  const services = getServices()

  // Get the latest task for this specific app
  const latestTask = await services.verificationTask.getLatestTaskByAppId(appId)

  if (!latestTask) {
    throw new Error(`App with ID '${appId}' not found`)
  }

  return {
    app: convertTaskToResponse(latestTask),
  }
}

// App tasks handler
export const handleAppTasks = async (
  appId: string,
  query: AppTasksQuery,
): Promise<AppTasksResponse> => {
  const services = getServices()

  // Validate status parameter
  const status =
    query.status &&
    TASK_CONSTANTS.VALID_STATUSES.includes(
      query.status as VerificationTaskStatus,
    )
      ? (query.status as VerificationTaskStatus)
      : undefined

  // Validate pagination and sorting parameters
  const { page, limit } = validatePaginationParams(query.page, query.per_page)
  const { sortBy, sortOrder } = validateSortParams(
    query.sort_by,
    query.sort_order,
  )

  // Get tasks for this app
  const result = await services.verificationTask.listVerificationTasks({
    appId, // Filter by specific appId
    status,
    sortBy,
    sortOrder,
    page,
    limit,
  })

  return {
    appId,
    tasks: result.data.map(convertTaskToResponse),
    pagination: createPagination(
      result.page,
      result.limit,
      result.total,
      result.hasNext,
    ),
  }
}
