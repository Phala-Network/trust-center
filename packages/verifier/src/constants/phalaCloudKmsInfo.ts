import {readFileSync} from 'node:fs'
import {join} from 'node:path'

import {KeyProviderSchema, TcbInfoSchema, VmConfigSchema} from '../schemas'
import type {AppInfo, KmsInfo} from '../types'
import {parseJsonFields} from '../types'
import {parseKmsVersion} from '../utils/metadataUtils'

function getRawKmsAppInfo(kmsInfo: KmsInfo): Record<string, unknown> {
  const {version, gitCommit: _} = parseKmsVersion(kmsInfo.version)
  const chainId = kmsInfo.chain_id

  // Extract prod environment from URL (e.g., "https://kms.dstack-base-prod7.phala.network" -> "prod7")
  const prodMatch = kmsInfo.url.match(/dstack-.*?-(.+)\.phala\.network/)
  const prodEnv = prodMatch ? prodMatch[1] : null

  if (!prodEnv) {
    throw new Error(
      `Unable to extract prod environment from URL: ${kmsInfo.url}`,
    )
  }

  // Map chain_id to chain identifier
  let chainName: string
  switch (chainId) {
    case 1: // Ethereum mainnet
      chainName = 'eth'
      break
    case 8453: // Base mainnet
      chainName = 'base'
      break
    case null: // Phala hosted
      chainName = 'pha'
      break
    default:
      throw new Error(`Unsupported chain ID: ${chainId} for ${prodEnv}`)
  }

  // Remove 'v' prefix from version (e.g., "v0.5.3" -> "053")
  // const versionShort = version.replace(/^v(\d+)\.(\d+)\.(\d+)$/, '$1$2$3')

  // Construct filename: {prodEnv}-{versionShort}-{chainName}.json
  const filename = `${prodEnv}-${chainName}.json`
  const filepath = join(__dirname, 'kmsInfo', filename)

  try {
    const fileContent = readFileSync(filepath, 'utf8')
    return JSON.parse(fileContent) as Record<string, unknown>
  } catch (error) {
    throw new Error(
      `Failed to load KMS info file ${filename}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export function getKmsAppInfo(kmsInfo: KmsInfo): AppInfo {
  const rawAppInfo = getRawKmsAppInfo(kmsInfo)
  return parseJsonFields<AppInfo>(rawAppInfo, {
    tcb_info: TcbInfoSchema,
    key_provider_info: KeyProviderSchema,
    vm_config: VmConfigSchema,
  })
}
