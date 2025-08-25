/**
 * API-specific types for DStack Verifier backend service
 *
 * This module defines request/response types and validation schemas
 * for the HTTP REST API endpoints.
 */

import {z} from 'zod'
import type {DataObject} from './index'

/**
 * Verifier type enumeration
 */
export type VerifierType = 'kms' | 'gateway' | 'redpill'

/**
 * Verification request payload
 */
export interface VerificationRequest {
  /** Type of verifier to run */
  verifierType: VerifierType
  /** Configuration overrides (optional) */
  config?: {
    kms?: {
      contractAddress?: `0x${string}`
      metadata?: {
        osVersion?: string
        gitRevision?: string
      }
    }
    gateway?: {
      contractAddress?: `0x${string}`
      rpcEndpoint?: string
      metadata?: {
        osVersion?: string
        gitRevision?: string
      }
    }
    redpill?: {
      contractAddress?: `0x${string}`
      model?: string
      metadata?: {
        osVersion?: string
        gitRevision?: string
      }
    }
  }
  /** Verification flags to control which steps to execute */
  flags?: {
    hardware?: boolean
    os?: boolean
    sourceCode?: boolean
    teeControlledKey?: boolean
    certificateKey?: boolean
    dnsCAA?: boolean
    ctLog?: boolean
  }
}

/**
 * Execution metadata for verification steps
 */
export interface ExecutionMetadata {
  /** Total execution time in milliseconds */
  totalTimeMs: number
  /** Execution time per step */
  stepTimes: {
    [stepName: string]: number
  }
  /** Which steps were executed */
  executedSteps: string[]
  /** Which steps were skipped */
  skippedSteps: string[]
  /** Timestamp when verification started */
  startedAt: string
  /** Timestamp when verification completed */
  completedAt: string
}

/**
 * Verification error information
 */
export interface VerificationError {
  /** Step where error occurred */
  step: string
  /** Error message */
  message: string
  /** Error code (optional) */
  code?: string
  /** Additional error details */
  details?: unknown
}

/**
 * Verification response payload
 */
export interface VerificationResponse {
  /** Generated data objects */
  dataObjects: DataObject[]
  /** Execution metadata */
  metadata: ExecutionMetadata
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
 * Zod schema for verifier metadata
 */
const VerifierMetadataSchema = z
  .object({
    osVersion: z.string().optional(),
    gitRevision: z.string().optional(),
  })
  .optional()

/**
 * Zod schema for KMS configuration
 */
const KmsConfigSchema = z
  .object({
    contractAddress: HexStringSchema.optional(),
    metadata: VerifierMetadataSchema,
  })
  .optional()

/**
 * Zod schema for Gateway configuration
 */
const GatewayConfigSchema = z
  .object({
    contractAddress: HexStringSchema.optional(),
    rpcEndpoint: z.string().url().optional(),
    metadata: VerifierMetadataSchema,
  })
  .optional()

/**
 * Zod schema for Redpill configuration
 */
const RedpillConfigSchema = z
  .object({
    contractAddress: HexStringSchema.optional(),
    model: z.string().optional(),
    metadata: VerifierMetadataSchema,
  })
  .optional()

/**
 * Zod schema for verification flags
 */
const VerificationFlagsSchema = z
  .object({
    hardware: z.boolean().optional(),
    os: z.boolean().optional(),
    sourceCode: z.boolean().optional(),
    teeControlledKey: z.boolean().optional(),
    certificateKey: z.boolean().optional(),
    dnsCAA: z.boolean().optional(),
    ctLog: z.boolean().optional(),
  })
  .optional()

/**
 * Zod schema for verification request
 */
export const VerificationRequestSchema = z.object({
  verifierType: z.enum(['kms', 'gateway', 'redpill']),
  config: z
    .object({
      kms: KmsConfigSchema,
      gateway: GatewayConfigSchema,
      redpill: RedpillConfigSchema,
    })
    .optional(),
  flags: VerificationFlagsSchema,
})

/**
 * Zod schema for execution metadata
 */
export const ExecutionMetadataSchema = z.object({
  totalTimeMs: z.number(),
  stepTimes: z.record(z.string(), z.number()),
  executedSteps: z.array(z.string()),
  skippedSteps: z.array(z.string()),
  startedAt: z.string(),
  completedAt: z.string(),
})

/**
 * Zod schema for verification error
 */
export const VerificationErrorSchema = z.object({
  step: z.string(),
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
})

/**
 * Zod schema for verification response
 */
export const VerificationResponseSchema = z.object({
  dataObjects: z.array(z.unknown()), // DataObject schema would be complex, using unknown for now
  metadata: ExecutionMetadataSchema,
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
