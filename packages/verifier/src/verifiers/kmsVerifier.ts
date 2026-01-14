import {KmsDataObjectGenerator} from '../dataObjects/kmsDataObjectGenerator'
import {safeParseEventLog} from '../schemas'
import type {
  AppInfo,
  AttestationBundle,
  KmsInfo,
  KmsMetadata,
  QuoteData,
  SystemInfo,
  VerificationFailure,
} from '../types'
import type {DataObjectCollector} from '../utils/dataObjectCollector'
import {DstackKms} from '../utils/dstackContract'
import {isUpToDate, verifyTeeQuote} from '../verification/hardwareVerification'
import {verifyOSIntegrity} from '../verification/osVerification'
import {verifyComposeHash} from '../verification/sourceCodeVerification'
import {Verifier} from '../verifier'

/**
 * Abstract base class for KMS (Key Management Service) verifier implementations.
 *
 * This class provides common functionality for verifying KMS services running in TEE environments,
 * while allowing subclasses to implement app-specific logic for retrieving application information.
 */
export abstract class KmsVerifier extends Verifier {
  /** Smart contract interface for retrieving KMS attestation data */
  public registrySmartContract?: DstackKms
  /** Certificate Authority public key extracted from the smart contract */
  public certificateAuthorityPublicKey: `0x${string}` = '0x'
  /** Data object generator for KMS-specific objects */
  protected dataObjectGenerator: KmsDataObjectGenerator
  /** KMS info from systemInfo.kms_info */
  protected kmsInfo: KmsInfo
  /** Full system info for accessing kms_guest_agent_info */
  protected systemInfo: SystemInfo

  /**
   * Creates a new KMS verifier instance.
   */
  constructor(
    metadata: KmsMetadata,
    systemInfo: SystemInfo,
    collector: DataObjectCollector,
  ) {
    super(metadata, 'kms', collector)
    this.systemInfo = systemInfo
    this.kmsInfo = systemInfo.kms_info

    // Only create smart contract if governance is OnChain
    if (metadata.governance?.type === 'OnChain') {
      if (!this.kmsInfo.contract_address) {
        throw new Error(
          'KMS contract address is required for on-chain governance',
        )
      }
      this.registrySmartContract = new DstackKms(
        this.kmsInfo.contract_address,
        metadata.governance.chainId,
      )
    }

    this.dataObjectGenerator = new KmsDataObjectGenerator(metadata)
  }

  /**
   * Retrieves the Gateway application identifier from the smart contract.
   */
  public async getGatewatyAppId(): Promise<string> {
    if (!this.kmsInfo.gateway_app_id) {
      throw new Error('Gateway application ID is not available in KMS info')
    }
    return this.kmsInfo.gateway_app_id
  }

  /**
   * Retrieves the TEE quote and event log from the smart contract.
   */
  protected async getQuote(): Promise<QuoteData> {
    if (!this.registrySmartContract) {
      throw new Error(
        'Registry smart contract is not defined - on-chain governance required',
      )
    }

    const kmsInfo = await this.registrySmartContract.kmsInfo()
    const eventLogBuffer = Buffer.from(
      kmsInfo.eventlog.replace('0x', ''),
      'hex',
    ).toString('utf8')

    this.certificateAuthorityPublicKey = kmsInfo.caPubkey

    return {
      quote: kmsInfo.quote,
      eventlog: safeParseEventLog(eventLogBuffer),
    }
  }

  /**
   * Retrieves attestation bundle including GPU evidence.
   */
  protected async getAttestation(): Promise<AttestationBundle | null> {
    return null
  }

  /**
   * Retrieves application information for the KMS instance.
   * Must be implemented by subclasses to provide app-specific logic.
   */
  protected abstract override getAppInfo(): Promise<AppInfo>

  /**
   * Verifies the hardware attestation by validating the TDX quote.
   */
  public async verifyHardware(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)
    const failures: VerificationFailure[] = []

    // Generate DataObjects for KMS hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    const isValid = isUpToDate(verificationResult)
    if (!isValid) {
      failures.push({
        componentId: 'kms-main',
        error: `Hardware verification failed: TEE attestation status is '${verificationResult.status}' (expected 'UpToDate')`,
      })
    }

    return {isValid, failures}
  }

  /**
   * Verifies the operating system integrity by comparing measurement registers.
   */
  public async verifyOperatingSystem(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const appInfo = await this.getAppInfo()
    const failures: VerificationFailure[] = []

    // Extract version from KMS info and construct image folder name
    const {extractVersionNumber, ensureDstackImage} = await import(
      '../utils/imageDownloader'
    )
    const version = extractVersionNumber(this.kmsInfo.version)
    const imageFolderName = `dstack-${version}`

    // Ensure image is downloaded
    await ensureDstackImage(imageFolderName)

    const isValid = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for KMS OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(appInfo)
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    if (!isValid) {
      failures.push({
        componentId: 'kms-main',
        error:
          'Operating system verification failed: Measurement registers (MRTD, RTMR0-2) do not match expected values',
      })
    }

    return {isValid, failures}
  }

  /**
   * Verifies the source code authenticity by validating the compose hash.
   */
  public async verifySourceCode(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()
    const failures: VerificationFailure[] = []

    const {isValid, calculatedHash} = await verifyComposeHash(
      appInfo,
      quoteData,
      undefined, // KMS doesn't use registry validation
    )

    // Generate DataObjects for KMS source code verification
    const dataObjects = this.dataObjectGenerator.generateSourceCodeDataObjects(
      appInfo,
      quoteData,
      calculatedHash,
      this.registrySmartContract?.address ?? '0x',
      await this.getGatewatyAppId(),
      this.certificateAuthorityPublicKey,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    if (!isValid) {
      failures.push({
        componentId: 'kms-main',
        error:
          'Source code verification failed: Calculated compose hash does not match the hash in RTMR3 event log',
      })
    }

    return {isValid, failures}
  }
}
