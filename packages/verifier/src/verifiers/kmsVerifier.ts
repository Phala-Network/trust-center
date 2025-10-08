import { KmsDataObjectGenerator } from '../dataObjects/kmsDataObjectGenerator'
import { safeParseEventLog } from '../schemas'
import type {
  AppInfo,
  AttestationBundle,
  KmsInfo,
  KmsMetadata,
  QuoteData,
} from '../types'
import { DstackKms } from '../utils/dstackContract'
import {
  isUpToDate,
  verifyTeeQuote,
} from '../verification/hardwareVerification'
import { verifyOSIntegrity } from '../verification/osVerification'
import { verifyComposeHash } from '../verification/sourceCodeVerification'
import { Verifier } from '../verifier'

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
  /** System information for this KMS instance */
  protected kmsInfo: KmsInfo

  /**
   * Creates a new KMS verifier instance.
   */
  constructor(metadata: KmsMetadata, kmsInfo: KmsInfo) {
    super(metadata, 'kms')
    // Only create smart contract if governance is OnChain
    if (metadata.governance?.type === 'OnChain') {
      this.registrySmartContract = new DstackKms(
        kmsInfo.contract_address as `0x${string}`,
        metadata.governance.chainId,
      )
    }

    this.dataObjectGenerator = new KmsDataObjectGenerator(metadata)
    this.kmsInfo = kmsInfo
  }

  /**
   * Retrieves the Gateway application identifier from the smart contract.
   */
  public async getGatewatyAppId(): Promise<string> {
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
  public async verifyHardware(): Promise<boolean> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)

    // Generate DataObjects for KMS hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isUpToDate(verificationResult)
  }

  /**
   * Verifies the operating system integrity by comparing measurement registers.
   */
  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    // Extract version from KMS info and construct image folder name
    const { extractVersionNumber, ensureDstackImage } = await import(
      '../utils/imageDownloader'
    )
    const version = extractVersionNumber(this.kmsInfo.version)
    const imageFolderName = `dstack-${version}`

    // Ensure image is downloaded
    await ensureDstackImage(imageFolderName)

    const measurementResult = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for KMS OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(appInfo)
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return measurementResult
  }

  /**
   * Verifies the source code authenticity by validating the compose hash.
   */
  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()

    const { isValid, calculatedHash } = await verifyComposeHash(
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

    return isValid
  }
}
