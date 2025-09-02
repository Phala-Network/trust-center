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
export const verificationTasks = pgTable(
  'verification_tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Task identification and BullMQ correlation
    jobName: text('job_name').notNull().default('verification'),
    bullJobId: text('bull_job_id'), // BullMQ job ID for correlation

    // Application identification
    appId: text('app_id').notNull(),
    appName: text('app_name').notNull(),
    appConfigType: appConfigTypeEnum('app_config_type').notNull(), // redpill or phala_cloud

    // App configuration (VerificationService input)
    contractAddress: text('contract_address').notNull(), // Smart contract address
    modelOrDomain: text('model_or_domain').notNull(), // Model for redpill, domain for phala_cloud
    appMetadata: jsonb('app_metadata'), // Structured metadata (OS, hardware, etc.)

    // Verification flags (VerificationService input)
    verificationFlags: jsonb('verification_flags').notNull(), // Which steps to execute

    // Task status and execution
    status: verificationTaskStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'), // Failure error message

    // Storage information (VerificationService output stored in S3-compatible storage)
    s3Filename: text('s3_filename'),
    s3Key: text('s3_key'),
    s3Bucket: text('s3_bucket'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
  },
  (t) => [
    // Task management indexes
    index('job_name_idx').on(t.jobName),
    index('status_idx').on(t.status),
    index('bull_job_id_idx').on(t.bullJobId),
    index('created_at_idx').on(t.createdAt),
    index('started_at_idx').on(t.startedAt),
    index('finished_at_idx').on(t.finishedAt),

    // Application indexes
    index('app_id_idx').on(t.appId),
    index('app_name_idx').on(t.appName),
    index('app_config_type_idx').on(t.appConfigType),
    index('contract_address_idx').on(t.contractAddress),
    index('model_or_domain_idx').on(t.modelOrDomain),
  ],
)

export type VerificationTask = typeof verificationTasks.$inferSelect
export type VerificationTaskStatus =
  (typeof verificationTaskStatusEnum.enumValues)[number]
export type AppConfigType = (typeof appConfigTypeEnum.enumValues)[number]
