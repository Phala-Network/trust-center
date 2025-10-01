'use server'

import {env} from '@/env'

// API Response Types based on updated OpenAPI documentation
export interface VerificationFlags {
  hardware: boolean
  os: boolean
  sourceCode: boolean
  teeControlledKey: boolean
  certificateKey: boolean
  dnsCAA: boolean
  ctLog: boolean
}

export interface TaskMetadata {
  osSource: {
    github_repo: string
    git_commit: string
    version: string
  }
  appSource: {
    github_repo: string
    git_commit: string
    version: string
    model_name: string
  }
  hardware: {
    cpuManufacturer: string
    cpuModel: string
    securityFeature: string
    hasNvidiaSupport?: boolean
  }
  governance:
    | {
        type: 'OnChain'
        blockchain: string
        blockchainExplorerUrl: string
        chainId: number
      }
    | {
        type: 'HostedBy'
        host: string
      }
}

export interface CreateTaskRequest {
  appId: string
  appName: string
  appConfigType: 'redpill' | 'phala_cloud'
  contractAddress: string
  modelOrDomain: string
  metadata?: TaskMetadata
  flags?: VerificationFlags
}

export interface Task {
  id: string
  appId: string
  appName: string
  appConfigType: 'redpill' | 'phala_cloud'
  contractAddress: string
  modelOrDomain: string
  verificationFlags: VerificationFlags | null
  status: string
  errorMessage?: string
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

// App types based on new API documentation
export interface App {
  id: string
  appId: string
  appName: string
  appConfigType: string
  contractAddress: string
  modelOrDomain: string
  verificationFlags: VerificationFlags | null
  status: string
  errorMessage?: string
  s3Filename?: string
  s3Key?: string
  s3Bucket?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export interface AppStats {
  taskCount?: number
  lastTaskAt?: string
}

export interface AppsSuccessResponse {
  apps: App[]
  pagination: Pagination
}

export interface AppSuccessResponse {
  app: App
}

export interface AppTasksSuccessResponse {
  appId: string
  tasks: Task[]
  pagination: Pagination
}

export interface AppsErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

export type AppsResponse = AppsSuccessResponse | AppsErrorResponse
export type AppResponse = AppSuccessResponse | AppsErrorResponse
export type AppTasksResponse = AppTasksSuccessResponse | AppsErrorResponse

export interface Pagination {
  currentPage: number
  perPage: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Response types matching OpenAPI anyOf structure
export interface TasksSuccessResponse {
  tasks: Task[]
  pagination: Pagination
}

export interface TasksErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

export type TasksResponse = TasksSuccessResponse | TasksErrorResponse

export interface TaskSuccessResponse {
  task: Task
}

export interface TaskErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

export type TaskResponse = TaskSuccessResponse | TaskErrorResponse

export interface CreateTaskSuccessResponse {
  taskId: string
  message: string
}

export interface CreateTaskErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

export type CreateTaskResponse =
  | CreateTaskSuccessResponse
  | CreateTaskErrorResponse

export interface BatchCreateSuccessResponse {
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

export interface BatchCreateErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

export type BatchCreateResponse =
  | BatchCreateSuccessResponse
  | BatchCreateErrorResponse

// Health check response types
export interface HealthResponse {
  success: boolean
  message?: string
}

export interface DetailedHealthResponse {
  success: boolean
  services?: {
    database?: boolean
    queue?: boolean
    storage?: boolean
  }
  message?: string
}

// Task stats response types
export interface TaskStatsSuccessResponse {
  stats: {
    total: number
    pending: number
    active: number
    completed: number
    failed: number
    cancelled: number
  }
}

export interface TaskStatsErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

export type TaskStatsResponse =
  | TaskStatsSuccessResponse
  | TaskStatsErrorResponse

// API Configuration
const API_BASE_URL = env.VERIFIER_BASE_URL
const API_TOKEN = env.VERIFIER_BEARER_TOKEN

// Helper function to make API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    console.log(await response.json())
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    )
  }

  return response.json()
}

// API Functions based on OpenAPI documentation

/**
 * Basic health check
 * Based on GET /health/
 */
export async function getHealth(): Promise<HealthResponse> {
  const endpoint = '/health/'
  return await apiRequest<HealthResponse>(endpoint)
}

/**
 * Detailed health check with service status
 * Based on GET /health/detailed
 */
export async function getHealthDetailed(): Promise<DetailedHealthResponse> {
  const endpoint = '/health/detailed'
  return await apiRequest<DetailedHealthResponse>(endpoint)
}

export interface FetchTasksParams {
  app_id?: string
  app_name?: string
  app_config_type?: string
  contract_address?: string
  keyword?: string
  status?: string
  per_page?: number
  page?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  created_after?: string
  created_before?: string
}

/**
 * Fetch tasks with optional filtering and pagination
 * Based on GET /api/v1/tasks/
 */
export async function fetchTasks(
  params: FetchTasksParams = {},
): Promise<TasksResponse> {
  const searchParams = new URLSearchParams()

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString())
    }
  })

  const endpoint = `/api/v1/tasks/?${searchParams.toString()}`
  return await apiRequest<TasksResponse>(endpoint)
}

