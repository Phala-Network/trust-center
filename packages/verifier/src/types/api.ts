/**
 * API-specific types for DStack Verifier backend service
 *
 * This module defines request/response types and validation schemas
 * for the HTTP REST API endpoints.
 */

import { z } from 'zod'

import type { VerificationFlags } from '../config'
import type { DataObject } from './index'
import type { AppMetadata } from './metadata'
import type { AppId, ContractAddress } from './utils'

/**
 * Verification request payload for Redpill verifier
 */
export interface RedpillVerificationRequest {
  app: {
    contractAddress: ContractAddress
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
    appId: AppId
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
 * Zod schema for app ID (without 0x prefix, defensive - strips if present)
 */
const AppIdInputSchema = z
  .string()
  .min(40)
  .transform((val) => {
    const cleaned = val.toLowerCase().startsWith('0x') ? val.slice(2) : val
    return cleaned as AppId
  })

/**
 * Zod schema for OS source metadata (API input - all fields optional)
 */
const OSSourceSchema = z.object({
  github_repo: z.string(),
  git_commit: z.string(),
  version: z.templateLiteral(['v', z.string()]),
})

/**
 * Zod schema for App source metadata (API input - all fields optional)
 */
const AppSourceSchema = z.object({
  github_repo: z.string(),
  git_commit: z.string(),
  version: z.string(),
  model_name: z.string().optional(),
})

/**
 * Zod schema for hardware metadata (API input - all fields optional)
 */
const HardwareSchema = z.object({
  cpuManufacturer: z.string(),
  cpuModel: z.string(),
  securityFeature: z.string(),
  hasNvidiaSupport: z.boolean().optional(),
})

/**
 * Zod schema for governance metadata (API input - all fields optional)
 */
const GovernanceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('OnChain'),
    blockchain: z.string(),
    blockchainExplorerUrl: z.string(),
    chainId: z.number(),
  }),
  z.object({
    type: z.literal('HostedBy'),
    host: z.string(),
  }),
])

/**
 * Zod schema for structured verifier metadata (API input)
 * All fields are optional for API input
 */
const StructuredMetadataInputSchema = z.object({
  osSource: OSSourceSchema.optional(),
  appSource: AppSourceSchema.optional(),
  hardware: HardwareSchema.optional(),
  governance: GovernanceSchema.optional(),
})

/**
 * Zod schema for verification flags
 */
const VerificationFlagsSchema = z
  .object({
    hardware: z.boolean(),
    os: z.boolean(),
    sourceCode: z.boolean(),
    teeControlledKey: z.boolean(),
    certificateKey: z.boolean(),
    dnsCAA: z.boolean(),
    ctLog: z.boolean(),
  })
  .optional()

/**
 * Zod schema for Redpill verification request
 */
const RedpillVerificationRequestSchema = z.object({
  app: z.object({
    contractAddress: HexStringSchema,
    model: z.string(),
    metadata: StructuredMetadataInputSchema,
  }),
  flags: VerificationFlagsSchema,
})

/**
 * Zod schema for PhalaCloud verification request
 */
const PhalaCloudVerificationRequestSchema = z.object({
  app: z.object({
    appId: AppIdInputSchema,
    domain: z.string(),
    metadata: StructuredMetadataInputSchema,
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
