/**
 * API-specific types for DStack Verifier backend service
 *
 * This module defines request/response types and validation schemas
 * for the HTTP REST API endpoints.
 */

import {z} from 'zod'
import type {DataObject} from './index'

/**
 * Verification flags to control which steps to execute
 */
export interface VerificationFlags {
  hardware?: boolean
  os?: boolean
  sourceCode?: boolean
  teeControlledKey?: boolean
  certificateKey?: boolean
  dnsCAA?: boolean
  ctLog?: boolean
}

/**
 * Verification request payload for Redpill verifier
 */
export interface RedpillVerificationRequest {
  app: {
    contractAddress: `0x${string}`
    model: string
    metadata?: {
      osVersion?: string
      gitRevision?: string
    }
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
    metadata?: {
      osVersion?: string
      gitRevision?: string
    }
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
 * Zod schema for verifier metadata
 */
const VerifierMetadataSchema = z
  .object({
    osVersion: z.string().optional(),
    gitRevision: z.string().optional(),
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
 * Zod schema for Redpill verification request
 */
const RedpillVerificationRequestSchema = z.object({
  app: z.object({
    contractAddress: HexStringSchema,
    model: z.string(),
    metadata: VerifierMetadataSchema,
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
    metadata: VerifierMetadataSchema,
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
