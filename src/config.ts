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
 * Configuration for PhalaCloud verifier
 */
export interface PhalaCloudConfig {
  /** PhalaCloud smart contract address */
  contractAddress: `0x${string}`
  /** Domain identifier */
  domain: string
  /** Verifier metadata */
  metadata: VerifierMetadata
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
  ctLog: false, // Skip CT log queries
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
