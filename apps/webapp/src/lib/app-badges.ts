/**
 * Utility functions for determining app badges based on dstack version,
 * the per-app KMS contract address, and the verifier's data objects.
 *
 * Classification (verified against the dstack KMS verifier):
 *
 * - dstack 0.3: Centralized KMS pre-smart-contract — no independent KMS
 *   attestation (verifier uses LegacyKmsStubVerifier). No KMS badge.
 *
 * - dstack 0.5 with `kmsContractAddress` set: governance via the on-chain
 *   `DstackKms` smart contract (auth-eth backend). The verifier reads the
 *   KMS quote from the contract. Badge: "Onchain KMS".
 *
 * - dstack 0.5 without `kmsContractAddress`: governance via local config
 *   (auth-simple backend). For Phala-hosted KMS at `dstack-pha-*.phala.network`
 *   the verifier still produces a `kms-quote` data object from a hardcoded
 *   fallback, so that data-object alone is NOT a reliable onchain marker —
 *   `kmsContractAddress` is the canonical signal. Badge: "KMS in TEE".
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
function parseVersion(
  dstackVersion?: string | null,
): {fullVersion: string; majorMinor: string} | null {
  if (!dstackVersion) return null

  // Remove "dstack-" prefix
  const versionPart = dstackVersion.replace(/^dstack-/, '')

  // Extract major.minor version
  const match = versionPart.match(/(\d+)\.(\d+)/)
  if (!match) return null

  return {
    fullVersion: versionPart,
    majorMinor: `${match[1]}.${match[2]}`,
  }
}

/**
 * Onchain KMS = the app is bound to a real DstackKms smart contract.
 * `kmsContractAddress` is populated upstream only when auth-eth (on-chain
 * governance) is configured. An empty string, null, or `0x0` zero-address
 * all count as "no contract".
 */
function hasOnchainKmsContract(
  kmsContractAddress?: string | null,
): boolean {
  if (!kmsContractAddress) return false
  const normalized = kmsContractAddress.trim().toLowerCase()
  if (normalized === '') return false
  if (normalized === '0x0') return false
  if (/^0x0+$/.test(normalized)) return false
  return /^0x[a-f0-9]{40}$/.test(normalized)
}

/**
 * Determine badge information for an app.
 *
 * @param dstackVersion       - e.g. `dstack-0.5.3`, `dstack-dev-0.3.6`
 * @param kmsContractAddress  - the DstackKms contract address (only set for
 *                              auth-eth / on-chain governance apps); the
 *                              canonical marker for "Onchain KMS"
 * @param _dataObjects        - kept for backward compatibility / future use;
 *                              `kms-quote` is NOT a reliable onchain marker
 *                              because the verifier also emits it for offchain
 *                              Phala-hosted KMS via hardcoded fallback
 */
export function getAppBadges(
  dstackVersion?: string | null,
  kmsContractAddress?: string | null,
  _dataObjects?: string[] | null,
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
  // 0.3 uses a stub legacy KMS and has no independent KMS attestation
  // surfaced in the verifier, so no badge.
  if (versionInfo.majorMinor === '0.5') {
    const onchain = hasOnchainKmsContract(kmsContractAddress)
    result.kmsBadge = {
      show: true,
      text: onchain ? 'Onchain KMS' : 'KMS in TEE',
    }
  }

  return result
}
