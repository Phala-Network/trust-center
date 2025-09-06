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
  appId?: string
  appName?: string
  appConfigType?: string
  contractAddress?: string

  // Search filters
  keyword?: string

  // Pagination
  page?: number
  limit?: number

  // Sorting
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
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

export interface TaskListResponse {
  success: true
  data: TaskResponse[]
  pagination: {
    total: number
    page: number
    limit: number
    hasNext: boolean
  }
}

export interface TaskDetailResponse {
  success: boolean
  task?: TaskResponse
  error?: string
}

export interface ErrorResponse {
  success: false
  error: string
}

export interface SuccessResponse {
  success: true
  message: string
}

export interface TaskStatsResponse {
  success: true
  stats: {
    total: number
    pending: number
    active: number
    completed: number
    failed: number
  }
}

export interface StorageInfoResponse {
  success: true
  storageInfo: {
    s3Key: string
    s3Bucket: string
    s3Filename?: string
    fileSize?: number
    message: string
  }
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
