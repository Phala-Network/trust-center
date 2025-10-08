/**
 * Structured metadata types for TEE verification.
 *
 * These types replace the loose Record<string, unknown> metadata
 * with properly typed structures for different verification contexts.
 */

import { z } from 'zod'

/**
 * KMS version format from SystemInfo.kms_info.version
 * Format: "v0.5.3 (git:abc123)"
 * Contains both version number and git commit hash
 */
export type KmsVersionString = string & { readonly __brand: 'KmsVersion' }

/**
 * Image version from SystemInfo.instances.image_version
 * Format: "dstack-dev-0.3.6"
 * Docker image tag format
 */
export type ImageVersionString = string & { readonly __brand: 'ImageVersion' }

/**
 * Normalized version for storage/comparison
 * Format: "v0.3.6" (always with 'v' prefix)
 * Used in metadata and API responses
 */
export type NormalizedVersionString = string & {
  readonly __brand: 'NormalizedVersion'
}

// Helper functions to create branded types (runtime no-op, compile-time type assertion)
export const createKmsVersion = (s: string): KmsVersionString =>
  s as KmsVersionString
export const createImageVersion = (s: string): ImageVersionString =>
  s as ImageVersionString
export const createNormalizedVersion = (s: string): NormalizedVersionString =>
  s as NormalizedVersionString

/**
 * @deprecated Use NormalizedVersionString instead
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
  /** Normalized version string (e.g., "v0.5.3") */
  version: z.string(),
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

// Export TypeScript types from Zod schemas with branded type overrides
export type VersionString = z.infer<typeof VersionStringSchema>

export type OSSourceInfo = {
  github_repo: string
  git_commit: string
  version: ImageVersionString
}

export type AppSourceInfo = z.infer<typeof AppSourceInfoSchema>
export type HardwareInfo = z.infer<typeof HardwareInfoSchema>
export type GovernanceInfo = z.infer<typeof GovernanceInfoSchema>

export type KmsMetadata = {
  osSource: OSSourceInfo
  appSource: AppSourceInfo
  hardware: HardwareInfo
  governance: GovernanceInfo
}

export type GatewayMetadata = {
  osSource: OSSourceInfo
  appSource: AppSourceInfo
  hardware: HardwareInfo
  governance: GovernanceInfo
}

export type CompleteAppMetadata = {
  osSource: OSSourceInfo
  appSource?: AppSourceInfo
  hardware: HardwareInfo
  governance?: GovernanceInfo
}

export type AppMetadata = Partial<CompleteAppMetadata>
export type VerifierMetadata =
  | KmsMetadata
  | GatewayMetadata
  | CompleteAppMetadata
