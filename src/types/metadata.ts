/**
 * Structured metadata types for TEE verification.
 *
 * These types replace the loose Record<string, unknown> metadata
 * with properly typed structures for different verification contexts.
 */

/**
 * Operating system source code information.
 */
export interface OSSourceInfo {
  /** GitHub repository URL for the OS source code */
  github_repo: string
  /** Git commit hash of the OS build */
  git_commit: string
  /** Version string of the OS (e.g., "dstack-0.5.3", "dstack-nvidia-0.5.3") */
  version: string
}

/**
 * Application source code information (all fields required when present).
 */
export interface AppSourceInfo {
  /** GitHub repository URL for the application source code */
  github_repo: string
  /** Git commit hash of the application build */
  git_commit: string
  /** Version string of the application */
  version: string
  /** Optional model name for ML applications */
  model_name?: string
}

/**
 * Hardware platform information.
 */
export interface HardwareInfo {
  /** CPU manufacturer (e.g., "Intel Corporation") */
  cpuManufacturer: string
  /** CPU model name (e.g., "Intel(R) Xeon(R) CPU") */
  cpuModel: string
  /** Security feature description (e.g., "Intel Trust Domain Extensions (TDX)") */
  securityFeature: string
  /** Whether NVIDIA GPU support is enabled */
  hasNvidiaSupport?: boolean
}

/**
 * Network and blockchain information (all fields required when present).
 */
export interface NetworkInfo {
  /** Blockchain name (e.g., "Base") */
  blockchain: string
  /** Blockchain explorer URL (e.g., "https://basescan.org") */
  blockchainExplorerUrl: string
  /** Chain ID for the blockchain */
  chainId?: number
}

/**
 * Complete metadata for KMS verifier.
 */
export interface KmsMetadata {
  /** Operating system source information (required) */
  osSource: OSSourceInfo
  /** Hardware platform information (required) */
  hardware: HardwareInfo
  /** Network and blockchain information (optional) */
  network?: NetworkInfo
}

/**
 * Complete metadata for Gateway verifier.
 */
export interface GatewayMetadata {
  /** Operating system source information (required) */
  osSource: OSSourceInfo
  /** Hardware platform information (required) */
  hardware: HardwareInfo
  /** Network and blockchain information (optional) */
  network?: NetworkInfo
}

/**
 * Complete metadata for App verifier (ML applications).
 */
export interface AppMetadata {
  /** Operating system source information (required) */
  osSource: OSSourceInfo
  /** Application source information (optional) */
  appSource?: AppSourceInfo
  /** Hardware platform information (required) */
  hardware: HardwareInfo
  /** Network and blockchain information (optional) */
  network?: NetworkInfo
}

/**
 * Union type for all verifier metadata.
 */
export type VerifierMetadata = KmsMetadata | GatewayMetadata | AppMetadata
