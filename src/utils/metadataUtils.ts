/**
 * Utilities for constructing typed metadata from SystemInfo data
 */

import type { SystemInfo } from '../types/application'
import type {
  AppMetadata,
  GatewayMetadata,
  GovernanceInfo,
  HardwareInfo,
  KmsMetadata,
  OSSourceInfo,
} from '../types/metadata'

/**
 * Convert version string to OS source information.
 * Parses version strings like "v0.5.3 (git:c06e524bd460fd9c9add)" or "dstack-0.5.3"
 */
export function versionToOSSourceInfo(version: string): OSSourceInfo {
  // Handle different version string formats
  let cleanVersion: string
  let gitCommit: string

  if (version.includes('(git:') && version.includes(')')) {
    // Format: "v0.5.3 (git:c06e524bd460fd9c9add)"
    const versionMatch = version.match(/^v?([^(]+)\s*\(git:([^)]+)\)/)
    if (versionMatch?.[1] && versionMatch?.[2]) {
      cleanVersion = versionMatch[1].trim()
      gitCommit = versionMatch[2].trim()
    } else {
      throw new Error(`Unable to parse version format: ${version}`)
    }
  } else if (version.startsWith('dstack-')) {
    // Format: "dstack-0.5.3" or "dstack-nvidia-0.5.3"
    cleanVersion = version
    gitCommit = 'unknown' // Will need to be updated when commit info is available
  } else {
    // Fallback: treat as version without commit
    cleanVersion = version.replace(/^v/, '')
    gitCommit = 'unknown'
  }

  // Determine if this is an NVIDIA version
  const isNvidiaVersion =
    cleanVersion.includes('nvidia') || version.includes('nvidia')

  // Determine the appropriate version string for the repo
  const repoVersion = cleanVersion.startsWith('dstack-')
    ? cleanVersion
    : `dstack-${cleanVersion}`

  return {
    github_repo: 'https://github.com/Dstack-TEE/dstack',
    git_commit: gitCommit,
    version:
      isNvidiaVersion && !repoVersion.includes('nvidia')
        ? repoVersion.replace('dstack-', 'dstack-nvidia-')
        : repoVersion,
  }
}

/**
 * Convert chain ID to governance information using viem chain data
 */
export function chainIdToGovernanceInfo(chainId: number): GovernanceInfo {
  switch (chainId) {
    case 8453:
      return {
        blockchain: 'Base',
        blockchainExplorerUrl: 'https://basescan.org',
        chainId,
      }
    case 1:
      return {
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
    osSource: versionToOSSourceInfo(systemInfo.kms_info.version),
    hardware: createDefaultHardwareInfo(),
    governance: chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}

/**
 * Create Gateway metadata from SystemInfo
 */
export function createGatewayMetadata(systemInfo: SystemInfo): GatewayMetadata {
  return {
    osSource: versionToOSSourceInfo(systemInfo.kms_info.version),
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
): AppMetadata {
  return {
    osSource:
      appMetadata?.osSource ||
      versionToOSSourceInfo(systemInfo.kms_info.version),
    appSource: appMetadata?.appSource,
    hardware: appMetadata?.hardware || createDefaultHardwareInfo(),
    governance:
      appMetadata?.governance ||
      chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}
