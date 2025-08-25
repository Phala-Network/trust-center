/**
 * Configuration system for DStack Verifier backend service
 *
 * This module provides structured configuration for verifier instances
 * and granular control over verification steps that may take long time.
 */

import type {VerifierMetadata} from './types'

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
  kms?: KmsConfig
  gateway?: GatewayConfig
  redpill?: RedpillConfig
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
 * Default configurations based on current hardcoded values
 */
export const DEFAULT_CONFIGS: VerifierConfigs = {
  kms: {
    contractAddress: '0xbfd2d557118fc650ea25a0e7d85355d335f259d8',
    metadata: {
      osVersion: '0.5.3',
      gitRevision: 'c06e524bd460fd9c9add835b634d155d4b08d7e7',
    },
  },
  gateway: {
    contractAddress: '0x', // Will be populated from KMS
    rpcEndpoint: 'https://gateway.llm-04.phala.network:9204/',
    metadata: {
      osVersion: '0.5.3',
      gitRevision: 'c06e524bd460fd9c9add835b634d155d4b08d7e7',
    },
  },
  redpill: {
    contractAddress: '0x78601222ada762fa7cdcbc167aa66dd7a5f57ece',
    model: 'phala/deepseek-chat-v3-0324',
    metadata: {
      osVersion: '0.5.3',
      gitRevision: '92aa6f0b03337949e3e41618a4f9a65c7648bae6',
    },
  },
}

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfigFromEnv(): VerifierConfigs {
  return {
    kms: {
      contractAddress:
        (process.env.KMS_CONTRACT_ADDRESS as `0x${string}`) ||
        DEFAULT_CONFIGS.kms!.contractAddress,
      metadata: {
        osVersion:
          process.env.KMS_OS_VERSION || DEFAULT_CONFIGS.kms!.metadata.osVersion,
        gitRevision:
          process.env.KMS_GIT_REVISION ||
          DEFAULT_CONFIGS.kms!.metadata.gitRevision,
      },
    },
    gateway: {
      contractAddress:
        (process.env.GATEWAY_CONTRACT_ADDRESS as `0x${string}`) ||
        DEFAULT_CONFIGS.gateway!.contractAddress,
      rpcEndpoint:
        process.env.GATEWAY_RPC_ENDPOINT ||
        DEFAULT_CONFIGS.gateway!.rpcEndpoint,
      metadata: {
        osVersion:
          process.env.GATEWAY_OS_VERSION ||
          DEFAULT_CONFIGS.gateway!.metadata.osVersion,
        gitRevision:
          process.env.GATEWAY_GIT_REVISION ||
          DEFAULT_CONFIGS.gateway!.metadata.gitRevision,
      },
    },
    redpill: {
      contractAddress:
        (process.env.REDPILL_CONTRACT_ADDRESS as `0x${string}`) ||
        DEFAULT_CONFIGS.redpill!.contractAddress,
      model: process.env.REDPILL_MODEL || DEFAULT_CONFIGS.redpill!.model,
      metadata: {
        osVersion:
          process.env.REDPILL_OS_VERSION ||
          DEFAULT_CONFIGS.redpill!.metadata.osVersion,
        gitRevision:
          process.env.REDPILL_GIT_REVISION ||
          DEFAULT_CONFIGS.redpill!.metadata.gitRevision,
      },
    },
  }
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

  const flags = {...DEFAULT_VERIFICATION_FLAGS}
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
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost',
}
