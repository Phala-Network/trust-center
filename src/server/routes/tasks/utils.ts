// Utility functions for task routes

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
      success: false as const,
      error: error.message,
      statusCode: error.statusCode,
    }
  }

  if (error instanceof Error) {
    return {
      success: false as const,
      error: error.message,
      statusCode: 500,
    }
  }

  return {
    success: false as const,
    error: defaultMessage,
    statusCode: 500,
  }
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
