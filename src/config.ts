/**
 * Configuration system for DStack Verifier backend service
 *
 * This module provides structured configuration for verifier instances
 * and granular control over verification steps that may take long time.
 */

import { env } from './env'
import type { VerifierMetadata } from './types'

/**
 * Configuration for KMS verifier
 */
export interface KmsConfig {
  /** KMS smart contract address */
  contractAddress: `0x${string}`
  /** Verifier metadata */
  metadata: VerifierMetadata
}

/**
 * Configuration for Gateway verifier
 */
export interface GatewayConfig {
  /** Gateway smart contract address */
  contractAddress: `0x${string}`
  /** Gateway RPC endpoint URL */
  rpcEndpoint: string
  /** Verifier metadata */
  metadata: VerifierMetadata
}

/**
 * Configuration for Redpill verifier
 */
export interface RedpillConfig {
  /** Redpill smart contract address */
  contractAddress: `0x${string}`
  /** Model identifier */
  model: string
  /** Verifier metadata */
  metadata: VerifierMetadata
}

/**
 * Grouped verifier configurations
 */
export interface VerifierConfigs {
  kms: KmsConfig
  gateway: GatewayConfig
  redpill: RedpillConfig
}

/**
 * Granular flags for controlling verification steps that may take long time
 */
export interface VerificationFlags {
  /** Enable hardware verification (TEE quote validation) */
  hardware: boolean
  /** Enable operating system verification (measurement validation) */
  os: boolean
  /** Enable source code verification (compose hash validation) */
  sourceCode: boolean
  /** Enable TEE controlled key verification */
  teeControlledKey: boolean
  /** Enable certificate key verification */
  certificateKey: boolean
  /** Enable DNS CAA verification (can be slow due to DNS queries) */
  dnsCAA: boolean
  /** Enable Certificate Transparency log verification (can be very slow due to crt.sh queries) */
  ctLog: boolean
}

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
  ctLog: true,
}

/**
 * Fast verification flags - skip potentially slow operations
 */
export const FAST_VERIFICATION_FLAGS: VerificationFlags = {
  hardware: true,
  os: true,
  sourceCode: true,
  teeControlledKey: true,
  certificateKey: true,
  dnsCAA: false, // Skip DNS queries
  ctLog: false, // Skip CT log queries
}

/**
 * Load configuration from environment variables with defaults
 */
export const DEFAULT_CONFIGS: VerifierConfigs = {
  kms: {
    contractAddress: env.KMS_CONTRACT_ADDRESS,
    metadata: {
      osVersion: env.KMS_OS_VERSION,
      gitRevision: env.KMS_GIT_REVISION,
    },
  },
  gateway: {
    contractAddress: env.GATEWAY_CONTRACT_ADDRESS,
    rpcEndpoint: env.GATEWAY_RPC_ENDPOINT,
    metadata: {
      osVersion: env.GATEWAY_OS_VERSION,
      gitRevision: env.GATEWAY_GIT_REVISION,
    },
  },
  redpill: {
    contractAddress: env.REDPILL_CONTRACT_ADDRESS,
    model: env.REDPILL_MODEL,
    metadata: {
      osVersion: env.REDPILL_OS_VERSION,
      gitRevision: env.REDPILL_GIT_REVISION,
    },
  },
}

/**
 * Parse verification flags from environment variable or string
 * Format: "hardware,os,sourceCode" or "all" or "fast"
 */
export function parseVerificationFlags(flagsStr?: string): VerificationFlags {
  if (!flagsStr || flagsStr === 'all') {
    return DEFAULT_VERIFICATION_FLAGS
  }

  if (flagsStr === 'fast') {
    return FAST_VERIFICATION_FLAGS
  }

  const flags = { ...DEFAULT_VERIFICATION_FLAGS }
  const enabledFlags = flagsStr.split(',').map((f) => f.trim())

  // Disable all flags first, then enable specified ones
  Object.keys(flags).forEach((key) => {
    flags[key as keyof VerificationFlags] = false
  })

  enabledFlags.forEach((flag) => {
    if (flag in flags) {
      flags[flag as keyof VerificationFlags] = true
    }
  })

  return flags
}

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Server port */
  port: number
  /** Server host */
  host: string
}

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: env.PORT,
  host: env.HOST,
}
