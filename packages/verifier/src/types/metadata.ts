/**
 * Structured metadata types for TEE verification.
 *
 * These types replace the loose Record<string, unknown> metadata
 * with properly typed structures for different verification contexts.
 */

import { z } from 'zod'

/**
 * Version string that starts with 'v' prefix.
 * Examples: "v0.5.3", "v0.5.3 (git:c06e524bd460fd9c9add)"
 */
export const VersionStringSchema = z
  .string()
  .regex(/^v/, 'Version string must start with "v"')

/**
 * Operating system source code information.
 */
export const OSSourceInfoSchema = z.object({
  /** GitHub repository URL for the OS source code */
  github_repo: z.string(),
  /** Git commit hash of the OS build */
  git_commit: z.string(),
  /** Version string of the OS that starts with 'v' prefix */
  version: VersionStringSchema,
})

/**
 * Application source code information (all fields required when present).
 */
export const AppSourceInfoSchema = z.object({
  /** GitHub repository URL for the application source code */
  github_repo: z.string(),
  /** Git commit hash of the application build */
  git_commit: z.string(),
  /** Version string of the application */
  version: z.string(),
  /** Optional model name for ML applications */
  model_name: z.string().optional(),
})

/**
 * Hardware platform information.
 */
export const HardwareInfoSchema = z.object({
  /** CPU manufacturer (e.g., "Intel Corporation") */
  cpuManufacturer: z.string(),
  /** CPU model name (e.g., "Intel(R) Xeon(R) CPU") */
  cpuModel: z.string(),
  /** Security feature description (e.g., "Intel Trust Domain Extensions (TDX)") */
  securityFeature: z.string(),
  /** Whether NVIDIA GPU support is enabled */
  hasNvidiaSupport: z.boolean().optional(),
})

/**
 * Governance information - either on-chain governance or hosted by a service provider
 */
export const GovernanceInfoSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('OnChain'),
    /** Blockchain name (e.g., "Base") */
    blockchain: z.string(),
    /** Blockchain explorer URL (e.g., "https://basescan.org") */
    blockchainExplorerUrl: z.string(),
    /** Chain ID for the blockchain */
    chainId: z.number(),
  }),
  z.object({
    type: z.literal('HostedBy'),
    /** Host service provider name */
    host: z.string(),
  }),
])

/**
 * Complete metadata for KMS verifier.
 */
export const KmsMetadataSchema = z.object({
  /** Operating system source information (required) */
  osSource: OSSourceInfoSchema,
  /** Application source information (required) */
  appSource: AppSourceInfoSchema,
  /** Hardware platform information (required) */
  hardware: HardwareInfoSchema,
  /** Governance contract information (optional) */
  governance: GovernanceInfoSchema,
})

/**
 * Complete metadata for Gateway verifier.
 */
export const GatewayMetadataSchema = z.object({
  /** Operating system source information (required) */
  osSource: OSSourceInfoSchema,
  /** Application source information (required) */
  appSource: AppSourceInfoSchema,
  /** Hardware platform information (required) */
  hardware: HardwareInfoSchema,
  /** Governance contract information (optional) */
  governance: GovernanceInfoSchema,
})

/**
 * Complete AppMetadata with all fields populated (used internally after auto-completion)
 */
export const CompleteAppMetadataSchema = z.object({
  /** Operating system source information (required) */
  osSource: OSSourceInfoSchema,
  /** Application source information (optional) */
  appSource: AppSourceInfoSchema.optional(),
  /** Hardware platform information (required) */
  hardware: HardwareInfoSchema,
  /** Governance contract information (optional) */
  governance: GovernanceInfoSchema.optional(),
})

export const AppMetadataSchema = CompleteAppMetadataSchema.partial()

/**
 * Union type for all verifier metadata.
 */
export const VerifierMetadataSchema = z.union([
  KmsMetadataSchema,
  GatewayMetadataSchema,
  CompleteAppMetadataSchema,
])

// Export TypeScript types from Zod schemas
export type VersionString = z.infer<typeof VersionStringSchema>
export type OSSourceInfo = z.infer<typeof OSSourceInfoSchema>
export type AppSourceInfo = z.infer<typeof AppSourceInfoSchema>
export type HardwareInfo = z.infer<typeof HardwareInfoSchema>
export type GovernanceInfo = z.infer<typeof GovernanceInfoSchema>
export type KmsMetadata = z.infer<typeof KmsMetadataSchema>
export type GatewayMetadata = z.infer<typeof GatewayMetadataSchema>
export type CompleteAppMetadata = z.infer<typeof CompleteAppMetadataSchema>
export type AppMetadata = z.infer<typeof AppMetadataSchema>
export type VerifierMetadata = z.infer<typeof VerifierMetadataSchema>
