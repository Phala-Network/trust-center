/**
 * App badge classification — keyed off dstack version + `chainId`.
 *
 * Why chainId? The verifier's `chainIdToGovernanceInfo`
 * (packages/verifier/src/utils/metadataUtils.ts:320-347) treats:
 *
 *   chainId === null  → HostedBy Phala (offchain KMS, KMS in TEE)
 *   chainId !== null  → OnChain governance via DstackKms on that chain
 *
 * `kmsContractAddress` alone is unreliable because Phala Cloud sometimes
 * returns the literal string "phala" as a sentinel for hosted KMS, and
 * `dataObjects.includes('kms-quote')` is unreliable because the verifier
 * also emits a kms-quote object in offchain mode via the hardcoded
 * fallback for `dstack-pha-*.phala.network`
 * (packages/verifier/src/verifiers/phalaCloudKmsVerifier.ts:30-60).
 *
 * Resulting badges:
 *
 *   dstack 0.3.x                → "Centralized KMS"
 *     LegacyKmsStubVerifier — no independent KMS attestation; KMS authority
 *     is provided centrally by Phala pre-0.5.3.
 *   dstack 0.5+ chainId === null → "KMS in TEE"   (HostedBy Phala)
 *   dstack 0.5+ chainId !== null → "Onchain KMS"  (OnChain via DstackKms)
 *   other / unparseable         → no KMS badge
 */

export interface AppBadgeInfo {
  versionBadge: {
    show: boolean
    fullVersion: string // e.g. "0.5.3", "dev-0.5.3", "nvidia-dev-0.5.6"
    majorMinor: string // e.g. "0.3", "0.5"
  }
  kmsBadge: {
    show: boolean
    text: 'Centralized KMS' | 'KMS in TEE' | 'Onchain KMS' | ''
  }
}

/**
 * Parse version from a dstack version string. Tolerates the various tag
 * prefixes between `dstack-` and the numeric version (e.g. `dev`, `nvidia`,
 * `nvidia-dev`, `pha`).
 */
function parseVersion(
  dstackVersion?: string | null,
): {fullVersion: string; majorMinor: string} | null {
  if (!dstackVersion) return null

  // Strip leading "dstack-"
  const versionPart = dstackVersion.replace(/^dstack-/, '')

  // Extract major.minor anywhere in the remainder
  const match = versionPart.match(/(\d+)\.(\d+)/)
  if (!match) return null

  return {
    fullVersion: versionPart,
    majorMinor: `${match[1]}.${match[2]}`,
  }
}

/**
 * Determine badge information for an app.
 *
 * @param dstackVersion        - e.g. `dstack-0.5.3`, `dstack-dev-0.3.6`,
 *                               `dstack-nvidia-dev-0.5.6`
 * @param chainId              - the canonical onchain signal; null = HostedBy
 *                               Phala (offchain), non-null = OnChain
 * @param _kmsContractAddress  - kept for backward compatibility; not used in
 *                               the badge decision (chainId is the source of
 *                               truth). May be a sentinel string like "phala"
 * @param _dataObjects         - kept for backward compatibility; the
 *                               `kms-quote` data object is NOT a reliable
 *                               onchain marker
 */
export function getAppBadges(
  dstackVersion?: string | null,
  chainId?: number | null,
  _kmsContractAddress?: string | null,
  _dataObjects?: string[] | null,
): AppBadgeInfo {
  const versionInfo = parseVersion(dstackVersion)

  const result: AppBadgeInfo = {
    versionBadge: {show: false, fullVersion: '', majorMinor: ''},
    kmsBadge: {show: false, text: ''},
  }

  if (!versionInfo) return result

  result.versionBadge = {
    show: true,
    fullVersion: versionInfo.fullVersion,
    majorMinor: versionInfo.majorMinor,
  }

  if (versionInfo.majorMinor === '0.3') {
    result.kmsBadge = {show: true, text: 'Centralized KMS'}
  } else if (versionInfo.majorMinor === '0.5') {
    result.kmsBadge = {
      show: true,
      text: chainId == null ? 'KMS in TEE' : 'Onchain KMS',
    }
  }

  return result
}
