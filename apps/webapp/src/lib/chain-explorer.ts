/**
 * Chain ID → block explorer mapping. Mirrors the verifier's governance map
 * (packages/verifier/src/utils/metadataUtils.ts:320-347) so the UI links to
 * the same explorer the verifier expects.
 *
 *   chainId === null  → HostedBy Phala (no on-chain governance, no link)
 *   1                 → Ethereum mainnet
 *   8453              → Base mainnet
 *   11155111          → Sepolia testnet
 *   84532             → Base Sepolia testnet
 */

interface ChainInfo {
  name: string
  explorerBase: string
}

const CHAINS: Record<number, ChainInfo> = {
  1: {name: 'Ethereum', explorerBase: 'https://etherscan.io'},
  8453: {name: 'Base', explorerBase: 'https://basescan.org'},
  11155111: {name: 'Sepolia', explorerBase: 'https://sepolia.etherscan.io'},
  84532: {name: 'Base Sepolia', explorerBase: 'https://sepolia.basescan.org'},
}

export function getChainInfo(chainId: number | null | undefined): ChainInfo | null {
  // Upstream sends chainId === 0 for HostedBy Phala apps; treat as no-chain.
  if (chainId == null || chainId === 0) return null
  return CHAINS[chainId] ?? null
}

/** Strict 0x-prefixed 40-hex-char Ethereum address (case-insensitive). */
export function isEthAddress(value: string | null | undefined): boolean {
  if (!value) return false
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

/**
 * Build a block-explorer URL for `address` on `chainId`. Returns null when
 * either the chain isn't supported or the address isn't a real Ethereum
 * address (e.g. Phala Cloud sometimes returns the literal "phala" as a
 * sentinel for hosted KMS — not a contract).
 */
export function buildExplorerAddressUrl(
  chainId: number | null | undefined,
  address: string | null | undefined,
): string | null {
  const chain = getChainInfo(chainId)
  if (!chain) return null
  if (!isEthAddress(address)) return null
  return `${chain.explorerBase}/address/${address}`
}
