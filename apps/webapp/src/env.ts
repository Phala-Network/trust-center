import {createEnv} from '@t3-oss/env-nextjs'
import {z} from 'zod'

export const env = createEnv({
  server: {
    DATABASE_POSTGRES_URL: z.string(),

    // Shared secret with Phala Cloud. Signs webhook pushes (server app) and the
    // Cloud status API (this app); same value as the server's PHALA_CLOUD_API_KEY.
    PHALA_CLOUD_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_S3_BUCKET_URL: z.url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_S3_BUCKET_URL: process.env.NEXT_PUBLIC_S3_BUCKET_URL,
  },
})
