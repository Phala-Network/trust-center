// Utility functions for task routes
import type {
  AppConfigType,
  VerificationTask,
  VerificationTaskStatus,
} from '../../db/schema'
import type { TaskResponse, VerificationFlags } from './schemas'

export class TaskError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message)
    this.name = 'TaskError'
  }
}

export const createErrorResponse = (
  error: unknown,
  defaultMessage: string = 'An error occurred',
) => {
  if (error instanceof TaskError) {
    return {
      error: {
        code: error.code || 'TASK_ERROR',
        message: error.message,
        details: error.message,
      },
    }
  }

  if (error instanceof Error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        details: error.stack,
      },
    }
  }

  return {
    error: {
      code: 'UNKNOWN_ERROR',
      message: defaultMessage,
      details: 'An unexpected error occurred',
    },
  }
}

// Helper function to determine HTTP status code based on error
export const getErrorStatusCode = (error: unknown): number => {
  if (error instanceof TaskError) {
    return error.statusCode
  }

  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      return 404
    }
    if (error.message.includes('Invalid request data')) {
      return 400
    }
  }

  return 500
}

export const validatePaginationParams = (page?: number, limit?: number) => {
  const DEFAULT_PAGE = 1
  const DEFAULT_LIMIT = 50
  const MAX_LIMIT = 100

  const validatedPage = Math.max(1, page || DEFAULT_PAGE)
  const validatedLimit = Math.min(
    Math.max(1, limit || DEFAULT_LIMIT),
    MAX_LIMIT,
  )

  return { page: validatedPage, limit: validatedLimit }
}

export const validateSortParams = (sortBy?: string, sortOrder?: string) => {
  const VALID_SORT_FIELDS = ['createdAt', 'startedAt', 'finishedAt']
  const VALID_SORT_ORDERS = ['asc', 'desc']

  const validatedSortBy = VALID_SORT_FIELDS.includes(sortBy || '')
    ? sortBy
    : 'createdAt'

  const validatedSortOrder = VALID_SORT_ORDERS.includes(sortOrder || '')
    ? (sortOrder as 'asc' | 'desc')
    : 'desc'

  return { sortBy: validatedSortBy, sortOrder: validatedSortOrder }
}

export const sanitizeKeyword = (keyword?: string): string | undefined => {
  if (!keyword) return undefined

  // Remove potentially dangerous characters and trim
  return keyword.trim().replace(/[<>'"]/g, '')
}

// Type guards
export const isValidAppConfigType = (value: string): value is AppConfigType => {
  return value === 'redpill' || value === 'phala_cloud'
}

export const isValidVerificationTaskStatus = (
  value: string,
): value is VerificationTaskStatus => {
  return ['pending', 'active', 'completed', 'failed', 'cancelled'].includes(
    value,
  )
}

// Utility functions
export const convertTaskForResponse = (
  task: VerificationTask,
): TaskResponse => ({
  id: task.id,
  appId: task.appId,
  appName: task.appName,
  appConfigType: task.appConfigType,
  contractAddress: task.contractAddress,
  modelOrDomain: task.modelOrDomain,
  verificationFlags: task.verificationFlags as VerificationFlags | null,
  status: task.status,
  errorMessage: task.errorMessage ?? undefined,
  s3Filename: task.s3Filename ?? undefined,
  s3Key: task.s3Key ?? undefined,
  s3Bucket: task.s3Bucket ?? undefined,
  createdAt: task.createdAt.toISOString(),
  startedAt: task.startedAt?.toISOString(),
  finishedAt: task.finishedAt?.toISOString(),
})
