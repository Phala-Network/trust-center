/**
 * Verification service for orchestrating conditional verification steps
 *
 * This service coordinates the execution of verification steps based on
 * configuration and flags, collecting DataObjects and tracking execution metadata.
 */

import type {VerificationFlags, VerifierConfigs} from './config'
import {DEFAULT_VERIFICATION_FLAGS} from './config'
import {GatewayVerifier} from './gatewayVerifier'
import {KmsVerifier} from './kmsVerifier'
import {RedpillVerifier} from './redpillVerifier'
import type {
  ExecutionMetadata,
  ObjectRelationship,
  VerificationError,
  VerificationResponse,
  VerifierType,
} from './types'
import {
  clearAllDataObjects,
  configureVerifierRelationships,
  getAllDataObjects,
} from './utils/dataObjectCollector'

/**
 * Service class for orchestrating verification operations
 */
export class VerificationService {
  private startTime: number = 0
  private stepTimes: {[stepName: string]: number} = {}
  private executedSteps: string[] = []
  private skippedSteps: string[] = []
  private errors: VerificationError[] = []

  /**
   * Execute verification based on type, configuration, and flags
   */
  async verify(
    verifierType: VerifierType,
    configs: VerifierConfigs,
    flags: VerificationFlags = DEFAULT_VERIFICATION_FLAGS,
  ): Promise<VerificationResponse> {
    this.startTime = Date.now()
    this.stepTimes = {}
    this.executedSteps = []
    this.skippedSteps = []
    this.errors = []

    // Clear any existing DataObjects
    clearAllDataObjects()

    try {
      switch (verifierType) {
        case 'kms':
          return await this.verifyKms(configs, flags)
        case 'gateway':
          return await this.verifyGateway(configs, flags)
        case 'redpill':
          return await this.verifyRedpill(configs, flags)
        default:
          throw new Error(`Unknown verifier type: ${verifierType}`)
      }
    } catch (error) {
      this.addError(
        'initialization',
        error instanceof Error ? error.message : 'Unknown error',
      )
      return this.buildResponse()
    }
  }

  /**
   * Execute KMS verification
   */
  private async verifyKms(
    configs: VerifierConfigs,
    flags: VerificationFlags,
  ): Promise<VerificationResponse> {
    if (!configs.kms) {
      throw new Error('KMS configuration is required')
    }

    const kmsVerifier = new KmsVerifier(
      configs.kms.contractAddress,
      configs.kms.metadata,
    )

    // Execute verification steps based on flags
    await this.executeStep('hardware', flags.hardware, () =>
      kmsVerifier.verifyHardware(),
    )
    await this.executeStep('os', flags.os, () =>
      kmsVerifier.verifyOperatingSystem(),
    )
    await this.executeStep('sourceCode', flags.sourceCode, () =>
      kmsVerifier.verifySourceCode(),
    )

    return this.buildResponse()
  }

  /**
   * Execute Gateway verification
   */
  private async verifyGateway(
    configs: VerifierConfigs,
    flags: VerificationFlags,
  ): Promise<VerificationResponse> {
    if (!configs.gateway) {
      throw new Error('Gateway configuration is required')
    }

    // If gateway contract address is not provided, try to get it from KMS
    let gatewayContractAddress = configs.gateway.contractAddress
    if (!gatewayContractAddress || gatewayContractAddress === '0x') {
      if (!configs.kms) {
        throw new Error(
          'KMS configuration is required to resolve Gateway contract address',
        )
      }

      const kmsVerifier = new KmsVerifier(
        configs.kms.contractAddress,
        configs.kms.metadata,
      )

      try {
        gatewayContractAddress =
          (await kmsVerifier.getGatewatyAppId()) as `0x${string}`
      } catch (error) {
        this.addError(
          'gateway-address-resolution',
          error instanceof Error
            ? error.message
            : 'Failed to resolve Gateway contract address',
        )
        return this.buildResponse()
      }
    }

    const gatewayVerifier = new GatewayVerifier(
      gatewayContractAddress,
      configs.gateway.rpcEndpoint,
      configs.gateway.metadata,
    )

    // Execute basic verification steps
    await this.executeStep('hardware', flags.hardware, () =>
      gatewayVerifier.verifyHardware(),
    )
    await this.executeStep('os', flags.os, () =>
      gatewayVerifier.verifyOperatingSystem(),
    )
    await this.executeStep('sourceCode', flags.sourceCode, () =>
      gatewayVerifier.verifySourceCode(),
    )

    // Execute domain verification steps
    await this.executeStep('teeControlledKey', flags.teeControlledKey, () =>
      gatewayVerifier.verifyTeeControlledKey(),
    )
    await this.executeStep('certificateKey', flags.certificateKey, () =>
      gatewayVerifier.verifyCertificateKey(),
    )
    await this.executeStep('dnsCAA', flags.dnsCAA, () =>
      gatewayVerifier.verifyDnsCAA(),
    )
    await this.executeStep('ctLog', flags.ctLog, () =>
      gatewayVerifier.verifyCTLog(),
    )

    // Configure relationships if KMS was provided
    if (configs.kms) {
      this.configureKmsGatewayRelationships()
    }

    return this.buildResponse()
  }

  /**
   * Execute Redpill verification
   */
  private async verifyRedpill(
    configs: VerifierConfigs,
    flags: VerificationFlags,
  ): Promise<VerificationResponse> {
    if (!configs.redpill) {
      throw new Error('Redpill configuration is required')
    }

    const redpillVerifier = new RedpillVerifier(
      configs.redpill.contractAddress,
      configs.redpill.model,
      configs.redpill.metadata,
    )

    // Execute verification steps based on flags
    await this.executeStep('hardware', flags.hardware, () =>
      redpillVerifier.verifyHardware(),
    )
    await this.executeStep('os', flags.os, () =>
      redpillVerifier.verifyOperatingSystem(),
    )
    await this.executeStep('sourceCode', flags.sourceCode, () =>
      redpillVerifier.verifySourceCode(),
    )

    return this.buildResponse()
  }

  /**
   * Execute a verification step with timing and error handling
   */
  private async executeStep(
    stepName: string,
    shouldExecute: boolean,
    stepFunction: () => Promise<unknown>,
  ): Promise<void> {
    if (!shouldExecute) {
      this.skippedSteps.push(stepName)
      return
    }

    const stepStartTime = Date.now()

    try {
      await stepFunction()
      this.executedSteps.push(stepName)
    } catch (error) {
      this.addError(
        stepName,
        error instanceof Error ? error.message : 'Unknown error',
      )
      this.executedSteps.push(stepName) // Still mark as executed even if failed
    }

    this.stepTimes[stepName] = Date.now() - stepStartTime
  }

  /**
   * Add an error to the error collection
   */
  private addError(
    step: string,
    message: string,
    code?: string,
    details?: unknown,
  ): void {
    this.errors.push({
      step,
      message,
      code,
      details,
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
   * Build the final verification response
   */
  private buildResponse(): VerificationResponse {
    const endTime = Date.now()

    const metadata: ExecutionMetadata = {
      totalTimeMs: endTime - this.startTime,
      stepTimes: {...this.stepTimes},
      executedSteps: [...this.executedSteps],
      skippedSteps: [...this.skippedSteps],
      startedAt: new Date(this.startTime).toISOString(),
      completedAt: new Date(endTime).toISOString(),
    }

    const dataObjects = getAllDataObjects()
    const success = this.errors.length === 0

    return {
      dataObjects,
      metadata,
      errors: [...this.errors],
      success,
    }
  }
}
