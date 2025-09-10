import { t } from 'elysia'

// Define schemas based on config VerificationFlags
// All fields are optional in API - VerificationService will merge with defaults
export const VerificationFlagsSchema = t.Object({
  hardware: t.Optional(t.Boolean()),
  os: t.Optional(t.Boolean()),
  sourceCode: t.Optional(t.Boolean()),
  teeControlledKey: t.Optional(t.Boolean()),
  certificateKey: t.Optional(t.Boolean()),
  dnsCAA: t.Optional(t.Boolean()),
  ctLog: t.Optional(t.Boolean()),
})

export const MetadataSchema = t.Object({
  osSource: t.Object({
    github_repo: t.String(),
    git_commit: t.String(),
    version: t.TemplateLiteral(`v${t.String()}`),
  }),
  appSource: t.Optional(
    t.Object({
      github_repo: t.String(),
      git_commit: t.String(),
      version: t.String(),
      model_name: t.Optional(t.String()),
    }),
  ),
  hardware: t.Object({
    cpuManufacturer: t.String(),
    cpuModel: t.String(),
    securityFeature: t.String(),
    hasNvidiaSupport: t.Optional(t.Boolean()),
  }),
  governance: t.Optional(
    t.Object({
      blockchain: t.String(),
      blockchainExplorerUrl: t.String(),
      chainId: t.Optional(t.Number()),
    }),
  ),
})

export const AppConfigSchema = t.Object({
  metadata: t.Optional(MetadataSchema),
})

// Request schemas
export const TaskCreateRequestSchema = t.Object({
  appId: t.String(),
  appName: t.String(),
  appConfigType: t.Union([t.Literal('redpill'), t.Literal('phala_cloud')]),
  contractAddress: t.String(),
  modelOrDomain: t.String(),
  appConfig: t.Optional(AppConfigSchema),
  flags: t.Optional(VerificationFlagsSchema),
})

export const TaskBatchCreateRequestSchema = t.Object({
  tasks: t.Array(TaskCreateRequestSchema),
})

export const TaskListQuerySchema = t.Object({
  app_id: t.Optional(t.String()),
  app_name: t.Optional(t.String()),
  app_config_type: t.Optional(t.String()),
  contract_address: t.Optional(t.String()),
  keyword: t.Optional(t.String()),
  status: t.Optional(t.String()),
  per_page: t.Optional(t.Number()),
  page: t.Optional(t.Number()),
  sort_by: t.Optional(t.String()),
  sort_order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
  created_after: t.Optional(t.String()),
  created_before: t.Optional(t.String()),
})

// Response data schemas
export const TaskResponseSchema = t.Object({
  id: t.String(),
  appId: t.String(),
  appName: t.String(),
  appConfigType: t.String(),
  contractAddress: t.String(),
  modelOrDomain: t.String(),
  verificationFlags: t.Optional(t.Union([VerificationFlagsSchema, t.Null()])),
  status: t.String(),
  errorMessage: t.Optional(t.String()),
  s3Filename: t.Optional(t.String()),
  s3Key: t.Optional(t.String()),
  s3Bucket: t.Optional(t.String()),
  createdAt: t.String(),
  startedAt: t.Optional(t.String()),
  finishedAt: t.Optional(t.String()),
})

export const TaskListDataSchema = t.Object({
  tasks: t.Array(TaskResponseSchema),
  pagination: t.Object({
    currentPage: t.Number(),
    perPage: t.Number(),
    total: t.Number(),
    totalPages: t.Number(),
    hasNext: t.Boolean(),
    hasPrev: t.Boolean(),
  }),
})

export const TaskDetailDataSchema = t.Object({
  task: TaskResponseSchema,
})

export const TaskCreateDataSchema = t.Object({
  taskId: t.String(),
  message: t.String(),
})

export const TaskBatchCreateDataSchema = t.Object({
  total: t.Number(),
  successful: t.Number(),
  failed: t.Number(),
  results: t.Array(
    t.Object({
      index: t.Number(),
      success: t.Boolean(),
      taskId: t.Union([t.String(), t.Null()]),
      error: t.Union([t.String(), t.Null()]),
    }),
  ),
})

export const TaskStatsDataSchema = t.Object({
  stats: t.Object({
    total: t.Number(),
    pending: t.Number(),
    active: t.Number(),
    completed: t.Number(),
    failed: t.Number(),
    cancelled: t.Number(),
  }),
})

export const TaskCancelDataSchema = t.Object({
  taskId: t.String(),
  message: t.String(),
})

export const TaskRetryDataSchema = t.Object({
  taskId: t.String(),
  message: t.String(),
})

export const TaskDeleteDataSchema = t.Object({
  taskId: t.String(),
  message: t.String(),
})

// Base schemas for consistent error
export const BaseErrorSchema = t.Object({
  code: t.String(),
  message: t.String(),
  details: t.Optional(t.String()),
})

// Error response schema
export const ErrorResponseSchema = t.Object({
  error: BaseErrorSchema,
})

// Type definitions based on schemas
export type VerificationFlags = typeof VerificationFlagsSchema.static

// Request types - using Elysia schema static types
export type TaskCreateRequest = typeof TaskCreateRequestSchema.static
export type BatchCreateRequest = typeof TaskBatchCreateRequestSchema.static
export type TaskListQuery = typeof TaskListQuerySchema.static

// Response types - using Elysia schema static types
export type TaskResponse = typeof TaskResponseSchema.static
export type TaskListResponse = typeof TaskListDataSchema.static
export type TaskDetailResponse = typeof TaskDetailDataSchema.static
export type TaskCreateResponse = typeof TaskCreateDataSchema.static
export type TaskBatchCreateResponse = typeof TaskBatchCreateDataSchema.static
export type TaskStatsResponse = typeof TaskStatsDataSchema.static
export type TaskCancelResponse = typeof TaskCancelDataSchema.static
export type TaskRetryResponse = typeof TaskRetryDataSchema.static
export type TaskDeleteResponse = typeof TaskDeleteDataSchema.static
export type ErrorResponse = typeof ErrorResponseSchema.static
