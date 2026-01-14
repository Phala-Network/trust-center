import {GatewayDataObjectGenerator} from '../dataObjects/gatewayDataObjectGenerator'
import {
  KeyProviderSchema,
  safeParseEventLog,
  safeParseQuoteExt,
  TcbInfoSchema,
  VmConfigSchema,
} from '../schemas'
import {
  type AcmeInfo,
  type AppInfo,
  type AttestationBundle,
  convertGuestAgentInfoToAppInfo,
  type CTResult,
  type GatewayMetadata,
  parseJsonFields,
  type QuoteData,
  type SystemInfo,
  toContractAddress,
  type VerificationFailure,
} from '../types'
import type {DataObjectCollector} from '../utils/dataObjectCollector'
import {DstackApp} from '../utils/dstackContract'
import {
  verifyCertificateKey,
  verifyCTLog,
  verifyDnsCAA,
  verifyTeeControlledKey,
} from '../verification/domainVerification'
import {isUpToDate, verifyTeeQuote} from '../verification/hardwareVerification'
import {verifyOSIntegrity} from '../verification/osVerification'
import {verifyComposeHash} from '../verification/sourceCodeVerification'
import {type OwnDomain, Verifier} from '../verifier'

/**
 * Gateway verifier implementation for DStack TEE applications with domain verification.
 */
export class GatewayVerifier extends Verifier implements OwnDomain {
  /** Smart contract interface for retrieving Gateway application data */
  public registrySmartContract?: DstackApp
  /** RPC endpoint URL for the Gateway service */
  public rpcEndpoint: string
  /** Data object generator for Gateway-specific objects */
  private dataObjectGenerator: GatewayDataObjectGenerator
  /** System information for this Gateway instance */
  protected systemInfo: SystemInfo

  /**
   * Creates a new Gateway verifier instance.
   */
  constructor(
    metadata: GatewayMetadata,
    systemInfo: SystemInfo,
    collector: DataObjectCollector,
  ) {
    super(metadata, 'gateway', collector)

    // Only create smart contract if governance is OnChain
    if (metadata.governance?.type === 'OnChain') {
      if (!systemInfo.kms_info.gateway_app_id) {
        throw new Error(
          'Gateway application ID is required for on-chain governance',
        )
      }
      this.registrySmartContract = new DstackApp(
        toContractAddress(systemInfo.kms_info.gateway_app_id),
        metadata.governance.chainId,
      )
    }

    this.rpcEndpoint = systemInfo.kms_info.gateway_app_url
    this.dataObjectGenerator = new GatewayDataObjectGenerator(metadata)
    this.systemInfo = systemInfo
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
   * Retrieves application information from gateway_guest_agent_info or the Gateway RPC endpoint.
   */
  protected async getAppInfo(): Promise<AppInfo> {
    // Use gateway_guest_agent_info from SystemInfo if available (avoids extra request)
    if (this.systemInfo.gateway_guest_agent_info) {
      return convertGuestAgentInfoToAppInfo(this.systemInfo.gateway_guest_agent_info)
    }

    // Fallback to fetching from Gateway RPC endpoint
    const appInfoUrl = `${this.rpcEndpoint}/.dstack/app-info`
    try {
      const response = await fetch(appInfoUrl)
      if (!response.ok) {
        throw new Error(
          `Gateway app-info request failed: ${response.status} ${response.statusText} (URL: ${appInfoUrl})`,
        )
      }

      const responseData = await response.json()
      return parseJsonFields(responseData as Record<string, unknown>, {
        tcb_info: TcbInfoSchema,
        key_provider_info: KeyProviderSchema,
        vm_config: VmConfigSchema,
      }) as AppInfo
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error fetching Gateway app info from ${appInfoUrl}`
      throw new Error(`Failed to fetch Gateway app info: ${errorMessage}`)
    }
  }

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

    // Generate DataObjects for Gateway hardware verification
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
        componentId: 'gateway-main',
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
    const version = extractVersionNumber(this.systemInfo.kms_info.version)
    const imageFolderName = `dstack-${version}`

    // Ensure image is downloaded
    await ensureDstackImage(imageFolderName)

    const isValid = await verifyOSIntegrity(appInfo, imageFolderName)

    // Generate DataObjects for Gateway OS verification
    const dataObjects = this.dataObjectGenerator.generateOSDataObjects(appInfo)
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    if (!isValid) {
      failures.push({
        componentId: 'gateway-main',
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
      this.registrySmartContract?.address ?? '0x',
      this.rpcEndpoint,
      acmeInfo.active_cert,
    )
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    if (!isValid) {
      if (this.registrySmartContract && !isRegistered) {
        failures.push({
          componentId: 'gateway-main',
          error:
            'Source code verification failed: Compose hash is not registered in the on-chain registry',
        })
      } else {
        failures.push({
          componentId: 'gateway-main',
          error:
            'Source code verification failed: Calculated compose hash does not match the hash in RTMR3 event log',
        })
      }
    }

    return {isValid, failures}
  }

  /**
   * Retrieves ACME account information from the Gateway service.
   */
  public async getAcmeInfo(): Promise<AcmeInfo> {
    const acmeInfoUrl = `${this.rpcEndpoint}/.dstack/acme-info`
    try {
      const response = await fetch(acmeInfoUrl)
      if (!response.ok) {
        throw new Error(
          `Gateway ACME info request failed: ${response.status} ${response.statusText} (URL: ${acmeInfoUrl})`,
        )
      }
      return (await response.json()) as AcmeInfo
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown error fetching ACME info from ${acmeInfoUrl}`
      throw new Error(`Failed to fetch ACME info from Gateway: ${errorMessage}`)
    }
  }

  /**
   * Verifies that the ACME account key is controlled by the TEE.
   */
  public async verifyTeeControlledKey(): Promise<{
    isValid: boolean
    error?: string
  }> {
    const acmeInfo = await this.getAcmeInfo()
    return verifyTeeControlledKey(acmeInfo)
  }

  /**
   * Verifies that the TLS certificate matches the TEE-controlled public key.
   */
  public async verifyCertificateKey(): Promise<{
    isValid: boolean
    error?: string
  }> {
    const acmeInfo = await this.getAcmeInfo()
    return verifyCertificateKey(acmeInfo)
  }

  /**
   * Verifies domain control through DNS CAA records.
   */
  public async verifyDnsCAA(): Promise<{isValid: boolean; error?: string}> {
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
    dataObjects.forEach((obj) => {
      this.createDataObject(obj)
    })

    return result
  }
}
