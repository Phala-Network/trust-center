/**
 * Verification service for orchestrating conditional verification steps
 *
 * This service coordinates the execution of verification steps based on
 * configuration and flags, collecting DataObjects and tracking execution metadata.
 */

import type {
  PhalaCloudConfig,
  RedpillConfig,
  VerificationFlags,
} from './config'
import { DEFAULT_VERIFICATION_FLAGS } from './config'
import type {
  ObjectRelationship,
  SystemInfo,
  VerificationError,
  VerificationResponse,
} from './types'
import {
  clearAllDataObjects,
  configureVerifierRelationships,
} from './utils/dataObjectCollector'
import { isLegacyVersion } from './utils/metadataUtils'
import { createVerifiers, executeVerifiers } from './verifierChain'
import { PhalaCloudVerifier } from './verifiers/phalaCloudVerifier'
import { RedpillVerifier } from './verifiers/redpillVerifier'

/**
 * Service class for orchestrating verification operations
 */
export class VerificationService {
  private errors: VerificationError[] = []

  /**
   * Execute verification based on app configuration and flags
   */
  async verify(
    appConfig: RedpillConfig | PhalaCloudConfig,
    flags?: Partial<VerificationFlags>,
  ): Promise<VerificationResponse> {
    this.errors = []

    // Merge provided flags with default flags
    const mergedFlags: VerificationFlags = {
      ...DEFAULT_VERIFICATION_FLAGS,
      ...flags,
    }

    // Clear any existing DataObjects
    clearAllDataObjects()

    try {
      // Get complete DStack info from the app
      const systemInfo = await this.getSystemInfo(appConfig)

      // Create and execute verifier chain
      const verifiers = createVerifiers(appConfig, systemInfo)

      const result = await executeVerifiers(verifiers, mergedFlags)
      this.configureVerifierRelationships(systemInfo)

      // Convert errors to the expected format
      this.errors = result.errors.map((error) => ({ message: error }))

      return this.buildResponse()
    } catch (error) {
      let errorMessage: string
      if (error instanceof Error) {
        // Provide context for common error patterns
        if (error.message === 'fetch() URL is invalid') {
          errorMessage =
            'Verification failed due to invalid URL configuration - check your app configuration or endpoint URLs'
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = `Network error during verification: ${error.message}`
        } else {
          errorMessage = error.message
        }
      } else {
        errorMessage = 'Unknown verification error occurred'
      }

      console.error(
        '[VERIFICATION_SERVICE] Top-level verification error:',
        error,
      )
      this.addError(errorMessage)
      return this.buildResponse()
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
   * Configure relationships between verifiers
   */
  private configureVerifierRelationships(systemInfo: SystemInfo): void {
    const isLegacy = isLegacyVersion(systemInfo.kms_info.version)

    const relationships: ObjectRelationship[] = [
      // KMS -> Gateway relationships
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'gateway-main',
        ...(isLegacy
          ? {}
          : {
              sourceField: 'gateway_app_id',
              targetField: 'app_id',
            }),
      },
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'gateway-main',
        ...(isLegacy
          ? {}
          : {
              sourceField: 'cert_pubkey',
              targetField: 'app_cert',
            }),
      },
      // KMS -> App relationships
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'app-main',
        ...(isLegacy
          ? {}
          : {
              sourceField: 'cert_pubkey',
              targetField: 'app_cert',
            }),
      },
    ]

    configureVerifierRelationships({ relationships })
  }

  /**
   * Get DStack info using verifier static methods
   */
  private async getSystemInfo(
    appConfig: RedpillConfig | PhalaCloudConfig,
  ): Promise<SystemInfo> {
    if ('model' in appConfig) {
      // RedpillConfig
      return await RedpillVerifier.getSystemInfo(
        appConfig.contractAddress,
        appConfig.model,
      )
    } else {
      // PhalaCloudConfig
      return await PhalaCloudVerifier.getSystemInfo(appConfig.contractAddress)
    }
  }

  /**
   * Build the final verification response
   */
  private buildResponse(): VerificationResponse {
    // Import getAllDataObjects dynamically to avoid circular dependencies
    const { getAllDataObjects } = require('./utils/dataObjectCollector')
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
