import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import {z} from 'zod'

// Status enum for verification tasks
export const verificationTaskStatusEnum = pgEnum('verification_task_status', [
  'pending',
  'active',
  'completed',
  'failed',
  'cancelled',
])

// App config type enum
export const appConfigTypeEnum = pgEnum('app_config_type', [
  'redpill',
  'phala_cloud',
])

// Profile entity type enum
export const profileEntityTypeEnum = pgEnum('profile_entity_type', [
  'app',
  'user',
  'workspace',
])

// Zod schemas for validation
export const AppConfigTypeSchema = z.enum(['redpill', 'phala_cloud'])

export const ProfileEntityTypeSchema = z.enum(['app', 'user', 'workspace'])

export const VerificationTaskStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'failed',
  'cancelled',
])

export const VerificationFlagsSchema = z.object({
  hardware: z.boolean().optional(),
  os: z.boolean().optional(),
  sourceCode: z.boolean().optional(),
  domainOwnership: z.boolean().optional(),
})

export const TaskCreateRequestSchema = z.object({
  appId: z.string(),
  appProfileId: z.number(), // Required for new tasks
  appName: z.string(),
  appConfigType: AppConfigTypeSchema,
  contractAddress: z.string(),
  modelOrDomain: z.string(),
  dstackVersion: z.string().optional(),
  metadata: z.any().optional(),
  flags: VerificationFlagsSchema.optional(),
  user: z.string().optional(),
  workspaceId: z.number(), // Required for new tasks
  creatorId: z.number(), // Required for new tasks
})

export const TaskSchema = z.object({
  id: z.string(),
  appId: z.string(),
  appProfileId: z.number().nullable(), // Nullable for backward compatibility with old data
  appName: z.string(),
  appConfigType: AppConfigTypeSchema,
  contractAddress: z.string(),
  modelOrDomain: z.string(),
  verificationFlags: VerificationFlagsSchema.nullable(),
  status: z.string(),
  errorMessage: z.string().optional(),
  s3Filename: z.string().optional(),
  s3Key: z.string().optional(),
  s3Bucket: z.string().optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  user: z.string().optional(),
  workspaceId: z.number().nullable(), // Nullable for backward compatibility with old data
  creatorId: z.number().nullable(), // Nullable for backward compatibility with old data
  dstackVersion: z.string().optional(),
  dataObjects: z.array(z.string()).optional(),
  isPublic: z.boolean(),
})

