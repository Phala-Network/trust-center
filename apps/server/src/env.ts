import {createEnv} from '@t3-oss/env-core'
import {z} from 'zod'

export const env = createEnv({
  server: {
    // Server configuration
    PORT: z.coerce.number().positive().default(3000),
    HOST: z.string().default('localhost'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('production'),

    // S3 configuration
    S3_ENDPOINT: z.string(),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    S3_BUCKET: z.string(),

    // Verification flags (optional)
    VERIFICATION_FLAGS: z.string().optional(),

    // Database configuration
    DATABASE_URL: z
      .string()
      .default('postgresql://localhost:5432/dstack_verifier'),

    // Queue configuration
    REDIS_URL: z.string().default('redis://localhost:6379'),
    QUEUE_NAME: z.string().default('verification-queue'),
    QUEUE_CONCURRENCY: z.string().default('5'),
    QUEUE_MAX_ATTEMPTS: z.string().default('3'),
    QUEUE_BACKOFF_DELAY: z.string().default('2000'),

    // Sync service configuration
    METABASE_APP_QUERY: z.url().optional(),
    METABASE_PROFILE_QUERY: z.url().optional(),
    METABASE_API_KEY: z.string().optional(),

    // Cron API authentication (required)
    CRON_API_KEY: z.string().min(1, 'CRON_API_KEY must not be empty'),

    // Cron patterns (configurable)
    PROFILE_CRON_PATTERN: z.string().default('*/1 * * * *'), // Default: every 1 minute
    TASKS_CRON_PATTERN: z.string().default('*/5 * * * *'), // Default: every 5 minutes

    BASE_RPC_URL: z.string().optional(),
    ETHEREUM_RPC_URL: z.string().optional(),
  },
  runtimeEnv: process.env,
})
