import type { AppMetadata, VerificationFlags } from '../../../types'
import type {
  AppConfigType,
  VerificationTask,
  VerificationTaskStatus,
} from '../../db/schema'

// Request types
export interface TaskCreateRequest {
  appId: string
  appName: string
  appConfigType: AppConfigType
  contractAddress: string
  modelOrDomain: string
  appMetadata: AppMetadata
  verificationFlags: VerificationFlags
}

export interface BatchCreateRequest {
  tasks: TaskCreateRequest[]
}

export interface TaskListQuery {
  // Basic filters
  status?: string
  app_id?: string
  app_name?: string
  app_config_type?: string
  contract_address?: string

  // Search filters
  keyword?: string

  // Pagination - using standard naming
  page?: number
  per_page?: number

  // Sorting - using standard naming
  sort_by?: string
  sort_order?: 'asc' | 'desc'

  // Date filters
  created_after?: string
  created_before?: string
}

// Base types for consistency
export interface BaseError {
  code: string
  message: string
  details?: string
}

// Response types
export interface TaskResponse {
  id: string
  appId: string
  appName: string
  appConfigType: string
  contractAddress: string
  modelOrDomain: string
  verificationFlags?: VerificationFlags
  status: string
  errorMessage?: string
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export interface Pagination {
  currentPage: number
  perPage: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface TaskListResponse {
  tasks: TaskResponse[]
  pagination: Pagination
}

export interface TaskDetailResponse {
  task: TaskResponse
}

export interface TaskCreateResponse {
  taskId: string
  message: string
}

export interface TaskBatchCreateResponse {
  total: number
  successful: number
  failed: number
  results: Array<{
    index: number
    success: boolean
    taskId: string | null
    error: string | null
  }>
}

export interface TaskStatsResponse {
  stats: {
    total: number
    pending: number
    active: number
    completed: number
    failed: number
  }
}

export interface TaskCancelResponse {
  taskId: string
  message: string
}

// Error response type
export interface ErrorResponse {
  error: BaseError
}

// Type guards
export const isValidAppConfigType = (value: string): value is AppConfigType => {
  return value === 'redpill' || value === 'phala_cloud'
}

export const isValidVerificationTaskStatus = (
  value: string,
): value is VerificationTaskStatus => {
  return ['pending', 'active', 'completed', 'failed'].includes(value)
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
