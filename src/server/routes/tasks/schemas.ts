import { t } from 'elysia'

// Validation schemas for structured types
export const OSSourceInfoSchema = t.Object({
  github_repo: t.String(),
  git_commit: t.String(),
  version: t.String(),
})

export const AppSourceInfoSchema = t.Object({
  github_repo: t.String(),
  git_commit: t.String(),
  version: t.String(),
  model_name: t.Optional(t.String()),
})

export const HardwareInfoSchema = t.Object({
  cpu: t.String(),
  memory: t.String(),
  storage: t.String(),
})

export const MetadataSchema = t.Object({
  osSource: t.Optional(OSSourceInfoSchema),
  appSource: t.Optional(AppSourceInfoSchema),
  hardware: t.Optional(HardwareInfoSchema),
})

export const RedpillConfigSchema = t.Object({
  metadata: MetadataSchema,
})

export const PhalaCloudConfigSchema = t.Object({
  metadata: MetadataSchema,
})

export const AppConfigSchema = t.Union([
  RedpillConfigSchema,
  PhalaCloudConfigSchema,
])

export const VerificationFlagsSchema = t.Object({
  skip_os_verification: t.Optional(t.Boolean()),
  skip_app_verification: t.Optional(t.Boolean()),
  skip_hardware_verification: t.Optional(t.Boolean()),
})

// Request schemas
export const TaskCreateRequestSchema = t.Object({
  app_id: t.String(),
  app_name: t.String(),
  app_config_type: t.Union([t.Literal('redpill'), t.Literal('phala_cloud')]),
  contract_address: t.String(),
  model_or_domain: t.String(),
  app_config: AppConfigSchema,
  flags: t.Optional(VerificationFlagsSchema),
})

export const TaskBatchCreateRequestSchema = t.Object({
  tasks: t.Array(TaskCreateRequestSchema),
})

export const TaskListQuerySchema = t.Object({
  app_id: t.Optional(t.String()),
  status: t.Optional(t.String()),
  per_page: t.Optional(t.Number()),
  page: t.Optional(t.Number()),
  sort_by: t.Optional(t.String()),
  sort_order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
})

// Response data schemas
export const TaskResponseSchema = t.Object({
  id: t.String(),
  appId: t.String(),
  appName: t.String(),
  appConfigType: t.String(),
  contractAddress: t.String(),
  modelOrDomain: t.String(),
  status: t.String(),
  createdAt: t.String(),
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
  }),
})

export const TaskCancelDataSchema = t.Object({
  taskId: t.String(),
  message: t.String(),
})

// Base schemas for consistent error
export const BaseErrorSchema = t.Object({
  code: t.String(),
  message: t.String(),
  details: t.Optional(t.String()),
})

// Response schemas
export const TaskListResponseSchema = TaskListDataSchema
export const TaskDetailResponseSchema = TaskDetailDataSchema
export const TaskCreateResponseSchema = TaskCreateDataSchema
export const TaskBatchCreateResponseSchema = TaskBatchCreateDataSchema
export const TaskStatsResponseSchema = TaskStatsDataSchema
export const TaskCancelResponseSchema = TaskCancelDataSchema

// Error response schema
export const ErrorResponseSchema = t.Object({
  error: BaseErrorSchema,
})
