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
  appId: z.string(), // References apps.id (dstack app ID)
  metadata: z.any().optional(), // Runtime metadata from systemInfo
  flags: VerificationFlagsSchema.optional(),
})

export const TaskSchema = z.object({
  id: z.string(),
  appId: z.string().nullable(), // References apps.id (dstack app ID, nullable when app is deleted)
  appName: z.string(), // From apps table
  appConfigType: AppConfigTypeSchema, // From apps table
  contractAddress: z.string(), // From apps table
  domain: z.string(), // From apps table
  dstackVersion: z.string().nullable(), // From apps table
  isPublic: z.boolean(), // From apps table
  verificationFlags: VerificationFlagsSchema.nullable(),
  status: z.string(),
  errorMessage: z.string().nullable(),
  s3Filename: z.string().nullable(),
  s3Key: z.string().nullable(),
  s3Bucket: z.string().nullable(),
  dataObjects: z.array(z.string()).nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  user: z.string().nullable(), // Deprecated, use profiles
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
  dstack_app_id: z.string(), // Primary key
  app_id: z.number(), // Profile ID
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
  username: z.string().nullable(),
  email: z.string().nullable(),
  app_created_at: z.string(),
  vm_created_at: z.string(),
  docker_compose_file: z.string().nullable(),
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

// App Zod schema
export const AppSchema = z.object({
  id: z.string(), // dstack app ID (primary key)
  profileId: z.number(), // Profile ID (formerly upstreamAppId)
  appName: z.string(),
  appConfigType: AppConfigTypeSchema,
  contractAddress: z.string(),
  domain: z.string(),
  dstackVersion: z.string().nullable(),
  workspaceId: z.number(),
  creatorId: z.number(),
  chainId: z.number().nullable(),
  kmsContractAddress: z.string().nullable(),
  baseImage: z.string(),
  tproxyBaseDomain: z.string().nullable(),
  gatewayDomainSuffix: z.string().nullable(),
  isPublic: z.boolean(),
  deleted: z.boolean(), // Whether app is deleted from upstream
  username: z.string().nullable(), // Creator username from upstream
  email: z.string().nullable(), // Creator email from upstream
  customUser: z.string().nullable(), // Custom user label determined by business rules
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
})

// Apps table - stores application information synced from Metabase
export const appsTable = pgTable(
  'apps',
  {
    // Primary key - dstack app ID (e.g., "0x1234...")
    id: text().primaryKey(), // dstack_app_id

    // Upstream sync fields (from Metabase)
    profileId: integer().notNull().unique(), // app_id from Metabase, used for profile lookup
    appName: text().notNull(),
    appConfigType: appConfigTypeEnum().notNull(), // redpill or phala_cloud

    // App configuration
    contractAddress: text().notNull(),
    domain: text().notNull(),
    dstackVersion: text(), // DStack version (e.g., 'v0.5.3')

    // Upstream metadata
    workspaceId: integer().notNull(),
    creatorId: integer().notNull(),
    chainId: integer(),
    kmsContractAddress: text(),
    baseImage: text().notNull(),
    tproxyBaseDomain: text(),
    gatewayDomainSuffix: text(),

    // Creator info from upstream (not editable, synced from Metabase)
    username: text(), // Creator username (optional)
    email: text(), // Creator email
    customUser: text(), // Custom user label determined by business rules (e.g., 'Crossmint', 'Vana', 'NEAR')

    // Status
    isPublic: boolean().notNull().default(false), // Whether app is listed publicly
    deleted: boolean().notNull().default(false), // Whether app is deleted from upstream

    // Timestamps
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp(),
    lastSyncedAt: timestamp(), // Last sync from upstream
  },
  (t) => [
    // Unique constraints
    uniqueIndex('app_profile_id_idx').on(t.profileId),

    // Query indexes
    index().on(t.appName),
    index().on(t.contractAddress),
    index().on(t.workspaceId),
    index().on(t.creatorId),
    index().on(t.isPublic),
    index().on(t.deleted),
    index().on(t.appConfigType),
  ],
)

// Verification tasks table - stores VerificationService execution data
export const verificationTasksTable = pgTable(
  'verification_tasks',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Foreign key to apps table
    appId: text().notNull(),

    // Task identification and BullMQ correlation
    jobName: text().notNull().default('verification'),
    bullJobId: text(), // BullMQ job ID for correlation

    // Verification configuration
    appMetadata: jsonb(), // Runtime metadata from systemInfo (OS, hardware, etc.)
    verificationFlags: jsonb(), // Which verification steps to execute

    // Task status and execution
    status: verificationTaskStatusEnum().notNull().default('pending'),
    errorMessage: text(), // Failure error message

    // Storage information (VerificationService output stored in S3-compatible storage)
    s3Filename: text(),
    s3Key: text(),
    s3Bucket: text(),
    dataObjects: jsonb().$type<string[]>(), // Array of data object IDs

    // Timestamps
    createdAt: timestamp().notNull().defaultNow(),
    startedAt: timestamp(),
    finishedAt: timestamp(),
  },
  (t) => [
    // Task management indexes
    index().on(t.appId),
    index().on(t.jobName),
    index().on(t.status),
    index().on(t.bullJobId),
    index().on(t.createdAt),
    index().on(t.startedAt),
    index().on(t.finishedAt),
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
export type App = z.infer<typeof AppSchema>
export type UpstreamAppData = z.infer<typeof UpstreamAppDataSchema>
export type UpstreamProfileData = z.infer<typeof UpstreamProfileDataSchema>

// Drizzle inferred types
export type VerificationTask = typeof verificationTasksTable.$inferSelect
export type NewVerificationTask = typeof verificationTasksTable.$inferInsert
export type VerificationTaskStatus =
  (typeof verificationTaskStatusEnum.enumValues)[number]
export type AppConfigType = (typeof appConfigTypeEnum.enumValues)[number]
export type ProfileEntityType =
  (typeof profileEntityTypeEnum.enumValues)[number]
export type ProfileRecord = typeof profilesTable.$inferSelect
export type NewProfileRecord = typeof profilesTable.$inferInsert
export type AppRecord = typeof appsTable.$inferSelect
export type NewAppRecord = typeof appsTable.$inferInsert
