import {GatewayDataObjectGenerator} from '../dataObjects/gatewayDataObjectGenerator'
import {
  AcmeInfoSchema,
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
import {fetchDstack} from '../utils/fetchInsecure'
import {DstackApp} from '../utils/dstackContract'
import {
  verifyCertificateKey,
  verifyCTLog,
  verifyDnsCAA,
  verifyTeeControlledKey,
} from '../verification/domainVerification'
import {
  isUpToDate,
  verifyTeeQuote,
} from '../verification/hardwareVerification'
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
  /** Cached quote data from hardware verification, used for deferred ITA */
  public lastQuoteHex: string | null = null
  /** Cached ACME info to avoid redundant HTTP calls within a single verification run */
  private cachedAcmeInfo: AcmeInfo | null = null
  /** Base domain for DNS CAA and CT log verification (from app config, not ACME) */
  private baseDomain: string

  /**
   * Creates a new Gateway verifier instance.
   */
  constructor(
    metadata: GatewayMetadata,
    systemInfo: SystemInfo,
    collector: DataObjectCollector,
    baseDomain: string,
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
    this.baseDomain = baseDomain
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
      return convertGuestAgentInfoToAppInfo(
        this.systemInfo.gateway_guest_agent_info,
      )
    }

    // Fallback to fetching from Gateway RPC endpoint
    const appInfoUrl = `${this.rpcEndpoint}/.dstack/app-info`
    try {
      const response = await fetchDstack(appInfoUrl)
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
   * ITA verification is deferred to executeVerifiers final step.
   */
  public async verifyHardware(): Promise<{
    isValid: boolean
    failures: VerificationFailure[]
  }> {
    const quoteData = await this.getQuote()
    const verificationResult = await verifyTeeQuote(quoteData)
    const failures: VerificationFailure[] = []

    // Save quote hex for deferred ITA verification
    this.lastQuoteHex = quoteData.quote

    // Generate DataObjects for Gateway hardware verification (ITA result added later)
    const dataObjects = this.dataObjectGenerator.generateHardwareDataObjects(
      quoteData,
      verificationResult,
      null,
    )
    dataObjects.forEach(obj => {
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
    dataObjects.forEach(obj => {
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
    // Use app_cert from app-info as active certificate (new gateways removed it from ACME)
    const dataObjects = this.dataObjectGenerator.generateSourceCodeDataObjects(
      appInfo,
      quoteData,
      calculatedHash,
      isRegistered ?? false,
      this.registrySmartContract?.address ?? '0x',
      this.rpcEndpoint,
      appInfo.app_cert,
    )
    dataObjects.forEach(obj => {
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
    if (this.cachedAcmeInfo) {
      return this.cachedAcmeInfo
    }

    const acmeInfoUrl = `${this.rpcEndpoint}/.dstack/acme-info`
    try {
      const response = await fetchDstack(acmeInfoUrl)
      if (!response.ok) {
        throw new Error(
          `Gateway ACME info request failed: ${response.status} ${response.statusText} (URL: ${acmeInfoUrl})`,
        )
      }
      const data = await response.json()
      const parsed = AcmeInfoSchema.safeParse(data)
      if (!parsed.success) {
        throw new Error(
          `Invalid ACME info response: ${parsed.error.message}`,
        )
      }
      this.cachedAcmeInfo = parsed.data as AcmeInfo
      return this.cachedAcmeInfo
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
   * Uses active_cert from ACME (legacy) or fetches the certificate directly
   * from the gateway's TLS handshake (new gateways).
   */
  public async verifyCertificateKey(): Promise<{
    isValid: boolean
    error?: string
  }> {
    const acmeInfo = await this.getAcmeInfo()
    if (!acmeInfo.active_cert) {
      const tlsCert = await this.fetchTlsCertificate()
      return verifyCertificateKey({...acmeInfo, active_cert: tlsCert})
    }
    return verifyCertificateKey(acmeInfo)
  }

  /**
   * Fetches the TLS certificate chain directly from the gateway's HTTPS endpoint.
   * This is the actual certificate users see when connecting to the gateway.
   */
  private async fetchTlsCertificate(): Promise<string> {
    const {connect} = await import('node:tls')
    const url = new URL(this.rpcEndpoint)
    const host = url.hostname
    const port = Number(url.port) || 443

    return new Promise<string>((resolve, reject) => {
      const socket = connect(
        {host, port, servername: host, rejectUnauthorized: false},
        () => {
          const cert = socket.getPeerCertificate(true)
          if (!cert || !cert.raw) {
            socket.destroy()
            reject(new Error(`No TLS certificate from ${host}:${port}`))
            return
          }

          // Build PEM chain from the peer certificate and its issuer chain
          const pems: string[] = []
          let current: typeof cert | undefined = cert
          const seen = new Set<string>()
          while (current?.raw) {
            const fingerprint = current.fingerprint256
            if (seen.has(fingerprint)) break
            seen.add(fingerprint)
            const b64 = current.raw.toString('base64')
            const lines = b64.match(/.{1,64}/g) || []
            pems.push(
              `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`,
            )
            current = current.issuerCertificate as typeof cert | undefined
          }

          socket.destroy()
          resolve(pems.join('\n'))
        },
      )
      socket.on('error', (err) => reject(new Error(`TLS connection to ${host}:${port} failed: ${err.message}`)))
      socket.setTimeout(10_000, () => {
        socket.destroy()
        reject(new Error(`TLS connection to ${host}:${port} timed out`))
      })
    })
  }

  /**
   * Verifies domain control through DNS CAA records.
   * Uses baseDomain from app config (passed at construction).
   */
  public async verifyDnsCAA(): Promise<{isValid: boolean; error?: string}> {
    const acmeInfo = await this.getAcmeInfo()
    return verifyDnsCAA(this.baseDomain, acmeInfo.account_uri)
  }

  /**
   * Verifies complete TEE control over the domain through Certificate Transparency logs.
   * Uses baseDomain from app config (passed at construction).
   */
  public async verifyCTLog(): Promise<CTResult> {
    const acmeInfo = await this.getAcmeInfo()
    const enrichedAcmeInfo = {...acmeInfo, base_domain: this.baseDomain}
    const result = await verifyCTLog(enrichedAcmeInfo)

    // Generate DataObjects for domain verification results
    const dataObjects =
      this.dataObjectGenerator.generateDomainVerificationDataObjects(
        result,
        acmeInfo,
      )
    dataObjects.forEach(obj => {
      this.createDataObject(obj)
    })

    return result
  }
}
