/**
 * Utility functions for determining app badges based on dstack version and data objects.
 *
 * Classification:
 * - dstack 0.3: App & code info (compose file), Centralized Gateway, KMS
 * - dstack 0.5 offchain: Gateway, KMS in TEE (dataObjects does not include 'kms-quote')
 * - dstack 0.5 onchain: Governance contracts (dataObjects includes 'kms-quote')
 */

export interface AppBadgeInfo {
  versionBadge: {
    show: boolean
    fullVersion: string // e.g., "0.5.3", "dev-0.5.3"
    majorMinor: string // e.g., "0.3", "0.5"
  }
  kmsBadge: {
    show: boolean
    text: string // "KMS in TEE" or "Onchain KMS"
  }
}

/**
 * Parse version from dstack version string
 * @param dstackVersion - e.g., "dstack-0.5.3", "dstack-dev-0.5.3"
 * @returns {fullVersion, majorMinor} or null
 */
function parseVersion(dstackVersion?: string): {fullVersion: string; majorMinor: string} | null {
  if (!dstackVersion) return null

  // Remove "dstack-" prefix
  const versionPart = dstackVersion.replace(/^dstack-/, '')

  // Extract major.minor version
  const match = versionPart.match(/(\d+)\.(\d+)/)
  if (!match) return null

  return {
    fullVersion: versionPart,
    majorMinor: `${match[1]}.${match[2]}`
  }
}

/**
 * Check if app is onchain (has kms-quote in data objects)
 * @param dataObjects - Array of data object IDs
 */
function isOnchain(dataObjects?: string[]): boolean {
  if (!dataObjects || !Array.isArray(dataObjects)) return false
  return dataObjects.includes('kms-quote')
}

/**
 * Determine badge information for an app
 */
export function getAppBadges(
  dstackVersion?: string,
  dataObjects?: string[],
): AppBadgeInfo {
  const versionInfo = parseVersion(dstackVersion)

  // Default: no badges
  const result: AppBadgeInfo = {
    versionBadge: {
      show: false,
      fullVersion: '',
      majorMinor: '',
    },
    kmsBadge: {
      show: false,
      text: '',
    },
  }

  // If no version, return default
  if (!versionInfo) return result

  // Version badge: always show if we have a version
  result.versionBadge = {
    show: true,
    fullVersion: versionInfo.fullVersion,
    majorMinor: versionInfo.majorMinor,
  }

  // KMS badge: only for 0.5+
  if (versionInfo.majorMinor === '0.5') {
    const onchain = isOnchain(dataObjects)
    result.kmsBadge = {
      show: true,
      text: onchain ? 'Onchain KMS' : 'KMS in TEE',
    }
  }

  return result
}
