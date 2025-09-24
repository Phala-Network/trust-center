import { z } from 'zod'

import { AppMetadataSchema } from '../../../types/metadata'

// Define schemas based on config VerificationFlags
// All fields are optional in API - VerificationService will merge with defaults
export const VerificationFlagsSchema = z.object({
  hardware: z.boolean().optional(),
  os: z.boolean().optional(),
  sourceCode: z.boolean().optional(),
  teeControlledKey: z.boolean().optional(),
  certificateKey: z.boolean().optional(),
  dnsCAA: z.boolean().optional(),
  ctLog: z.boolean().optional(),
})

export const MetadataSchema = AppMetadataSchema

// Request schemas
export const TaskCreateRequestSchema = z.object({
  appId: z.string(),
  appName: z.string(),
  appConfigType: z.union([z.literal('redpill'), z.literal('phala_cloud')]),
  contractAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/, 'Must be a valid Ethereum address'),
  modelOrDomain: z.string(),
  metadata: MetadataSchema.optional(),
  flags: VerificationFlagsSchema.optional(),
})

export const TaskBatchCreateRequestSchema = z.object({
  tasks: z.array(TaskCreateRequestSchema),
})

export const TaskListQuerySchema = z.object({
  app_id: z.string().optional(),
  app_name: z.string().optional(),
  app_config_type: z.string().optional(),
  contract_address: z.string().optional(),
  keyword: z.string().optional(),
  status: z.string().optional(),
  per_page: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  sort_by: z.string().optional(),
  sort_order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
})

export const AppsListQuerySchema = z.object({
  app_config_type: z.string().optional(),
  keyword: z.string().optional(),
  include_stats: z.coerce.boolean().optional().default(false),
  per_page: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  sort_by: z
    .union([
      z.literal('appName'),
      z.literal('taskCount'),
      z.literal('lastCreated'),
    ])
    .optional()
    .default('appName'),
  sort_order: z
    .union([z.literal('asc'), z.literal('desc')])
    .optional()
    .default('asc'),
})

export const AppTasksQuerySchema = z.object({
  status: z.string().optional(),
  per_page: z.coerce.number().optional(),
  page: z.coerce.number().optional(),
  sort_by: z.string().optional(),
  sort_order: z.union([z.literal('asc'), z.literal('desc')]).optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
})

// Response data schemas
export const TaskResponseSchema = z.object({
  id: z.string(),
  appId: z.string(),
  appName: z.string(),
  appConfigType: z.string(),
  contractAddress: z.string(),
  modelOrDomain: z.string(),
  verificationFlags: z.union([VerificationFlagsSchema, z.null()]).optional(),
  status: z.string(),
  errorMessage: z.string().optional(),
  s3Filename: z.string().optional(),
  s3Key: z.string().optional(),
  s3Bucket: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
})

export const TaskListDataSchema = z.object({
  tasks: z.array(TaskResponseSchema),
  pagination: z.object({
    currentPage: z.number(),
    perPage: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
})

export const TaskDetailDataSchema = z.object({
  task: TaskResponseSchema,
})

export const TaskCreateDataSchema = z.object({
  taskId: z.string(),
  message: z.string(),
})

export const TaskBatchCreateDataSchema = z.object({
  total: z.number(),
  successful: z.number(),
  failed: z.number(),
  results: z.array(
    z.object({
      index: z.number(),
      success: z.boolean(),
      taskId: z.union([z.string(), z.null()]),
      error: z.union([z.string(), z.null()]),
    }),
  ),
})

export const TaskStatsDataSchema = z.object({
  stats: z.object({
    total: z.number(),
    pending: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
    cancelled: z.number(),
  }),
})

export const TaskCancelDataSchema = z.object({
  taskId: z.string(),
  message: z.string(),
})

export const TaskRetryDataSchema = z.object({
  taskId: z.string(),
  message: z.string(),
})

export const TaskDeleteDataSchema = z.object({
  taskId: z.string(),
  message: z.string(),
})

export const AppResponseSchema = z.object({
  appId: z.string(),
  appName: z.string(),
  appConfigType: z.string(),
  contractAddress: z.string(),
  modelOrDomain: z.string(),
  taskCount: z.number().optional(),
  lastCreated: z.string().optional(),
  firstCreated: z.string().optional(),
})

export const AppsListDataSchema = z.object({
  apps: z.array(TaskResponseSchema),
  pagination: z.object({
    currentPage: z.number(),
    perPage: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
})

export const AppDetailDataSchema = z.object({
  app: TaskResponseSchema,
})

export const AppTasksDataSchema = z.object({
  appId: z.string(),
  tasks: z.array(TaskResponseSchema),
  pagination: z.object({
    currentPage: z.number(),
    perPage: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
})

// Base schemas for consistent error
export const BaseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.string().optional(),
})

// Error response schema
export const ErrorResponseSchema = z.object({
  error: BaseErrorSchema,
})

// Type definitions based on schemas
export type VerificationFlags = z.infer<typeof VerificationFlagsSchema>

// Request types - using Zod schema inference
export type TaskCreateRequest = z.infer<typeof TaskCreateRequestSchema>
export type BatchCreateRequest = z.infer<typeof TaskBatchCreateRequestSchema>
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>
export type AppsListQuery = z.infer<typeof AppsListQuerySchema>
export type AppTasksQuery = z.infer<typeof AppTasksQuerySchema>

// Response types - using Zod schema inference
export type TaskResponse = z.infer<typeof TaskResponseSchema>
export type TaskListResponse = z.infer<typeof TaskListDataSchema>
export type TaskDetailResponse = z.infer<typeof TaskDetailDataSchema>
export type TaskCreateResponse = z.infer<typeof TaskCreateDataSchema>
export type TaskBatchCreateResponse = z.infer<typeof TaskBatchCreateDataSchema>
export type TaskStatsResponse = z.infer<typeof TaskStatsDataSchema>
export type TaskCancelResponse = z.infer<typeof TaskCancelDataSchema>
export type TaskRetryResponse = z.infer<typeof TaskRetryDataSchema>
export type TaskDeleteResponse = z.infer<typeof TaskDeleteDataSchema>
export type AppResponse = z.infer<typeof AppResponseSchema>
export type AppsListResponse = z.infer<typeof AppsListDataSchema>
export type AppDetailResponse = z.infer<typeof AppDetailDataSchema>
export type AppTasksResponse = z.infer<typeof AppTasksDataSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
