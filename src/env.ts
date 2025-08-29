import { createEnv } from '@t3-oss/env-core'
import { type Address, isAddress } from 'viem'
import { z } from 'zod'

const contractAddressSchema = z
  .string()
  .refine(isAddress, { message: 'Invalid contract address' })
  .transform((address) => address as Address)

export const env = createEnv({
  server: {
    // Server configuration
    PORT: z.coerce.number().positive().default(3000),
    HOST: z.string().default('localhost'),

    // KMS configuration
    KMS_CONTRACT_ADDRESS: contractAddressSchema.default(
      '0xbfd2d557118fc650ea25a0e7d85355d335f259d8',
    ),
    KMS_OS_VERSION: z.string().default('0.5.3'),
    KMS_GIT_REVISION: z
      .string()
      .length(40)
      .default('c06e524bd460fd9c9add835b634d155d4b08d7e7'),

    // Gateway configuration
    GATEWAY_CONTRACT_ADDRESS: contractAddressSchema.default('0x'),
    GATEWAY_RPC_ENDPOINT: z
      .url()
      .default('https://gateway.llm-04.phala.network:9204/'),
    GATEWAY_OS_VERSION: z.string().default('0.5.3'),
    GATEWAY_GIT_REVISION: z
      .string()
      .length(40)
      .default('c06e524bd460fd9c9add835b634d155d4b08d7e7'),

    // Redpill configuration
    REDPILL_CONTRACT_ADDRESS: contractAddressSchema.default(
      '0x78601222ada762fa7cdcbc167aa66dd7a5f57ece',
    ),
    REDPILL_MODEL: z.string().default('phala/deepseek-chat-v3-0324'),
    REDPILL_OS_VERSION: z.string().default('0.5.3'),
    REDPILL_GIT_REVISION: z
      .string()
      .length(40)
      .default('92aa6f0b03337949e3e41618a4f9a65c7648bae6'),

    // R2 configuration
    R2_ENDPOINT: z.url(),
    R2_ACCESS_KEY_ID: z.string(),
    R2_SECRET_ACCESS_KEY: z.string(),
    R2_BUCKET: z.string(),

    // Verification flags (optional)
    VERIFICATION_FLAGS: z.string().optional(),

    // Database configuration
    DATABASE_URL: z.string().default('postgresql://localhost:5432/dstack_verifier'),

    // Queue configuration
    REDIS_URL: z.string().default('redis://localhost:6379'),
    QUEUE_NAME: z.string().default('verification-queue'),
    QUEUE_CONCURRENCY: z.string().default('5'),
    QUEUE_MAX_ATTEMPTS: z.string().default('3'),
    QUEUE_BACKOFF_DELAY: z.string().default('2000'),

    // Queue server configuration
    QUEUE_PORT: z.string().default('3001'),
    QUEUE_HOST: z.string().default('localhost'),
  },
  runtimeEnv: process.env,
})
