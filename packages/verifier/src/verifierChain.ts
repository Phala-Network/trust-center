/**
 * Simple verifier chain - creates and executes the right verifiers based on app config
 */

import type {PhalaCloudConfig, VerificationFlags} from './config'
import type {AppMetadata, SystemInfo, VerificationFailure} from './types'
import type {DataObjectCollector} from './utils/dataObjectCollector'
import {
  completeAppMetadata,
  createGatewayMetadata,
  createKmsMetadata,
  supportsOnchainKms,
} from './utils/metadataUtils'
import {verifyWithIntelTrustAuthority} from './verification/hardwareVerification'
import type {Verifier} from './verifier'
import {GatewayVerifier} from './verifiers/gatewayVerifier'
import {KmsVerifier} from './verifiers/kmsVerifier'
import {
  LegacyGatewayStubVerifier,
  LegacyKmsStubVerifier,
} from './verifiers/legacyStubVerifiers'
import {PhalaCloudKmsVerifier} from './verifiers/phalaCloudKmsVerifier'
import {PhalaCloudVerifier} from './verifiers/phalaCloudVerifier'

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

  const useLegacyStubs =
    !supportsOnchainKms(systemInfo.kms_info.version) ||
    !systemInfo.kms_guest_agent_info ||
    !systemInfo.gateway_guest_agent_info

  if (useLegacyStubs) {
    const reason = !supportsOnchainKms(systemInfo.kms_info.version)
      ? 'legacy KMS version (< 0.5.3)'
      : !systemInfo.kms_guest_agent_info
        ? 'kms_guest_agent_info not available'
        : 'gateway_guest_agent_info not available'
    console.log(
      `[VerifierChain] Using stub verifiers: ${reason}`,
    )
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
      new PhalaCloudKmsVerifier(kmsMetadata, systemInfo, collector),
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
  collector: DataObjectCollector,
): Promise<{
  success: boolean
  errors: string[]
  failures: VerificationFailure[]
}> {
  const errors: string[] = []
  const failures: VerificationFailure[] = []

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
        if (result.failures.length > 0) {
          failures.push(...result.failures)
        }
      }
      if (flags.os) {
        const result = await verifier.verifyOperatingSystem()
        console.log(
          `[VerifierChain] ${verifierName}.verifyOperatingSystem() returned:`,
          result,
        )
        if (result.failures.length > 0) {
          failures.push(...result.failures)
        }
      }
      if (flags.sourceCode) {
        const result = await verifier.verifySourceCode()
        console.log(
          `[VerifierChain] ${verifierName}.verifySourceCode() returned:`,
          result,
        )
        if (result.failures.length > 0) {
          failures.push(...result.failures)
        }
      }

      // Run domain verification for Gateway verifier
      if (verifier instanceof GatewayVerifier) {
        const capabilities =
          await verifier.getDomainVerificationCapabilities()

        if (flags.teeControlledKey) {
          const result = await verifier.verifyTeeControlledKey()
          console.log(
            `[VerifierChain] ${verifierName}.verifyTeeControlledKey() returned:`,
            result,
          )
          if (!result.isValid) {
            failures.push({
              componentId: 'gateway-main',
              error:
                result.error ||
                `${verifierName}: TEE controlled key verification failed`,
            })
          }
        }
        if (flags.certificateKey) {
          if (capabilities.hasActiveCert) {
            const result = await verifier.verifyCertificateKey()
            console.log(
              `[VerifierChain] ${verifierName}.verifyCertificateKey() returned:`,
              result,
            )
            if (!result.isValid) {
              failures.push({
                componentId: 'gateway-main',
                error:
                  result.error ||
                  `${verifierName}: Certificate key verification failed`,
              })
            }
          } else {
            console.log(
              `[VerifierChain] ${verifierName}.verifyCertificateKey() skipped: active_cert not available (new gateway format)`,
            )
          }
        }
        if (flags.dnsCAA) {
          if (capabilities.hasBaseDomain) {
            const result = await verifier.verifyDnsCAA()
            console.log(
              `[VerifierChain] ${verifierName}.verifyDnsCAA() returned:`,
              result,
            )
            if (!result.isValid) {
              failures.push({
                componentId: 'gateway-main',
                error:
                  result.error ||
                  `${verifierName}: DNS CAA verification failed`,
              })
            }
          } else {
            console.log(
              `[VerifierChain] ${verifierName}.verifyDnsCAA() skipped: base_domain not available (new gateway format)`,
            )
          }
        }
        if (flags.ctLog) {
          if (capabilities.hasBaseDomain) {
            const result = await verifier.verifyCTLog()
            console.log(
              `[VerifierChain] ${verifierName}.verifyCTLog() returned:`,
              result,
            )
            if (!result.tee_controlled) {
              failures.push({
                componentId: 'gateway-main',
                error: `${verifierName}: Certificate Transparency log verification failed`,
              })
            }
          } else {
            console.log(
              `[VerifierChain] ${verifierName}.verifyCTLog() skipped: base_domain not available (new gateway format)`,
            )
          }
        }
      }

      console.log(`[VerifierChain] ${verifierName} completed successfully`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[VerifierChain] ${verifierName} failed:`, message)
      errors.push(message)
    }
  }

  // Run Intel Trust Authority verification as the final step.
  // Each verifier is evaluated independently — ITA runs for verifiers that
  // successfully completed hardware verification (have a quote), even if
  // other verifiers in the chain failed.
  await runDeferredIta(verifiers, collector)

  return {
    success: errors.length === 0,
    errors,
    failures,
  }
}

/**
 * Runs Intel Trust Authority appraisal for verifiers that successfully
 * completed hardware verification (have a non-null lastQuoteHex).
 * Each verifier is evaluated independently — a failure or error in one
 * verifier does not prevent ITA for others.
 */
async function runDeferredIta(
  verifiers: Verifier[],
  collector: DataObjectCollector,
): Promise<void> {
  const itaApiKey = process.env.INTEL_TRUST_AUTHORITY_API_KEY
  if (!itaApiKey) {
    return
  }

  // Collect verifiers that successfully produced a quote
  const itaTasks: Array<{
    verifierName: string
    quoteHex: string
    cpuObjectId: string
  }> = []

  for (const verifier of verifiers) {
    let quoteHex: string | null = null
    let cpuObjectId: string | null = null

    if (verifier instanceof PhalaCloudVerifier) {
      quoteHex = verifier.lastQuoteHex
      cpuObjectId = 'app-cpu'
    } else if (verifier instanceof KmsVerifier) {
      quoteHex = verifier.lastQuoteHex
      cpuObjectId = 'kms-cpu'
    } else if (verifier instanceof GatewayVerifier) {
      quoteHex = verifier.lastQuoteHex
      cpuObjectId = 'gateway-cpu'
    }

    if (quoteHex && cpuObjectId) {
      itaTasks.push({
        verifierName: verifier.constructor.name,
        quoteHex,
        cpuObjectId,
      })
    }
  }

  if (itaTasks.length === 0) {
    return
  }

  console.log(
    `[VerifierChain] Running deferred ITA for ${itaTasks.length} verifier(s)`,
  )

  // Run ITA calls in parallel — they are independent
  const results = await Promise.allSettled(
    itaTasks.map(async ({verifierName, quoteHex, cpuObjectId}) => {
      try {
        const itaResult = await verifyWithIntelTrustAuthority(
          quoteHex,
          itaApiKey,
        )
        if (itaResult) {
          const updated = collector.updateObjectFields(cpuObjectId, {
            intel_trust_authority: JSON.stringify(itaResult),
          })
          if (updated) {
            console.log(`[VerifierChain] ITA result added to ${cpuObjectId}`)
          } else {
            console.warn(
              `[VerifierChain] ITA for ${verifierName}: CPU DataObject '${cpuObjectId}' not found`,
            )
          }
        }
      } catch (error) {
        // ITA is optional — log and continue
        console.warn(
          `[VerifierChain] ITA failed for ${verifierName}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }),
  )
}