/**
 * Search tasks using keyword parameter
 * @param keyword - Search keyword
 * @param params - Additional search parameters
 * @returns Tasks matching the search criteria
 */
export async function searchTasks(
  keyword: string,
  params: Omit<FetchTasksParams, 'keyword'> = {},
): Promise<TasksResponse> {
  return fetchTasks({...params, keyword})
}

/**
 * Fetch a specific task by ID
 * Based on GET /api/v1/tasks/{taskId}
 */
export async function fetchTask(taskId: string): Promise<TaskResponse> {
  const endpoint = `/api/v1/tasks/${taskId}`
  return await apiRequest<TaskResponse>(endpoint)
}

/**
 * Create a new task
 * Based on POST /api/v1/tasks/
 */
export async function createTask(
  taskData: CreateTaskRequest,
): Promise<CreateTaskResponse> {
  const endpoint = '/api/v1/tasks/'
  return await apiRequest<CreateTaskResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(taskData),
  })
}

/**
 * Create multiple tasks in batch
 * Based on POST /api/v1/tasks/batch
 */
export async function createTasksBatch(
  tasks: CreateTaskRequest[],
): Promise<BatchCreateResponse> {
  const endpoint = '/api/v1/tasks/batch'
  return await apiRequest<BatchCreateResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify({tasks}),
  })
}

/**
 * Cancel a verification task
 * Based on DELETE /api/v1/tasks/{taskId}
 */
export async function cancelTask(taskId: string): Promise<CreateTaskResponse> {
  const endpoint = `/api/v1/tasks/${taskId}`
  return await apiRequest<CreateTaskResponse>(endpoint, {
    method: 'DELETE',
  })
}

/**
 * Retry a verification task
 * Based on POST /api/v1/tasks/{taskId}/retry
 */
export async function retryTask(taskId: string): Promise<CreateTaskResponse> {
  const endpoint = `/api/v1/tasks/${taskId}/retry`
  return await apiRequest<CreateTaskResponse>(endpoint, {
    method: 'POST',
  })
}

/**
 * Permanently delete a verification task
 * Based on DELETE /api/v1/tasks/{taskId}/delete
 */
export async function deleteTask(taskId: string): Promise<CreateTaskResponse> {
  const endpoint = `/api/v1/tasks/${taskId}/delete`
  return await apiRequest<CreateTaskResponse>(endpoint, {
    method: 'DELETE',
  })
}

// Legacy functions for backward compatibility

export async function getTask(
  appId: string,
  taskId: string,
): Promise<Task | null> {
  const response = await fetchTask(taskId)
  if ('task' in response && response.task && response.task.appId === appId) {
    return response.task
  }
  return null
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const response = await fetchTask(taskId)
  if ('task' in response && response.task) {
    return response.task
  }
  return null
}

// Queue Management Types and Functions

export interface QueueStatus {
  success: boolean
  queue?: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed?: number
    paused: boolean
  }
  error?: string
}

export interface QueueJob {
  success: boolean
  job?: {
    id?: string
    name?: string
    data: any
    progress?: any
    processedOn?: number
    finishedOn?: number
    failedReason?: string
    returnvalue?: any
    opts: any
    attemptsMade?: number
  }
  error?: string
}

export interface QueueActionResponse {
  success: boolean
  message?: string
  cleanedCount?: number
  error?: string
}

/**
 * Get queue status
 * Based on GET /api/v1/queue/status
 */
export async function getQueueStatus(): Promise<QueueStatus> {
  const endpoint = '/api/v1/queue/status'
  return await apiRequest<QueueStatus>(endpoint)
}

/**
 * Get job details
 * Based on GET /api/v1/queue/jobs/{jobId}
 */
export async function getQueueJob(jobId: string): Promise<QueueJob> {
  const endpoint = `/api/v1/queue/jobs/${jobId}`
  return await apiRequest<QueueJob>(endpoint)
}

/**
 * Remove job from queue
 * Based on DELETE /api/v1/queue/jobs/{jobId}
 */
export async function removeQueueJob(
  jobId: string,
): Promise<QueueActionResponse> {
  const endpoint = `/api/v1/queue/jobs/${jobId}`
  return await apiRequest<QueueActionResponse>(endpoint, {
    method: 'DELETE',
  })
}

/**
 * Retry failed job
 * Based on POST /api/v1/queue/jobs/{jobId}/retry
 */
export async function retryQueueJob(
  jobId: string,
): Promise<QueueActionResponse> {
  const endpoint = `/api/v1/queue/jobs/${jobId}/retry`
  return await apiRequest<QueueActionResponse>(endpoint, {
    method: 'POST',
  })
}

/**
 * Pause queue
 * Based on POST /api/v1/queue/pause
 */
export async function pauseQueue(): Promise<QueueActionResponse> {
  const endpoint = '/api/v1/queue/pause'
  return await apiRequest<QueueActionResponse>(endpoint, {
    method: 'POST',
  })
}

