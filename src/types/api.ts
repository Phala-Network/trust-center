/**
 * API-specific types for DStack Verifier backend service
 *
 * This module defines request/response types and validation schemas
 * for the HTTP REST API endpoints.
 */

import { z } from 'zod'

import type { DataObject } from './index'
import type { AppMetadata } from './metadata'
import type { VerificationFlags } from '../config'

// Re-export VerificationFlags from config for API use
export type { VerificationFlags }

/**
 * Verification request payload for Redpill verifier
 */
export interface RedpillVerificationRequest {
  app: {
    contractAddress: `0x${string}`
    model: string
    metadata?: AppMetadata
  }
  /** Verification flags to control which steps to execute */
  flags?: VerificationFlags
}

/**
 * Verification request payload for PhalaCloud verifier
 */
export interface PhalaCloudVerificationRequest {
  app: {
    contractAddress: `0x${string}`
    domain: string
    metadata?: AppMetadata
  }
  /** Verification flags to control which steps to execute */
  flags?: VerificationFlags
}

/**
 * Union type for verification requests
 */
export type VerificationRequest =
  | RedpillVerificationRequest
  | PhalaCloudVerificationRequest

/**
 * Verification error information
 */
export interface VerificationError {
  /** Error message */
  message: string
}

/**
 * Verification response payload
 */
export interface VerificationResponse {
  /** Generated data objects */
  dataObjects: DataObject[]
  /** Timestamp when verification completed */
  completedAt: string
  /** Any errors that occurred during verification */
  errors: VerificationError[]
  /** Overall success status */
  success: boolean
}

/**
 * Zod schema for hex string validation
 */
const HexStringSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex string')

/**
 * Zod schema for OS source metadata
 */
const OSSourceSchema = z.object({
  github_repo: z.string(),
  git_commit: z.string(),
  version: z.string(),
})

/**
 * Zod schema for App source metadata
 */
const AppSourceSchema = z.object({
  github_repo: z.string(),
  git_commit: z.string(),
  version: z.string(),
  model_name: z.string().optional(),
})

/**
 * Zod schema for hardware metadata
 */
const HardwareSchema = z.object({
  cpuManufacturer: z.string(),
  cpuModel: z.string(),
  securityFeature: z.string(),
  hasNvidiaSupport: z.boolean().optional(),
})

/**
 * Zod schema for governance metadata
 */
const GovernanceSchema = z.object({
  blockchain: z.string(),
  blockchainExplorerUrl: z.string(),
  chainId: z.number().optional(),
})

/**
 * Zod schema for structured verifier metadata
 * Matches AppMetadata type structure exactly
 */
const StructuredMetadataSchema = z.object({
  osSource: OSSourceSchema, // Required in AppMetadata
  appSource: AppSourceSchema.optional(), // Optional in AppMetadata
  hardware: HardwareSchema, // Required in AppMetadata
  governance: GovernanceSchema.optional(), // Optional in AppMetadata
})

/**
 * Zod schema for verification flags
 */
const VerificationFlagsSchema = z.object({
  hardware: z.boolean(),
  os: z.boolean(),
  sourceCode: z.boolean(),
  teeControlledKey: z.boolean(),
  certificateKey: z.boolean(),
  dnsCAA: z.boolean(),
  ctLog: z.boolean(),
}).optional()

/**
 * Zod schema for Redpill verification request
 */
const RedpillVerificationRequestSchema = z.object({
  app: z.object({
    contractAddress: HexStringSchema,
    model: z.string(),
    metadata: StructuredMetadataSchema,
  }),
  flags: VerificationFlagsSchema,
})

/**
 * Zod schema for PhalaCloud verification request
 */
const PhalaCloudVerificationRequestSchema = z.object({
  app: z.object({
    contractAddress: HexStringSchema,
    domain: z.string(),
    metadata: StructuredMetadataSchema,
  }),
  flags: VerificationFlagsSchema,
})

/**
 * Zod schema for verification request (discriminated union)
 */
export const VerificationRequestSchema = z.union([
  RedpillVerificationRequestSchema,
  PhalaCloudVerificationRequestSchema,
])

/**
 * Zod schema for verification error
 */
export const VerificationErrorSchema = z.object({
  message: z.string(),
})

/**
 * Zod schema for verification response
 */
export const VerificationResponseSchema = z.object({
  dataObjects: z.array(z.unknown()), // DataObject schema would be complex, using unknown for now
  completedAt: z.string(),
  errors: z.array(VerificationErrorSchema),
  success: z.boolean(),
})

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string
  message: string
  statusCode: number
}

/**
 * Zod schema for API error response
 */
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
})
