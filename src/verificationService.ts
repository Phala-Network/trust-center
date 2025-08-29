/**
 * Verification service for orchestrating conditional verification steps
 *
 * This service coordinates the execution of verification steps based on
 * configuration and flags, collecting DataObjects and tracking execution metadata.
 */

import type {PhalaCloudConfig, RedpillConfig, VerificationFlags} from './config'
import {DEFAULT_VERIFICATION_FLAGS} from './config'
import type {
  ObjectRelationship,
  SystemInfo,
  VerificationError,
  VerificationResponse,
} from './types'
import {
  clearAllDataObjects,
  configureVerifierRelationships,
  getAllDataObjects,
} from './utils/dataObjectCollector'
import {getPhalaCloudInfo, getRedpillInfo} from './utils/systemInfo'
import type {OwnDomain, Verifier} from './verifier'
import {GatewayVerifier} from './verifiers/gatewayVerifier'
import {KmsVerifier} from './verifiers/kmsVerifier'
import {PhalaCloudVerifier} from './verifiers/phalaCloudVerifier'
import {RedpillVerifier} from './verifiers/redpillVerifier'

/**
 * Service class for orchestrating verification operations
 */
export class VerificationService {
  private errors: VerificationError[] = []

  /**
   * Execute verification based on app configuration and flags
   * Automatically fetches KMS and Gateway info using getSystemInfo()
   */
  async verify(
    appConfig: RedpillConfig | PhalaCloudConfig,
    flags: VerificationFlags = DEFAULT_VERIFICATION_FLAGS,
  ): Promise<VerificationResponse> {
    this.errors = []

    // Clear any existing DataObjects
    clearAllDataObjects()

    try {
      // Get complete DStack info from the app
      const systemInfo = await this.getSystemInfo(appConfig)

      // Run KMS verification
      await this.verifyKms(systemInfo, flags)

      // Run Gateway verification
      await this.verifyGateway(systemInfo, flags)

      // Run App verification
      await this.verifyApp(appConfig, flags, systemInfo.kms_info.chain_id)

      return this.buildResponse()
    } catch (error) {
      this.addError(error instanceof Error ? error.message : 'Unknown error')
      return this.buildResponse()
    }
  }

  /**
   * Execute KMS verification
   */
  private async verifyKms(
    systemInfo: SystemInfo,
    flags: VerificationFlags,
  ): Promise<void> {
    const kmsVerifier = new KmsVerifier(
      systemInfo.kms_info.contract_address as `0x${string}`,
      {},
      systemInfo.kms_info.chain_id,
    )

    // Execute verification steps based on flags
    await this.verifyCommon(kmsVerifier, flags)
  }

  /**
   * Execute Gateway verification
   */
  private async verifyGateway(
    systemInfo: SystemInfo,
    flags: VerificationFlags,
  ): Promise<void> {
    const gatewayVerifier = new GatewayVerifier(
      systemInfo.kms_info.gateway_app_id as `0x${string}`,
      systemInfo.kms_info.gateway_app_url,
      {},
      systemInfo.kms_info.chain_id,
    )

    // Execute verification steps based on flags
    await this.verifyCommon(gatewayVerifier, flags)
    await this.verifyDomain(gatewayVerifier, flags)

    // Configure KMS-Gateway relationships
    this.configureKmsGatewayRelationships()
  }

  /**
   * Execute App verification (Redpill or PhalaCloud based on config)
   */
  private async verifyApp(
    appConfig: RedpillConfig | PhalaCloudConfig,
    flags: VerificationFlags,
    chainId: number,
  ): Promise<void> {
    // Determine verifier type based on config properties
    let verifier: RedpillVerifier | PhalaCloudVerifier

    if ('model' in appConfig) {
      // RedpillConfig has model property
      verifier = new RedpillVerifier(
        appConfig.contractAddress,
        appConfig.model,
        appConfig.metadata,
        chainId,
      )
    } else {
      // PhalaCloudConfig has domain property
      verifier = new PhalaCloudVerifier(
        appConfig.contractAddress,
        appConfig.domain,
        appConfig.metadata,
        chainId,
      )
    }

    // Execute verification steps based on flags
    await this.verifyCommon(verifier, flags)
  }

  /**
   * Execute common verification steps based on flags
   */
  private async verifyCommon(
    verifier: Verifier,
    flags: VerificationFlags,
  ): Promise<void> {
    if (flags.hardware) {
      await this.executeStep(
        () => verifier.verifyHardware(),
        'Hardware verification failed',
      )
    }

    if (flags.os) {
      await this.executeStep(
        () => verifier.verifyOperatingSystem(),
        'OS verification failed',
      )
    }

    if (flags.sourceCode) {
      await this.executeStep(
        () => verifier.verifySourceCode(),
        'Source code verification failed',
      )
    }
  }

  /**
   * Execute domain verification steps based on flags
   */
  private async verifyDomain(
    verifier: OwnDomain,
    flags: VerificationFlags,
  ): Promise<void> {
    if (flags.teeControlledKey) {
      await this.executeStep(
        () => verifier.verifyTeeControlledKey(),
        'TEE controlled key verification failed',
      )
    }

    if (flags.certificateKey) {
      await this.executeStep(
        () => verifier.verifyCertificateKey(),
        'Certificate key verification failed',
      )
    }

    if (flags.dnsCAA) {
      await this.executeStep(
        () => verifier.verifyDnsCAA(),
        'DNS CAA verification failed',
      )
    }

    if (flags.ctLog) {
      await this.executeStep(
        () => verifier.verifyCTLog(),
        'CT log verification failed',
      )
    }
  }

  /**
   * Execute a single verification step with error handling
   */
  private async executeStep(
    step: () => Promise<unknown>,
    defaultErrorMessage: string,
  ): Promise<void> {
    try {
      await step()
    } catch (error) {
      this.addError(
        error instanceof Error ? error.message : defaultErrorMessage,
      )
    }
  }

  /**
   * Add an error to the error collection
   */
  private addError(message: string): void {
    this.errors.push({
      message,
    })
  }

  /**
   * Configure relationships between KMS and Gateway verifiers
   */
  private configureKmsGatewayRelationships(): void {
    const relationships: ObjectRelationship[] = [
      // KMS -> Gateway relationships
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'gateway-main',
        sourceField: 'gateway_app_id',
        targetField: 'app_id',
      },
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'gateway-main',
        sourceField: 'cert_pubkey',
        targetField: 'app_cert',
      },
    ]

    configureVerifierRelationships({relationships})
  }

  /**
   * Get DStack info using extracted utility functions
   */
  private async getSystemInfo(
    appConfig: RedpillConfig | PhalaCloudConfig,
  ): Promise<SystemInfo> {
    if ('model' in appConfig) {
      // RedpillConfig
      return await getRedpillInfo(appConfig.contractAddress, appConfig.model)
    } else {
      // PhalaCloudConfig
      return await getPhalaCloudInfo(appConfig.contractAddress)
    }
  }

  /**
   * Build the final verification response
   */
  private buildResponse(): VerificationResponse {
    const dataObjects = getAllDataObjects()
    const success = this.errors.length === 0

    return {
      dataObjects,
      completedAt: new Date().toISOString(),
      errors: [...this.errors],
      success,
    }
  }
}
