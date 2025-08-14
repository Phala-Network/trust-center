import {createHash} from 'node:crypto'
import path from 'node:path'
import {DeepseekKmsInfo} from './consts'
import {
  KeyProviderSchema,
  safeParseEventLog,
  TcbInfoSchema,
  VmConfigSchema,
} from './schemas'
import {
  type AppInfo,
  type AttestationBundle,
  parseJsonFields,
  type QuoteData,
} from './types'
import {verifyQuote} from './utils/dcap-qvl'
import {measureDstackImages} from './utils/dstack-mr'
import {DstackKms} from './utils/dstackContract'
import {calculate, getCollectedEvents, measure} from './utils/operations'
import {Verifier} from './verifier'

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

  /**
   * Creates a new KMS verifier instance.
   *
   * @param contractAddress - Ethereum address of the DStack KMS registry contract
   */
  constructor(contractAddress: `0x${string}`) {
    super()
    this.registrySmartContract = new DstackKms(contractAddress)
  }

  /**
   * Retrieves the Gateway application identifier from the smart contract.
   *
   * This method returns the smart contract address of the Gateway governance
   * contract that this KMS instance is configured to work with. The Gateway
   * app ID is used to establish trust relationships between KMS and Gateway services.
   *
   * @returns Promise resolving to the Gateway governance contract address
   */
  public async getGatewatyAppId(): Promise<string> {
    return this.registrySmartContract.gatewayAppId()
  }

  /**
   * Retrieves the TEE quote and event log from the smart contract.
   *
   * The KMS publishes its attestation data on-chain for public verification.
   *
   * @returns Promise resolving to the quote and parsed event log
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
   *
   * KMS services typically do not require GPU attestation.
   *
   * @returns Promise resolving to null as KMS doesn't use GPU attestation
   */
  protected async getAttestation(): Promise<AttestationBundle | null> {
    return null
  }

  /**
   * Retrieves application information for the KMS instance.
   *
   * Uses pre-configured KMS information from constants and parses JSON fields.
   *
   * @returns Promise resolving to parsed application information
   */
  protected async getAppInfo(): Promise<AppInfo> {
    const rawKmsAppInfo = DeepseekKmsInfo

    return parseJsonFields<AppInfo>(rawKmsAppInfo, {
      tcb_info: TcbInfoSchema,
      key_provider_info: KeyProviderSchema,
      vm_config: VmConfigSchema,
    })
  }

  /**
   * Verifies the hardware attestation by validating the TDX quote.
   *
   * Uses DCAP-QVL to verify the cryptographic quote from the TEE.
   *
   * @returns Promise resolving to true if hardware attestation is valid and up-to-date
   */
  public async verifyHardware(): Promise<boolean> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyQuote(quoteData.quote, {hex: true})
    return verificationResult.status === 'UpToDate'
  }

  /**
   * Verifies the operating system integrity by comparing measurement registers.
   *
   * Measures the DStack OS images and compares the results with the expected
   * values from the TCB information.
   *
   * @returns Promise resolving to true if all measurement registers match
   */
  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    const measurementResult = await measureDstackImages({
      image_folder: path.join(
        __dirname,
        '../external/dstack-images/dstack-0.5.3',
      ),
      vm_config: appInfo.vm_config,
    })

    const expectedTcb = appInfo.tcb_info
    return (
      measurementResult.mrtd === expectedTcb.mrtd &&
      measurementResult.rtmr0 === expectedTcb.rtmr0 &&
      measurementResult.rtmr1 === expectedTcb.rtmr1 &&
      measurementResult.rtmr2 === expectedTcb.rtmr2
    )
  }

  /**
   * Verifies the source code authenticity by validating the compose hash.
   *
   * Calculates the SHA256 hash of the application composition and compares it
   * with the hash recorded in the event log.
   *
   * @returns Promise resolving to true if the compose hash matches the event log
   */
  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()

    const appComposeConfig = appInfo.tcb_info.app_compose
    const composeHashEvent = quoteData.eventlog.find(
      (entry) => entry.event === 'compose-hash',
    )

    if (!composeHashEvent) {
      return false
    }

    const calculatedHash = calculate(
      'appInfo.tcb_info.app_compose',
      appComposeConfig,
      'compose_hash',
      'sha256',
      () => createHash('sha256').update(appComposeConfig).digest('hex'),
    )

    console.log(getCollectedEvents())

    return measure(
      composeHashEvent?.event_payload,
      calculatedHash,
      () => calculatedHash === composeHashEvent?.event_payload,
    )
  }

  /**
   * Retrieves metadata about the KMS verification process and results.
   *
   * @returns Promise resolving to verification metadata including CA public key
   */
  public async getMetadata(): Promise<Record<string, unknown>> {
    return {
      verifierType: 'KMS',
      contractAddress: this.registrySmartContract.address,
      certificateAuthorityPublicKey: this.certificateAuthorityPublicKey,
      supportedVerifications: ['hardware', 'operatingSystem', 'sourceCode'],
      usesGpuAttestation: false,
    }
  }
}
