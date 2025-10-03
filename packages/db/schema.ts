import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

// Zod schemas for validation
export const AppConfigTypeSchema = z.enum(['redpill', 'phala_cloud'])

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
  appName: z.string(),
  appConfigType: AppConfigTypeSchema,
  contractAddress: z.string(),
  modelOrDomain: z.string(),
  metadata: z.any().optional(),
  flags: VerificationFlagsSchema.optional(),
})

export const TaskSchema = z.object({
  id: z.string(),
  appId: z.string(),
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
    appId: text().notNull(),
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
    index().on(t.appName),
    index().on(t.appConfigType),
    index().on(t.contractAddress),
    index().on(t.modelOrDomain),
    index().on(t.dstackVersion),
  ],
)

// Infer types from Zod schemas
export type VerificationFlags = z.infer<typeof VerificationFlagsSchema>
export type TaskCreateRequest = z.infer<typeof TaskCreateRequestSchema>
export type Task = z.infer<typeof TaskSchema>

// Drizzle inferred types
export type VerificationTask = typeof verificationTasksTable.$inferSelect
export type VerificationTaskStatus =
  (typeof verificationTaskStatusEnum.enumValues)[number]
export type AppConfigType = (typeof appConfigTypeEnum.enumValues)[number]
