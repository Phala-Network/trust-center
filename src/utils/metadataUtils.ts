/**
 * Utilities for constructing typed metadata from SystemInfo data
 */

import type { SystemInfo } from '../types/application'
import type {
  AppMetadata,
  CompleteAppMetadata,
  GatewayMetadata,
  GovernanceInfo,
  HardwareInfo,
  KmsMetadata,
  VersionString,
} from '../types/metadata'

export function parseVersionString(version: string): {
  version: VersionString
  gitCommit: string
} {
  // Format: "v0.5.3 (git:c06e524bd460fd9c9add)"
  const versionMatch = version.match(/^v?([^(]+)\s*\(git:([^)]+)\)/)
  if (versionMatch?.[1] && versionMatch?.[2]) {
    const cleanVersion = versionMatch[1].trim()
    const gitCommit = versionMatch[2].trim()

    // Ensure version has 'v' prefix
    const versionWithPrefix = cleanVersion.startsWith('v')
      ? (cleanVersion as VersionString)
      : (`v${cleanVersion}` as VersionString)

    return {
      version: versionWithPrefix,
      gitCommit,
    }
  } else {
    throw new Error(`Unable to parse version format: ${version}`)
  }
}

/**
 * Check if a version represents a legacy version (0.3.x) that requires data object generation only
 */
export function isLegacyVersion(version: string): boolean {
  try {
    const { version: versionWithPrefix } = parseVersionString(version)
    // Remove 'v' prefix and check if it starts with '0.3.'
    return versionWithPrefix.slice(1).startsWith('0.3.')
  } catch {
    // If parsing fails, try simple string matching
    return version.includes('0.3.')
  }
}

/**
 * Generic function to create source information with custom repository path.
 * Can be used as a base for all source info generation functions.
 */
export function versionToSourceInfo(
  version: string,
  repoPath?: string,
): {
  github_repo: string
  git_commit: string
  version: VersionString
} {
  const { version: versionWithPrefix, gitCommit } = parseVersionString(version)
  const baseUrl = 'https://github.com/Dstack-TEE/dstack'

  const github_repo = repoPath
    ? `${baseUrl}/tree/${gitCommit}/${repoPath}`
    : baseUrl

  return {
    github_repo,
    git_commit: gitCommit,
    version: versionWithPrefix,
  }
}

/**
 * Convert chain ID to governance information using viem chain data
 * Returns hosted by Phala if chain ID is null
 */
export function chainIdToGovernanceInfo(
  chainId: number | null,
): GovernanceInfo {
  if (chainId === null) {
    return {
      type: 'HostedBy',
      host: 'Phala',
    }
  }

  switch (chainId) {
    case 8453:
      return {
        type: 'OnChain',
        blockchain: 'Base',
        blockchainExplorerUrl: 'https://basescan.org',
        chainId,
      }
    case 1:
      return {
        type: 'OnChain',
        blockchain: 'Ethereum',
        blockchainExplorerUrl: 'https://etherscan.io',
        chainId,
      }
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`)
  }
}

/**
 * Create default hardware information for Intel TDX
 */
export function createDefaultHardwareInfo(
  hasNvidiaSupport?: boolean,
): HardwareInfo {
  return {
    cpuManufacturer: 'Intel Corporation',
    cpuModel: 'Intel(R) Xeon(R) CPU',
    securityFeature: 'Intel Trust Domain Extensions (TDX)',
    hasNvidiaSupport: hasNvidiaSupport || false,
  }
}

/**
 * Create KMS metadata from SystemInfo
 */
export function createKmsMetadata(systemInfo: SystemInfo): KmsMetadata {
  return {
    osSource: versionToSourceInfo(systemInfo.kms_info.version),
    appSource: versionToSourceInfo(systemInfo.kms_info.version, 'kms'),
    hardware: createDefaultHardwareInfo(),
    governance: chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}

/**
 * Create Gateway metadata from SystemInfo
 */
export function createGatewayMetadata(systemInfo: SystemInfo): GatewayMetadata {
  return {
    osSource: versionToSourceInfo(systemInfo.kms_info.version),
    appSource: versionToSourceInfo(systemInfo.kms_info.version, 'gateway'),
    hardware: createDefaultHardwareInfo(),
    governance: chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}

/**
 * Create App metadata from SystemInfo
 */
export function completeAppMetadata(
  systemInfo: SystemInfo,
  appMetadata?: AppMetadata,
): CompleteAppMetadata {
  return {
    osSource:
      appMetadata?.osSource || versionToSourceInfo(systemInfo.kms_info.version),
    appSource: appMetadata?.appSource,
    hardware: appMetadata?.hardware || createDefaultHardwareInfo(),
    governance:
      appMetadata?.governance ||
      chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}
