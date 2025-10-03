import {createEnv} from '@t3-oss/env-nextjs'
import {z} from 'zod'

export const env = createEnv({
  server: {
    DATABASE_POSTGRES_URL: z.string(),
    VERIFIER_BASE_URL: z.url(),
    METABASE_URL: z.url(),
    METABASE_API_KEY: z.string(),
  },
  client: {
    NEXT_PUBLIC_S3_BUCKET_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_S3_BUCKET_URL: process.env.NEXT_PUBLIC_S3_BUCKET_URL,
  },
})
