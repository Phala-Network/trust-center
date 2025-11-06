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
  ImageVersionString,
  KmsMetadata,
  KmsVersionString,
  NormalizedVersionString,
} from '../types/metadata'
import {
  createImageVersion,
  createKmsVersion,
  createNormalizedVersion,
} from '../types/metadata'

// Re-export branded type helpers for convenience
export { createImageVersion, createKmsVersion, createNormalizedVersion }

/**
 * Fetch git commit hash from GitHub release page by parsing the HTML
 * @param tag - Normalized version tag (e.g., "v0.3.6")
 * @returns Git commit hash or null if not found
 */
async function fetchGitCommitFromReleasePage(
  tag: NormalizedVersionString,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://github.com/Dstack-TEE/meta-dstack/releases/tag/${tag}`,
    )
    if (!response.ok) {
      return null
    }
    const html = await response.text()

    // Look for the commit link pattern in the release page
    // Pattern: href="/Dstack-TEE/meta-dstack/commit/{commit_hash}"
    const commitMatch = html.match(
      /href="\/Dstack-TEE\/meta-dstack\/commit\/([a-f0-9]{40})"/,
    )
    if (commitMatch?.[1]) {
      return commitMatch[1]
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extract git commit hash from KMS version string.
 * If the version already contains git commit, extracts it directly.
 * Otherwise, fetches commit from GitHub release page.
 *
 * @param version - KMS version string from SystemInfo.kms_info.version
 *   Format: "v0.5.3 (git:abc123)" or just "v0.5.3"
 *
 * @returns Git commit hash (40-character hex string)
 *   Example: "c0c18657d77a785b7bfcce2a9707a17ada64015d"
 *
 * @throws Error if version format is unrecognized or git commit cannot be fetched
 */
export async function getGitCommit(
  version: KmsVersionString | NormalizedVersionString,
): Promise<string> {
  // Already in correct format: "v0.5.3 (git:abc123)"
  const standardMatch = version.match(/^v?([^(]+)\s*\(git:([^)]+)\)/)
  if (standardMatch?.[1] && standardMatch?.[2]) {
    return standardMatch[2].trim()
  }

  // Must be a normalized version like "v0.3.6" or "v0.5.4.1"
  const simpleMatch = version.match(/^v?(\d+\.\d+\.\d+(?:\.\d+)?)$/)
  if (!simpleMatch?.[1]) {
    throw new Error(`Unable to parse version format: ${version}`)
  }

  // Ensure version has 'v' prefix
  const versionWithPrefix = createNormalizedVersion(
    simpleMatch[1].startsWith('v') ? simpleMatch[1] : `v${simpleMatch[1]}`,
  )

  // Try to fetch git commit from GitHub release page
  const gitCommit = await fetchGitCommitFromReleasePage(versionWithPrefix)

  if (!gitCommit) {
    throw new Error(
      `Unable to fetch git commit for version ${versionWithPrefix} from GitHub releases`,
    )
  }

  return gitCommit
}

/**
 * Extract git commit hash from image version string.
 * Parses image version to normalized version, then fetches commit from GitHub.
 *
 * @param version - Image version string from SystemInfo.instances.image_version
 *   Formats: "dstack-dev-0.3.6", "0.3.6", or "v0.3.6"
 *
 * @returns Git commit hash (40-character hex string)
 *   Example: "c0c18657d77a785b7bfcce2a9707a17ada64015d"
 *
 * @throws Error if version format is unrecognized or git commit cannot be fetched
 */
export async function getGitCommitFromImageVersion(
  version: ImageVersionString,
): Promise<string> {
  const normalizedVersion = parseImageVersion(version)
  return getGitCommit(normalizedVersion)
}

/**
 * Parse KMS version string into normalized version and git commit.
 * Converts "v0.5.3 (git:abc123)" -> { version: "v0.5.3", gitCommit: "abc123" }
 *
 * @param version - KMS version string from SystemInfo.kms_info.version
 * @returns Object with normalized version and git commit hash
 * @throws Error if version format is invalid
 */
export function parseKmsVersion(version: KmsVersionString): {
  version: NormalizedVersionString
  gitCommit: string
} {
  // Format: "v0.5.3 (git:c06e524bd460fd9c9add)"
  const versionMatch = version.match(/^v?([^(]+)\s*\(git:([^)]+)\)/)
  if (versionMatch?.[1] && versionMatch?.[2]) {
    const cleanVersion = versionMatch[1].trim()
    const gitCommit = versionMatch[2].trim()

    // Ensure version has 'v' prefix
    const versionWithPrefix = cleanVersion.startsWith('v')
      ? createNormalizedVersion(cleanVersion)
      : createNormalizedVersion(`v${cleanVersion}`)

    return {
      version: versionWithPrefix,
      gitCommit,
    }
  }
  throw new Error(`Unable to parse KMS version format: ${version}`)
}

/**
 * Parse image version string into normalized version.
 * Converts "dstack-dev-0.3.6" or "0.3.6" -> "v0.3.6"
 *
 * @param version - Image version string from SystemInfo.instances.image_version
 * @returns Normalized version string with 'v' prefix
 * @throws Error if version format is invalid
 */
export function parseImageVersion(
  version: ImageVersionString,
): NormalizedVersionString {
  // Extract version number from various dstack image formats
  // Formats: "dstack-nvidia-dev-0.5.4.1", "dstack-nvidia-0.5.4.1", "dstack-dev-0.3.6", "dstack-0.5.3", or "0.3.6"

  // Match "dstack-nvidia-dev-X.Y.Z" format
  const nvidiaDevMatch = version.match(/^dstack-nvidia-dev-(.+)$/)
  if (nvidiaDevMatch?.[1]) {
    const versionNum = nvidiaDevMatch[1]
    return createNormalizedVersion(
      versionNum.startsWith('v') ? versionNum : `v${versionNum}`,
    )
  }

  // Match "dstack-nvidia-X.Y.Z" format
  const nvidiaMatch = version.match(/^dstack-nvidia-(.+)$/)
  if (nvidiaMatch?.[1]) {
    const versionNum = nvidiaMatch[1]
    return createNormalizedVersion(
      versionNum.startsWith('v') ? versionNum : `v${versionNum}`,
    )
  }

  // Match "dstack-dev-X.Y.Z" format
  const devMatch = version.match(/^dstack-dev-(.+)$/)
  if (devMatch?.[1]) {
    const versionNum = devMatch[1]
    return createNormalizedVersion(
      versionNum.startsWith('v') ? versionNum : `v${versionNum}`,
    )
  }

  // Match "dstack-X.Y.Z" format (production builds)
  const dstackMatch = version.match(/^dstack-(.+)$/)
  if (dstackMatch?.[1]) {
    const versionNum = dstackMatch[1]
    return createNormalizedVersion(
      versionNum.startsWith('v') ? versionNum : `v${versionNum}`,
    )
  }

  // Match simple version format "X.Y.Z" or "vX.Y.Z"
  const simpleMatch = version.match(/^v?(\d+\.\d+\.\d+(?:\.\d+)?)$/)
  if (simpleMatch?.[1]) {
    return createNormalizedVersion(`v${simpleMatch[1]}`)
  }

  throw new Error(`Unable to parse image version format: ${version}`)
}

/**
 * Compare two semantic version strings
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, '').split('.').map(Number)
  const bParts = b.replace(/^v/, '').split('.').map(Number)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0
    const bVal = bParts[i] || 0
    if (aVal !== bVal) {
      return aVal - bVal
    }
  }
  return 0
}

/**
 * Check if version supports onchain KMS feature.
 *
 * Onchain KMS support was introduced in dstack 0.5.3 and includes:
 * - Real KMS and Gateway verifiers (not stub verifiers)
 * - Rust-based dstack-mr-cli for OS measurement calculation
 *
 * @param version - KMS version string from SystemInfo.kms_info.version
 * @returns true if version >= 0.5.3 (supports onchain KMS)
 */
export function supportsOnchainKms(version: KmsVersionString): boolean {
  try {
    const { version: versionWithPrefix } = parseKmsVersion(version)
    return compareVersions(versionWithPrefix, '0.5.3') >= 0
  } catch {
    // Fallback: try to extract version directly
    const match = version.match(/(\d+\.\d+\.\d+)/)
    if (match?.[1]) {
      return compareVersions(match[1], '0.5.3') >= 0
    }
    // If parsing fails completely, assume legacy (no onchain KMS support) for safety
    return false
  }
}

/**
 * Check if version supports modern Info RPC endpoint.
 *
 * The /prpc/Info endpoint was introduced in dstack 0.5.0, replacing the legacy
 * /prpc/Worker.Info endpoint with a more comprehensive response format.
 *
 * @param version - KMS version string from SystemInfo.kms_info.version
 * @returns true if version >= 0.5.0 (supports /prpc/Info endpoint)
 */
export function supportsInfoRpcEndpoint(version: KmsVersionString): boolean {
  try {
    const { version: versionWithPrefix } = parseKmsVersion(version)
    return compareVersions(versionWithPrefix, '0.5.0') >= 0
  } catch {
    // Fallback: try to extract version directly
    const match = version.match(/(\d+\.\d+\.\d+)/)
    if (match?.[1]) {
      return compareVersions(match[1], '0.5.0') >= 0
    }
    // If parsing fails completely, assume legacy (use Worker.Info) for safety
    return false
  }
}

/**
 * Convert KMS version to source information with optional repository path.
 * Creates OS/App source metadata from SystemInfo.kms_info.version
 *
 * @param version - KMS version string from SystemInfo.kms_info.version
 * @param repoPath - Optional path within the repository (e.g., 'kms', 'gateway')
 * @returns Source information with github_repo, git_commit, and image version
 */
export function kmsVersionToSourceInfo(
  version: KmsVersionString,
  repoPath?: string,
): {
  github_repo: string
  git_commit: string
  version: ImageVersionString
} {
  const { version: versionWithPrefix, gitCommit } = parseKmsVersion(version)
  const baseUrl = 'https://github.com/Dstack-TEE/meta-dstack'

  const github_repo = repoPath
    ? `${baseUrl}/tree/${gitCommit}/${repoPath}`
    : baseUrl

  // Convert normalized version (v0.5.3) to image version (dstack-0.5.3)
  // Remove 'v' prefix and add 'dstack-' prefix
  const versionNum = versionWithPrefix.startsWith('v')
    ? versionWithPrefix.slice(1)
    : versionWithPrefix
  const imageVersion = createImageVersion(`dstack-${versionNum}`)

  return {
    github_repo,
    git_commit: gitCommit,
    version: imageVersion,
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
    osSource: kmsVersionToSourceInfo(systemInfo.kms_info.version),
    appSource: kmsVersionToSourceInfo(systemInfo.kms_info.version, 'kms'),
    hardware: createDefaultHardwareInfo(),
    governance: chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}

/**
 * Create Gateway metadata from SystemInfo
 */
export function createGatewayMetadata(systemInfo: SystemInfo): GatewayMetadata {
  return {
    osSource: kmsVersionToSourceInfo(systemInfo.kms_info.version),
    appSource: kmsVersionToSourceInfo(systemInfo.kms_info.version, 'gateway'),
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
  if (!appMetadata?.osSource) {
    throw new Error('osSource is required in appMetadata')
  }

  return {
    osSource: appMetadata.osSource,
    appSource: appMetadata?.appSource,
    hardware: appMetadata?.hardware || createDefaultHardwareInfo(),
    governance:
      appMetadata?.governance ||
      chainIdToGovernanceInfo(systemInfo.kms_info.chain_id),
  }
}
