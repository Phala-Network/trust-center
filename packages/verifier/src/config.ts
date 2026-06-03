/**
 * Configuration system for DStack Verifier backend service
 *
 * This module provides structured configuration for verifier instances
 * and granular control over verification steps that may take long time.
 */

import {z} from 'zod'
import {AsyncLocalStorage} from 'node:async_hooks'
import {format} from 'node:util'

import {
  AppMetadataSchema,
  GatewayMetadataSchema,
  KmsMetadataSchema,
} from './types/metadata'
import {AppIdSchema, ContractAddressSchema} from './types/utils'

/**
 * Configuration for KMS verifier
 */
export const KmsConfigSchema = z.object({
  /** KMS smart contract address */
  contractAddress: ContractAddressSchema,
  /** Verifier metadata (optional - will be generated from systemInfo if not provided) */
  metadata: KmsMetadataSchema.optional(),
})

/**
 * Configuration for Gateway verifier
 */
export const GatewayConfigSchema = z.object({
  /** Gateway app ID (without 0x prefix) - used for API calls */
  appId: AppIdSchema,
  /** Gateway RPC endpoint URL */
  rpcEndpoint: z.string().url(),
  /** Verifier metadata (optional - will be generated from systemInfo if not provided) */
  metadata: GatewayMetadataSchema.optional(),
})

/**
 * Configuration for PhalaCloud verifier
 */
export const PhalaCloudConfigSchema = z.object({
  /** PhalaCloud app ID (without 0x prefix) - used for API calls */
  appId: AppIdSchema,
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
  /** Mask sensitive data in verification results (docker_compose_file, etc.) */
  maskSensitiveData: z.boolean(),
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
export type PhalaCloudConfig = z.infer<typeof PhalaCloudConfigSchema>
export type VerificationFlags = z.infer<typeof VerificationFlagsSchema>
export type ServerConfig = z.infer<typeof ServerConfigSchema>

export interface VerificationLogContext {
  taskId: string
  app: string
  domain?: string
}

const verificationLogContext = new AsyncLocalStorage<VerificationLogContext>()
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}
let verificationConsoleContextInstalled = false

function formatVerificationLogContext(context: VerificationLogContext): string {
  const parts = [`task_id=${context.taskId}`, `app=${context.app}`]
  if (context.domain) {
    parts.push(`domain=${context.domain}`)
  }
  return `[${parts.join(' ')}]`
}

function formatContextLog(args: unknown[]): string | null {
  const context = verificationLogContext.getStore()
  if (!context) {
    return null
  }

  const prefix = formatVerificationLogContext(context)
  return format(...args)
    .split('\n')
    .map((line) => `${prefix} ${line}`)
    .join('\n')
}

function installVerificationConsoleContext(): void {
  if (verificationConsoleContextInstalled) {
    return
  }

  verificationConsoleContextInstalled = true
  console.log = (...args: unknown[]) => {
    const message = formatContextLog(args)
    if (message) {
      originalConsole.log(message)
      return
    }
    originalConsole.log(...args)
  }
  console.warn = (...args: unknown[]) => {
    const message = formatContextLog(args)
    if (message) {
      originalConsole.warn(message)
      return
    }
    originalConsole.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    const message = formatContextLog(args)
    if (message) {
      originalConsole.error(message)
      return
    }
    originalConsole.error(...args)
  }
}

export function runWithVerificationLogContext<T>(
  context: VerificationLogContext,
  fn: () => T,
): T {
  installVerificationConsoleContext()
  return verificationLogContext.run(context, fn)
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
  maskSensitiveData: false, // Do not mask sensitive data by default
}

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  host: process.env.HOST ?? 'localhost',
}
