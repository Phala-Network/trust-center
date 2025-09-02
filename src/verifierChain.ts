/**
 * Simple verifier chain - creates and executes the right verifiers based on app config
 */

import type {
  PhalaCloudConfig,
  RedpillConfig,
  VerificationFlags,
} from './config'
import type { SystemInfo } from './types'
import type { Verifier } from './verifier'
import { GatewayVerifier } from './verifiers/gatewayVerifier'
import { PhalaCloudKmsVerifier } from './verifiers/phalaCloudKmsVerifier'
import { PhalaCloudVerifier } from './verifiers/phalaCloudVerifier'
import { RedpillKmsVerifier } from './verifiers/redpillKmsVerifier'
import { RedpillVerifier } from './verifiers/redpillVerifier'

/**
 * Creates the right verifiers based on app configuration
 */
export function createVerifiers(
  appConfig: RedpillConfig | PhalaCloudConfig,
  systemInfo: SystemInfo,
): Verifier[] {
  const verifiers: Verifier[] = []
  const chainId = systemInfo.kms_info.chain_id

  if ('model' in appConfig) {
    // Redpill app chain: RedpillKms -> Gateway -> RedpillApp
    verifiers.push(
      new RedpillKmsVerifier(
        systemInfo.kms_info.contract_address as `0x${string}`,
        appConfig.metadata,
        chainId,
      ),
      new GatewayVerifier(
        systemInfo.kms_info.gateway_app_id as `0x${string}`,
        systemInfo.kms_info.gateway_app_url,
        appConfig.metadata,
        chainId,
      ),
      new RedpillVerifier(
        appConfig.contractAddress,
        appConfig.model,
        appConfig.metadata,
        chainId,
      ),
    )
  } else {
    // Phala Cloud app chain: PhalaKms -> Gateway -> PhalaApp
    verifiers.push(
      new PhalaCloudKmsVerifier(
        systemInfo.kms_info.contract_address as `0x${string}`,
        appConfig.metadata,
        chainId,
      ),
      new GatewayVerifier(
        systemInfo.kms_info.gateway_app_id as `0x${string}`,
        systemInfo.kms_info.gateway_app_url,
        appConfig.metadata,
        chainId,
      ),
      new PhalaCloudVerifier(
        appConfig.contractAddress,
        appConfig.domain,
        appConfig.metadata,
        chainId,
      ),
    )
  }

  return verifiers
}

/**
 * Executes a list of verifiers with the given flags
 */
export async function executeVerifiers(
  verifiers: Verifier[],
  flags: VerificationFlags,
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []

  for (const verifier of verifiers) {
    try {
      // Run standard verification steps
      if (flags.hardware) await verifier.verifyHardware()
      if (flags.os) await verifier.verifyOperatingSystem()
      if (flags.sourceCode) await verifier.verifySourceCode()

      // Run domain verification for Gateway verifier
      if (verifier instanceof GatewayVerifier) {
        if (flags.teeControlledKey) await verifier.verifyTeeControlledKey()
        if (flags.certificateKey) await verifier.verifyCertificateKey()
        if (flags.dnsCAA) await verifier.verifyDnsCAA()
        if (flags.ctLog) await verifier.verifyCTLog()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(message)
    }
  }

  return {
    success: errors.length === 0,
    errors,
  }
}
