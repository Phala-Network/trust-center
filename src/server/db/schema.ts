import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Status enum for verification tasks
export const verificationTaskStatusEnum = pgEnum('verification_task_status', [
  'pending',
  'active',
  'completed',
  'failed',
])

// Verifier type enum for verification tasks
export const verifierTypeEnum = pgEnum('verifier_type', [
  'kms',
  'gateway',
  'redpill',
])

// Single verification_tasks table for hybrid architecture
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
    verifierType: verifierTypeEnum('verifier_type').notNull(),

    // Task data and status
    payload: text('payload').notNull(), // Task input data as JSON string (config, flags, metadata, etc.)
    status: verificationTaskStatusEnum('status').notNull().default('pending'),
    errorMessage: text('error_message'), // Failure error message

    // Storage information
    fileName: text('file_name'),
    r2Key: text('r2_key'),
    r2Bucket: text('r2_bucket'),

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

    // Verification indexes
    index('app_id_idx').on(t.appId),
    index('app_name_idx').on(t.appName),
    index('verifier_type_idx').on(t.verifierType),
  ],
)

export type VerificationTask = typeof verificationTasks.$inferSelect
export type VerificationTaskStatus =
  (typeof verificationTaskStatusEnum.enumValues)[number]
export type VerifierType = (typeof verifierTypeEnum.enumValues)[number]
