/**
 * Configuration system for DStack Verifier backend service
 *
 * This module provides structured configuration for verifier instances
 * and granular control over verification steps that may take long time.
 */

import { z } from 'zod'

import {
  AppMetadataSchema,
  GatewayMetadataSchema,
  KmsMetadataSchema,
} from './types/metadata'

/**
 * Ethereum address schema
 */
const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address')
  .transform((addr) => addr as `0x${string}`)

/**
 * Configuration for KMS verifier
 */
export const KmsConfigSchema = z.object({
  /** KMS smart contract address */
  contractAddress: EthereumAddressSchema,
  /** Verifier metadata (optional - will be generated from systemInfo if not provided) */
  metadata: KmsMetadataSchema.optional(),
})

/**
 * Configuration for Gateway verifier
 */
export const GatewayConfigSchema = z.object({
  /** Gateway smart contract address */
  contractAddress: EthereumAddressSchema,
  /** Gateway RPC endpoint URL */
  rpcEndpoint: z.string().url(),
  /** Verifier metadata (optional - will be generated from systemInfo if not provided) */
  metadata: GatewayMetadataSchema.optional(),
})

/**
 * Configuration for Redpill verifier
 */
export const RedpillConfigSchema = z.object({
  /** Redpill smart contract address */
  contractAddress: EthereumAddressSchema,
  /** Model identifier */
  model: z.string().min(1),
  /** Verifier metadata (optional - will be generated from systemInfo if not provided) */
  metadata: AppMetadataSchema.optional(),
})

/**
 * Configuration for PhalaCloud verifier
 */
export const PhalaCloudConfigSchema = z.object({
  /** PhalaCloud smart contract address */
  contractAddress: EthereumAddressSchema,
  /** Domain identifier */
  domain: z.string().min(1),
  /** Verifier metadata (optional - will be generated from systemInfo if not provided) */
  metadata: AppMetadataSchema.optional(),
})

/**
 * Granular flags for controlling verification steps that may take long time
 */
export const VerificationFlagsSchema = z.object({
  /** Enable hardware verification (TEE quote validation) */
  hardware: z.boolean(),
  /** Enable operating system verification (measurement validation) */
  os: z.boolean(),
  /** Enable source code verification (compose hash validation) */
  sourceCode: z.boolean(),
  /** Enable TEE controlled key verification */
  teeControlledKey: z.boolean(),
  /** Enable certificate key verification */
  certificateKey: z.boolean(),
  /** Enable DNS CAA verification (can be slow due to DNS queries) */
  dnsCAA: z.boolean(),
  /** Enable Certificate Transparency log verification (can be very slow due to crt.sh queries) */
  ctLog: z.boolean(),
})

/**
 * Server configuration
 */
export const ServerConfigSchema = z.object({
  /** Server port */
  port: z.number().int().positive(),
  /** Server host */
  host: z.string().min(1),
})

// Export TypeScript types from Zod schemas
export type KmsConfig = z.infer<typeof KmsConfigSchema>
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>
export type RedpillConfig = z.infer<typeof RedpillConfigSchema>
export type PhalaCloudConfig = z.infer<typeof PhalaCloudConfigSchema>
export type VerificationFlags = z.infer<typeof VerificationFlagsSchema>
export type ServerConfig = z.infer<typeof ServerConfigSchema>

/**
 * Default verification flags - all enabled
 */
export const DEFAULT_VERIFICATION_FLAGS: VerificationFlags = {
  hardware: true,
  os: true,
  sourceCode: true,
  teeControlledKey: true,
  certificateKey: true,
  dnsCAA: true,
  ctLog: false, // Skip CT log queries
}

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  host: process.env.HOST ?? 'localhost',
}
