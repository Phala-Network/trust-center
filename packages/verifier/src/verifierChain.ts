/**
 * Simple verifier chain - creates and executes the right verifiers based on app config
 */

import type {
  PhalaCloudConfig,
  RedpillConfig,
  VerificationFlags,
} from './config'
import type { AppMetadata, SystemInfo } from './types'
import {
  completeAppMetadata,
  createGatewayMetadata,
  createKmsMetadata,
  isLegacyVersion,
} from './utils/metadataUtils'
import type { Verifier } from './verifier'
import { GatewayVerifier } from './verifiers/gatewayVerifier'
import {
  LegacyGatewayStubVerifier,
  LegacyKmsStubVerifier,
} from './verifiers/legacyStubVerifiers'
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

  // Create metadata from systemInfo using utility functions
  const kmsMetadata = createKmsMetadata(systemInfo)
  const gatewayMetadata = createGatewayMetadata(systemInfo)

  // Complete app metadata with default values when needed
  const appMetadata = completeAppMetadata(
    systemInfo,
    appConfig.metadata as AppMetadata | undefined,
  )

  if ('model' in appConfig) {
    // Redpill app chain: RedpillKms -> Gateway -> RedpillApp
    verifiers.push(
      new RedpillKmsVerifier(kmsMetadata, systemInfo.kms_info),
      new GatewayVerifier(gatewayMetadata, systemInfo),
      new RedpillVerifier(
        appConfig.contractAddress,
        appConfig.model,
        appMetadata,
      ),
    )
  } else {
    if (isLegacyVersion(systemInfo.kms_info.version)) {
      // Legacy Phala Cloud app: use stub verifiers + PhalaApp verifier
      verifiers.push(
        new LegacyKmsStubVerifier(systemInfo),
        new LegacyGatewayStubVerifier(systemInfo),
        new PhalaCloudVerifier(
          appConfig.contractAddress,
          appConfig.domain,
          appMetadata,
          systemInfo,
        ),
      )
    } else {
      verifiers.push(
        new PhalaCloudKmsVerifier(kmsMetadata, systemInfo.kms_info),
        new GatewayVerifier(gatewayMetadata, systemInfo),
        new PhalaCloudVerifier(
          appConfig.contractAddress,
          appConfig.domain,
          appMetadata,
          systemInfo,
        ),
      )
    }
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
