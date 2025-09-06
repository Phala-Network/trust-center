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
  cpuManufacturer: t.String(),
  cpuModel: t.String(),
  securityFeature: t.String(),
  hasNvidiaSupport: t.Optional(t.Boolean()),
})

export const GovernanceInfoSchema = t.Object({
  blockchain: t.String(),
  blockchainExplorerUrl: t.String(),
  chainId: t.Optional(t.Number()),
})

export const AppMetadataSchema = t.Object({
  osSource: OSSourceInfoSchema,
  appSource: t.Optional(AppSourceInfoSchema),
  hardware: HardwareInfoSchema,
  governance: t.Optional(GovernanceInfoSchema),
})

export const VerificationFlagsSchema = t.Object({
  hardware: t.Optional(t.Boolean()),
  os: t.Optional(t.Boolean()),
  sourceCode: t.Optional(t.Boolean()),
  teeControlledKey: t.Optional(t.Boolean()),
})

// Request schemas
export const TaskCreateRequestSchema = t.Object({
  appId: t.String(),
  appName: t.String(),
  appConfigType: t.Union([t.Literal('redpill'), t.Literal('phala_cloud')]),
  contractAddress: t.String(),
  modelOrDomain: t.String(),
  appMetadata: AppMetadataSchema,
  verificationFlags: VerificationFlagsSchema,
})

export const BatchCreateRequestSchema = t.Object({
  tasks: t.Array(TaskCreateRequestSchema),
})

// Query schemas
export const TaskListQuerySchema = t.Object({
  // Basic filters
  status: t.Optional(t.String()),
  appId: t.Optional(t.String()),
  appName: t.Optional(t.String()),
  appConfigType: t.Optional(t.String()),
  contractAddress: t.Optional(t.String()),

  // Search filters
  keyword: t.Optional(t.String()),

  // Pagination
  page: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),

  // Sorting
  sortBy: t.Optional(t.String()),
  sortOrder: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
})

// Response schemas
export const TaskResponseSchema = t.Object({
  id: t.String(),
  appId: t.String(),
  appName: t.String(),
  appConfigType: t.String(),
  contractAddress: t.String(),
  modelOrDomain: t.String(),
  verificationFlags: t.Optional(VerificationFlagsSchema),
  status: t.String(),
  errorMessage: t.Optional(t.String()),
  s3Filename: t.Optional(t.String()),
  s3Key: t.Optional(t.String()),
  s3Bucket: t.Optional(t.String()),
  createdAt: t.String(),
  startedAt: t.Optional(t.String()),
  finishedAt: t.Optional(t.String()),
})

export const TaskListResponseSchema = t.Object({
  success: t.Literal(true),
  data: t.Array(TaskResponseSchema),
  pagination: t.Object({
    total: t.Number(),
    page: t.Number(),
    limit: t.Number(),
    hasNext: t.Boolean(),
  }),
})

export const TaskDetailResponseSchema = t.Object({
  success: t.Boolean(),
  task: t.Optional(TaskResponseSchema),
  error: t.Optional(t.String()),
})

export const ErrorResponseSchema = t.Object({
  success: t.Literal(false),
  error: t.String(),
})

export const SuccessResponseSchema = t.Object({
  success: t.Literal(true),
  message: t.String(),
})

export const TaskStatsResponseSchema = t.Object({
  success: t.Literal(true),
  stats: t.Object({
    total: t.Number(),
    pending: t.Number(),
    active: t.Number(),
    completed: t.Number(),
    failed: t.Number(),
  }),
})

export const StorageInfoResponseSchema = t.Object({
  success: t.Literal(true),
  storageInfo: t.Object({
    s3Key: t.String(),
    s3Bucket: t.String(),
    s3Filename: t.Optional(t.String()),
    fileSize: t.Optional(t.Number()),
    message: t.String(),
  }),
})
