/**
 * Simple verifier chain - creates and executes the right verifiers based on app config
 */

import type {
  PhalaCloudConfig,
  VerificationFlags,
} from './config'
import type { AppMetadata, SystemInfo } from './types'
import type { DataObjectCollector } from './utils/dataObjectCollector'
import {
  completeAppMetadata,
  createGatewayMetadata,
  createKmsMetadata,
  supportsOnchainKms,
} from './utils/metadataUtils'
import type { Verifier } from './verifier'
import { GatewayVerifier } from './verifiers/gatewayVerifier'
import {
  LegacyGatewayStubVerifier,
  LegacyKmsStubVerifier,
} from './verifiers/legacyStubVerifiers'
import { PhalaCloudKmsVerifier } from './verifiers/phalaCloudKmsVerifier'
import { PhalaCloudVerifier } from './verifiers/phalaCloudVerifier'

/**
 * Creates the right verifiers based on app configuration
 */
export function createVerifiers(
  appConfig: PhalaCloudConfig,
  systemInfo: SystemInfo,
  collector: DataObjectCollector,
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

  if (!supportsOnchainKms(systemInfo.kms_info.version)) {
    console.log("[VerifierChain] Detected legacy KMS version (< 0.5.3), using stub verifiers")
    // Legacy Phala Cloud app: use stub verifiers + PhalaApp verifier
    verifiers.push(
      new LegacyKmsStubVerifier(systemInfo, collector),
      new LegacyGatewayStubVerifier(systemInfo, collector),
      new PhalaCloudVerifier(
        systemInfo,
        appConfig.domain,
        appMetadata,
        collector,
      ),
    )
  } else {
    verifiers.push(
      new PhalaCloudKmsVerifier(kmsMetadata, systemInfo.kms_info, collector),
      new GatewayVerifier(gatewayMetadata, systemInfo, collector),
      new PhalaCloudVerifier(
        systemInfo,
        appConfig.domain,
        appMetadata,
        collector,
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
    const verifierName = verifier.constructor.name
    console.log(`[VerifierChain] Executing ${verifierName}`)

    try {
      // Run standard verification steps
      if (flags.hardware) {
        const result = await verifier.verifyHardware()
        console.log(
          `[VerifierChain] ${verifierName}.verifyHardware() returned:`,
          result,
        )
      }
      if (flags.os) {
        const result = await verifier.verifyOperatingSystem()
        console.log(
          `[VerifierChain] ${verifierName}.verifyOperatingSystem() returned:`,
          result,
        )
      }
      if (flags.sourceCode) {
        const result = await verifier.verifySourceCode()
        console.log(
          `[VerifierChain] ${verifierName}.verifySourceCode() returned:`,
          result,
        )
      }

      // Run domain verification for Gateway verifier
      if (verifier instanceof GatewayVerifier) {
        if (flags.teeControlledKey) {
          const result = await verifier.verifyTeeControlledKey()
          console.log(
            `[VerifierChain] ${verifierName}.verifyTeeControlledKey() returned:`,
            result,
          )
        }
        if (flags.certificateKey) {
          const result = await verifier.verifyCertificateKey()
          console.log(
            `[VerifierChain] ${verifierName}.verifyCertificateKey() returned:`,
            result,
          )
        }
        if (flags.dnsCAA) {
          const result = await verifier.verifyDnsCAA()
          console.log(
            `[VerifierChain] ${verifierName}.verifyDnsCAA() returned:`,
            result,
          )
        }
        if (flags.ctLog) {
          const result = await verifier.verifyCTLog()
          console.log(
            `[VerifierChain] ${verifierName}.verifyCTLog() returned:`,
            result,
          )
        }
      }

      console.log(`[VerifierChain] ${verifierName} completed successfully`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[VerifierChain] ${verifierName} failed:`, message)
      errors.push(message)
    }
  }

  return {
    success: errors.length === 0,
    errors,
  }
}
