/**
 * Verification service for orchestrating conditional verification steps
 *
 * This service coordinates the execution of verification steps based on
 * configuration and flags, collecting DataObjects and tracking execution metadata.
 */

import type {PhalaCloudConfig, VerificationFlags} from './config'
import {DEFAULT_VERIFICATION_FLAGS} from './config'
import type {
  ObjectRelationship,
  SystemInfo,
  VerificationError,
  VerificationFailure,
  VerificationResponse,
} from './types'
import {DataObjectCollector} from './utils/dataObjectCollector'
import {maskSensitiveDataObjects} from './utils/maskSensitiveData'
import {
  getGitCommitFromImageVersion,
  supportsOnchainKms,
} from './utils/metadataUtils'
import {createVerifiers, executeVerifiers} from './verifierChain'
import {PhalaCloudVerifier} from './verifiers/phalaCloudVerifier'

/**
 * Service class for orchestrating verification operations
 * Each instance maintains its own DataObjectCollector to avoid
 * data pollution between concurrent verifications.
 */
export class VerificationService {
  private failures: VerificationFailure[] = []
  private errors: VerificationError[] = []
  private collector: DataObjectCollector

  constructor() {
    // Each verification service gets its own collector instance
    this.collector = new DataObjectCollector()
  }

  /**
   * Execute verification based on app configuration and flags
   */
  async verify(
    appConfig: PhalaCloudConfig,
    flags?: Partial<VerificationFlags>,
  ): Promise<VerificationResponse> {
    this.errors = []
    this.failures = []

    // Merge provided flags with default flags
    const mergedFlags: VerificationFlags = {
      ...DEFAULT_VERIFICATION_FLAGS,
      ...flags,
    }

    // Clear any existing DataObjects from previous verifications
    this.collector.clear()

    try {
      // Get complete DStack info from the app
      const systemInfo = await this.getSystemInfo(appConfig)

      // Extract git commit from instance image version if available (Phala Cloud only)
      if (systemInfo.instances[0]?.image_version) {
        const imageVersion = systemInfo.instances[0].image_version
        const gitCommit = await getGitCommitFromImageVersion(imageVersion)
        if (!appConfig.metadata) {
          appConfig.metadata = {}
        }
        appConfig.metadata.osSource = {
          github_repo: 'https://github.com/Dstack-TEE/meta-dstack',
          git_commit: gitCommit,
          version: imageVersion,
        }
      }

      // Create and execute verifier chain with this collector instance
      const verifiers = createVerifiers(appConfig, systemInfo, this.collector)

      const result = await executeVerifiers(verifiers, mergedFlags)
      this.configureVerifierRelationships(systemInfo)

      // Convert errors to the expected format
      this.errors = result.errors.map((error) => ({message: error}))
      this.failures = result.failures

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
    const hasOnchainKms = supportsOnchainKms(systemInfo.kms_info.version)

    const relationships: ObjectRelationship[] = [
      // KMS -> Gateway relationships
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'gateway-main',
        ...(hasOnchainKms
          ? {
              sourceField: 'gateway_app_id',
              targetField: 'app_id',
            }
          : {}),
      },
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'gateway-main',
        ...(hasOnchainKms
          ? {
              sourceField: 'cert_pubkey',
              targetField: 'app_cert',
            }
          : {}),
      },
      // KMS -> App relationships
      {
        sourceObjectId: 'kms-main',
        targetObjectId: 'app-main',
        ...(hasOnchainKms
          ? {
              sourceField: 'cert_pubkey',
              targetField: 'app_cert',
            }
          : {}),
      },
    ]

    this.collector.configureVerifierRelationships({relationships})
  }

  /**
   * Get DStack info using verifier static methods
   */
  private async getSystemInfo(
    appConfig: PhalaCloudConfig,
  ): Promise<SystemInfo> {
    return await PhalaCloudVerifier.getSystemInfo(appConfig.appId)
  }

  /**
   * Build the final verification response
   */
  private buildResponse(): VerificationResponse {
    // Use this instance's collector
    const dataObjects = this.collector.getAllObjects()

    // Mask sensitive data before returning
    const maskedDataObjects = maskSensitiveDataObjects(dataObjects)

    const success = this.errors.length === 0

    return {
      dataObjects: maskedDataObjects,
      completedAt: new Date().toISOString(),
      errors: [...this.errors],
      failures: [...this.failures],
      success,
    }
  }
}