/**
 * Resume queue
 * Based on POST /api/v1/queue/resume
 */
export async function resumeQueue(): Promise<QueueActionResponse> {
  const endpoint = '/api/v1/queue/resume'
  return await apiRequest<QueueActionResponse>(endpoint, {
    method: 'POST',
  })
}

/**
 * Clean queue
 * Based on POST /api/v1/queue/clean
 */
export async function cleanQueue(params?: {
  grace?: number
  status?: 'completed' | 'failed' | 'delayed'
  limit?: number
}): Promise<QueueActionResponse> {
  const searchParams = new URLSearchParams()

  if (params?.grace !== undefined) {
    searchParams.append('grace', params.grace.toString())
  }
  if (params?.status) {
    searchParams.append('status', params.status)
  }
  if (params?.limit !== undefined) {
    searchParams.append('limit', params.limit.toString())
  }

  const endpoint = `/api/v1/queue/clean${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  return await apiRequest<QueueActionResponse>(endpoint, {
    method: 'POST',
  })
}

// Additional utility functions

/**
 * Get task statistics summary
 * Based on GET /api/v1/tasks/stats/summary
 */
export async function getTaskStats(): Promise<TaskStatsResponse> {
  const endpoint = '/api/v1/tasks/stats/summary'
  return await apiRequest<TaskStatsResponse>(endpoint)
}

// New App API Functions

export interface FetchAppsParams {
  app_config_type?: string
  keyword?: string
  include_stats?: boolean
  per_page?: number
  page?: number
  sort_by?: 'appName' | 'taskCount' | 'lastCreated'
  sort_order?: 'asc' | 'desc'
}

/**
 * List latest tasks for unique applications
 * Based on GET /api/v1/apps/
 */
export async function fetchApps(
  params: FetchAppsParams = {},
): Promise<AppsResponse> {
  const searchParams = new URLSearchParams()

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString())
    }
  })

  // Set required defaults
  if (!searchParams.has('include_stats')) {
    searchParams.append('include_stats', 'false')
  }
  if (!searchParams.has('sort_by')) {
    searchParams.append('sort_by', 'appName')
  }
  if (!searchParams.has('sort_order')) {
    searchParams.append('sort_order', 'asc')
  }

  const endpoint = `/api/v1/apps/?${searchParams.toString()}`
  return await apiRequest<AppsResponse>(endpoint)
}

/**
 * Get latest task for application
 * Based on GET /api/v1/apps/{appId}
 */
export async function fetchApp(appId: string): Promise<AppResponse> {
  const endpoint = `/api/v1/apps/${appId}`
  return await apiRequest<AppResponse>(endpoint)
}

export interface FetchAppTasksParams {
  status?: string
  per_page?: number
  page?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  created_after?: string
  created_before?: string
}

/**
 * Get application tasks
 * Based on GET /api/v1/apps/{appId}/tasks
 */
export async function fetchAppTasks(
  appId: string,
  params: FetchAppTasksParams = {},
): Promise<AppTasksResponse> {
  const searchParams = new URLSearchParams()

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString())
    }
  })

  const endpoint = `/api/v1/apps/${appId}/tasks?${searchParams.toString()}`
  return await apiRequest<AppTasksResponse>(endpoint)
}

// New App API convenience functions

/**
 * Get all apps with optional filtering and statistics
 */
export async function getApps(params?: {
  keyword?: string
  appConfigType?: string
  includeStats?: boolean
  sortBy?: 'appName' | 'taskCount' | 'lastCreated'
  sortOrder?: 'asc' | 'desc'
  page?: number
  perPage?: number
}): Promise<App[]> {
  const response = await fetchApps({
    keyword: params?.keyword,
    app_config_type: params?.appConfigType,
    include_stats: params?.includeStats ?? true,
    sort_by: params?.sortBy ?? 'appName',
    sort_order: params?.sortOrder ?? 'asc',
    page: params?.page,
    per_page: params?.perPage,
  })

  if ('apps' in response && response.apps) {
    return response.apps
  }
  return []
}

/**
 * Get a single app by ID
 */
export async function getApp(appId: string): Promise<App | null> {
  const response = await fetchApp(appId)
  if ('app' in response && response.app) {
    return response.app
  }
  return null
}

/**
 * Get all tasks for a specific app
 */
export async function getAppTasks(
  appId: string,
  params?: {
    status?: string
    page?: number
    perPage?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    createdAfter?: string
    createdBefore?: string
  },
): Promise<Task[]> {
  const response = await fetchAppTasks(appId, {
    status: params?.status,
    page: params?.page,
    per_page: params?.perPage,
    sort_by: params?.sortBy,
    sort_order: params?.sortOrder,
    created_after: params?.createdAfter,
    created_before: params?.createdBefore,
  })

  if ('tasks' in response && response.tasks) {
    return response.tasks
  }
  return []
}

/**
 * Get the latest task for an app (returns the app which represents the latest task)
 */
export async function getLatestAppTask(appId: string): Promise<App | null> {
  return getApp(appId)
}
