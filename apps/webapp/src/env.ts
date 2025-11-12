import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_POSTGRES_URL: z.string(),
    // Vijil Integration (optional)
    VIJIL_API_URL: z
      .string()
      .url()
      .optional()
      .default('https://evaluate-api.vijil.ai'),
    VIJIL_API_TOKEN: z.string().optional().default(''),
    VIJIL_AGENT_WHITELIST: z.string().optional().default(''),
  },
  client: {
    NEXT_PUBLIC_S3_BUCKET_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_S3_BUCKET_URL: process.env.NEXT_PUBLIC_S3_BUCKET_URL,
  },
})
