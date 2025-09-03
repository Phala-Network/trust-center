import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// Status enum for verification tasks
export const verificationTaskStatusEnum = pgEnum('verification_task_status', [
  'pending',
  'active',
  'completed',
  'failed',
])

// App config type enum
export const appConfigTypeEnum = pgEnum('app_config_type', [
  'redpill',
  'phala_cloud',
])

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
  ],
)

export type VerificationTask = typeof verificationTasksTable.$inferSelect
export type VerificationTaskStatus =
  (typeof verificationTaskStatusEnum.enumValues)[number]
export type AppConfigType = (typeof appConfigTypeEnum.enumValues)[number]
