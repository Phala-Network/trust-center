import { DeepseekKmsInfo } from '../consts'
import { KmsDataObjectGenerator } from '../dataObjects/kmsDataObjectGenerator'
import {
  KeyProviderSchema,
  safeParseEventLog,
  TcbInfoSchema,
  VmConfigSchema,
} from '../schemas'
import {
  type AppInfo,
  type AttestationBundle,
  type KmsMetadata,
  parseJsonFields,
  type QuoteData,
} from '../types'
import { DstackKms } from '../utils/dstackContract'
import {
  isUpToDate,
  verifyTeeQuote,
} from '../verification/hardwareVerification'
import {
  getImageFolder,
  verifyOSIntegrity,
} from '../verification/osVerification'
import { verifyComposeHash } from '../verification/sourceCodeVerification'
import { Verifier } from '../verifier'

/**
 * KMS (Key Management Service) verifier implementation for DStack TEE applications.
 *
 * This verifier retrieves attestation data from a smart contract and verifies
 * the integrity of a KMS service running in a TEE environment.
 */
export class KmsVerifier extends Verifier {
  /** Smart contract interface for retrieving KMS attestation data */
  public registrySmartContract: DstackKms
  /** Certificate Authority public key extracted from the smart contract */
  public certificateAuthorityPublicKey: `0x${string}` = '0x'
  /** Data object generator for KMS-specific objects */
  private dataObjectGenerator: KmsDataObjectGenerator

  /**
   * Creates a new KMS verifier instance.
   */
  constructor(
    contractAddress: `0x${string}`,
    metadata: KmsMetadata,
    chainId = 8453, // Base mainnet
  ) {
    super(metadata, 'kms')
    this.registrySmartContract = new DstackKms(contractAddress, chainId)
    this.dataObjectGenerator = new KmsDataObjectGenerator(metadata)
  }

  /**
   * Retrieves the Gateway application identifier from the smart contract.
   */
  public async getGatewatyAppId(): Promise<string> {
    return this.registrySmartContract.gatewayAppId()
  }

  /**
   * Retrieves the TEE quote and event log from the smart contract.
   */
  protected async getQuote(): Promise<QuoteData> {
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
   */
  protected async getAppInfo(): Promise<AppInfo> {
    return parseJsonFields<AppInfo>(DeepseekKmsInfo, {
      tcb_info: TcbInfoSchema,
      key_provider_info: KeyProviderSchema,
      vm_config: VmConfigSchema,
    })
  }

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
    const imageFolderName = getImageFolder('kms')

    const measurementResult = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for KMS OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(
      appInfo,
      measurementResult,
    )
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
      this.registrySmartContract.address,
      await this.getGatewatyAppId(),
      this.certificateAuthorityPublicKey,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return isValid
  }
}
