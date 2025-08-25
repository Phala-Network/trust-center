import {GatewayDataObjectGenerator} from './dataObjects/gatewayDataObjectGenerator'
import {
  KeyProviderSchema,
  safeParseEventLog,
  safeParseQuoteExt,
  TcbInfoSchema,
  VmConfigSchema,
} from './schemas'
import {
  type AcmeInfo,
  type AppInfo,
  type AttestationBundle,
  type CTResult,
  parseJsonFields,
  type QuoteData,
  type VerifierMetadata,
} from './types'
import {DstackApp} from './utils/dstackContract'
import {
  verifyCertificateKey,
  verifyCTLog,
  verifyDnsCAA,
  verifyTeeControlledKey,
} from './verification/domainVerification'
import {isUpToDate, verifyTeeQuote} from './verification/hardwareVerification'
import {getImageFolder, verifyOSIntegrity} from './verification/osVerification'
import {verifyComposeHash} from './verification/sourceCodeVerification'
import {type OwnDomain, Verifier} from './verifier'

/**
 * Gateway verifier implementation for DStack TEE applications with domain verification.
 */
export class GatewayVerifier extends Verifier implements OwnDomain {
  /** Smart contract interface for retrieving Gateway application data */
  public registrySmartContract: DstackApp
  /** RPC endpoint URL for the Gateway service */
  public gatewayRpcEndpoint: string
  /** Data object generator for Gateway-specific objects */
  private dataObjectGenerator: GatewayDataObjectGenerator

  /**
   * Creates a new Gateway verifier instance.
   */
  constructor(
    contractAddress: `0x${string}`,
    gatewayRpcEndpoint: string,
    metadata: VerifierMetadata = {},
  ) {
    super(metadata, 'gateway')
    this.registrySmartContract = new DstackApp(contractAddress)
    this.gatewayRpcEndpoint = gatewayRpcEndpoint
    this.dataObjectGenerator = new GatewayDataObjectGenerator(metadata)
  }

  /**
   * Retrieves the TEE quote and event log from ACME account information.
   */
  protected async getQuote(): Promise<QuoteData> {
    const acmeInfo = await this.getAcmeInfo()
    const extendedQuoteData = safeParseQuoteExt(acmeInfo.account_quote)

    return {
      quote: `0x${extendedQuoteData.quote}` as const,
      eventlog: safeParseEventLog(extendedQuoteData.event_log),
    }
  }

  /**
   * Retrieves attestation bundle including GPU evidence.
   */
  protected async getAttestation(): Promise<AttestationBundle | null> {
    return null
  }

  /**
   * Retrieves application information from the Gateway RPC endpoint.
   */
  protected async getAppInfo(): Promise<AppInfo> {
    const response = await fetch(`${this.gatewayRpcEndpoint}/.dstack/app-info`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Gateway app info: ${response.status} ${response.statusText}`,
      )
    }
    const responseData = await response.json()
    return parseJsonFields(responseData as Record<string, unknown>, {
      tcb_info: TcbInfoSchema,
      key_provider_info: KeyProviderSchema,
      vm_config: VmConfigSchema,
    }) as AppInfo
  }

  /**
   * Verifies the hardware attestation by validating the TDX quote.
   */
  public async verifyHardware(): Promise<boolean> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)

    // Generate DataObjects for Gateway hardware verification
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
    )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isUpToDate(verificationResult)
  }

  /**
   * Verifies the operating system integrity by comparing measurement registers.
   */
  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const imageFolderName = getImageFolder('gateway')

    const isValid = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for Gateway OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(
      appInfo,
      {} /* measurement result */,
    )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isValid
  }

  /**
   * Verifies the source code authenticity by validating the compose hash.
   */
  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quoteData = await this.getQuote()

    const {isValid, calculatedHash, isRegistered} = await verifyComposeHash(
      appInfo,
      quoteData,
      this.registrySmartContract,
    )

    // Generate DataObjects for Gateway source code verification
    const acmeInfo = await this.getAcmeInfo()
    const dataObjects = this.dataObjectGenerator.generateSourceCodeDataObjects(
      appInfo,
      quoteData,
      calculatedHash,
      isRegistered ?? false,
      this.registrySmartContract.address,
      this.gatewayRpcEndpoint,
      acmeInfo.active_cert,
    )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return isValid
  }

  /**
   * Retrieves metadata about the Gateway verification process and results.
   */
  public async getMetadata(): Promise<Record<string, unknown>> {
    return {
      verifierType: 'Gateway',
      contractAddress: this.registrySmartContract.address,
      gatewayEndpoint: this.gatewayRpcEndpoint,
      supportedVerifications: [
        'hardware',
        'operatingSystem',
        'sourceCode',
        'domainOwnership',
      ],
      usesGpuAttestation: false,
      implementsOwnDomain: true,
    }
  }

  /**
   * Retrieves ACME account information from the Gateway service.
   */
  public async getAcmeInfo(): Promise<AcmeInfo> {
    const response = await fetch(`${this.gatewayRpcEndpoint}/.dstack/acme-info`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ACME info from Gateway: ${response.status} ${response.statusText}`,
      )
    }
    return (await response.json()) as AcmeInfo
  }

  /**
   * Verifies that the ACME account key is controlled by the TEE.
   */
  public async verifyTeeControlledKey(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    return verifyTeeControlledKey(acmeInfo)
  }

  /**
   * Verifies that the TLS certificate matches the TEE-controlled public key.
   */
  public async verifyCertificateKey(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    return verifyCertificateKey(acmeInfo)
  }

  /**
   * Verifies domain control through DNS CAA records.
   */
  public async verifyDnsCAA(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    return verifyDnsCAA(acmeInfo.base_domain, acmeInfo.account_uri)
  }

  /**
   * Verifies complete TEE control over the domain through Certificate Transparency logs.
   */
  public async verifyCTLog(): Promise<CTResult> {
    const acmeInfo = await this.getAcmeInfo()
    const result = await verifyCTLog(acmeInfo)

    // Generate DataObjects for domain verification results
    const dataObjects =
      this.dataObjectGenerator.generateDomainVerificationDataObjects(
        result,
        acmeInfo,
      )
    dataObjects.forEach((obj) => this.createDataObject(obj))

    return result
  }
}