export const ProfileSchema = z.object({
  id: z.string(),
  entityType: ProfileEntityTypeSchema,
  entityId: z.number(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  description: z.string().nullable(),
  customDomain: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})

// Upstream app data schema (from Metabase) - for validation
export const UpstreamAppDataSchema = z.object({
  app_id: z.number(),
  dstack_app_id: z.string(),
  app_name: z.string(),
  workspace_id: z.number(),
  creator_id: z.number(),
  chain_id: z.number().nullable(),
  kms_contract_address: z.string().nullable(),
  contract_address: z.string().nullable(),
  base_image: z.string(),
  tproxy_base_domain: z.string().nullable(),
  gateway_domain_suffix: z.string().nullable(),
  listed: z.boolean(),
  username: z.string(),
  email: z.string().nullable(),
  app_created_at: z.string(),
  vm_created_at: z.string(),
})

// Upstream profile data schema (from Metabase) - for validation
export const UpstreamProfileDataSchema = z.object({
  entity_type: ProfileEntityTypeSchema,
  entity_id: z.number(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  description: z.string().nullable(),
  custom_domain: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
})

// Verification tasks table - stores VerificationService execution data
export const verificationTasksTable = pgTable(
  'verification_tasks',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Task identification and BullMQ correlation
    jobName: text().notNull().default('verification'),
    bullJobId: text(), // BullMQ job ID for correlation

    // Application identification
    appId: text().notNull(), // dstack_app_id from Metabase (used for contract address)
    appProfileId: integer(), // app_id from Metabase (database ID, used for profile lookup) - nullable for backward compatibility
    appName: text().notNull(),
    appConfigType: appConfigTypeEnum().notNull(), // redpill or phala_cloud
    dstackVersion: text(), // DStack version (e.g., 'v0.5.3')

    // App configuration (VerificationService input)
    contractAddress: text().notNull(), // Smart contract address
    modelOrDomain: text().notNull(), // Model for redpill, domain for phala_cloud
    appMetadata: jsonb(), // Structured metadata (OS, hardware, etc.)

    // Verification flags (VerificationService input)
    verificationFlags: jsonb(), // Which steps to execute

    // Task status and execution
    status: verificationTaskStatusEnum().notNull().default('pending'),
    errorMessage: text(), // Failure error message

    // Storage information (VerificationService output stored in S3-compatible storage)
    s3Filename: text(),
    s3Key: text(),
    s3Bucket: text(),
    dataObjects: jsonb().$type<string[]>(), // Array of data object IDs

    // Public visibility flag
    isPublic: boolean().notNull().default(false), // Whether app is listed publicly

    // User identification
    user: text(), // User identifier assigned based on business rules
    workspaceId: integer(), // Workspace ID from upstream (Metabase)
    creatorId: integer(), // Creator user ID from upstream (Metabase)

    // Timestamps
    createdAt: timestamp().notNull().defaultNow(),
    startedAt: timestamp(),
    finishedAt: timestamp(),
  },
  (t) => [
    // Task management indexes
    index().on(t.jobName),
    index().on(t.status),
    index().on(t.bullJobId),
    index().on(t.createdAt),
    index().on(t.startedAt),
    index().on(t.finishedAt),

    // Application indexes
    index().on(t.appId),
    index().on(t.appProfileId),
    index().on(t.appName),
    index().on(t.appConfigType),
    index().on(t.contractAddress),
    index().on(t.modelOrDomain),
    index().on(t.dstackVersion),
    index().on(t.isPublic),
    index().on(t.user),
    index().on(t.workspaceId),
    index().on(t.creatorId),
  ],
)

// Profiles table - stores entity profile information from Metabase
export const profilesTable = pgTable(
  'profiles',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Entity identification (composite unique key)
    entityType: profileEntityTypeEnum().notNull(), // app, user, workspace
    entityId: integer().notNull(), // The ID from the entity (app_id, user_id, workspace_id)

    // Profile information
    displayName: text(),
    avatarUrl: text(),
    description: text(),
    customDomain: text(),

    // Timestamps
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp(),
  },
  (t) => [
    // Unique constraint on entity type + entity ID
    uniqueIndex('entity_unique_idx').on(t.entityType, t.entityId),

    // Query indexes
    index().on(t.entityType),
    index().on(t.entityId),
    index().on(t.displayName),
    index().on(t.customDomain),
  ],
)

// Infer types from Zod schemas
export type VerificationFlags = z.infer<typeof VerificationFlagsSchema>
export type TaskCreateRequest = z.infer<typeof TaskCreateRequestSchema>
export type Task = z.infer<typeof TaskSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type UpstreamAppData = z.infer<typeof UpstreamAppDataSchema>
export type UpstreamProfileData = z.infer<typeof UpstreamProfileDataSchema>

// Drizzle inferred types
export type VerificationTask = typeof verificationTasksTable.$inferSelect
export type NewVerificationTask = typeof verificationTasksTable.$inferInsert
export type VerificationTaskStatus =
  (typeof verificationTaskStatusEnum.enumValues)[number]
export type AppConfigType = (typeof appConfigTypeEnum.enumValues)[number]
export type ProfileEntityType = (typeof profileEntityTypeEnum.enumValues)[number]
export type ProfileRecord = typeof profilesTable.$inferSelect
export type NewProfileRecord = typeof profilesTable.$inferInsert
