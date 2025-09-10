// Task API constants and configuration
export const TASK_CONSTANTS = {
  // Pagination defaults
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,

  // Sorting options
  SORT_FIELDS: ['createdAt', 'startedAt', 'finishedAt'] as const,
  SORT_ORDERS: ['asc', 'desc'] as const,
  DEFAULT_SORT_BY: 'createdAt' as const,
  DEFAULT_SORT_ORDER: 'desc' as const,

  // Status values
  VALID_STATUSES: [
    'pending',
    'active',
    'completed',
    'failed',
    'cancelled',
  ] as const,

  // App config types
  VALID_APP_CONFIG_TYPES: ['redpill', 'phala_cloud'] as const,

  // Keyword search fields
  KEYWORD_SEARCH_FIELDS: ['appName', 'appId', 'contractAddress'] as const,
} as const

export type SortField = (typeof TASK_CONSTANTS.SORT_FIELDS)[number]
export type SortOrder = (typeof TASK_CONSTANTS.SORT_ORDERS)[number]
export type ValidStatus = (typeof TASK_CONSTANTS.VALID_STATUSES)[number]
export type ValidAppConfigType =
  (typeof TASK_CONSTANTS.VALID_APP_CONFIG_TYPES)[number]
