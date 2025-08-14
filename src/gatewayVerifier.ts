import {createHash, X509Certificate} from 'node:crypto'
import path from 'node:path'
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
  type CTLogEntry,
  type CTResult,
  parseJsonFields,
  type QuoteData,
} from './types'
import {verifyQuote} from './utils/dcap-qvl'
import {measureDstackImages} from './utils/dstack-mr'
import {DstackApp} from './utils/dstackContract'
import {calculate, getCollectedEvents, measure} from './utils/operations'
import {type OwnDomain, Verifier} from './verifier'

/** HTTP headers that mimic Chrome browser requests for external API calls */
const CHROME_USER_AGENT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
} as const

/**
 * Gateway verifier implementation for DStack TEE applications with domain verification.
 *
 * This verifier extends the base Verifier class and implements the OwnDomain interface
 * to provide comprehensive verification of Gateway services including TEE-controlled
 * domain ownership through ACME certificates and Certificate Transparency logs.
 */
export class GatewayVerifier extends Verifier implements OwnDomain {
  /** Smart contract interface for retrieving Gateway application data */
  public registrySmartContract: DstackApp
  /** RPC endpoint URL for the Gateway service */
  public gatewayRpcEndpoint: string

  /**
   * Creates a new Gateway verifier instance.
   *
   * @param contractAddress - Ethereum address of the DStack App registry contract
   * @param gatewayRpcEndpoint - HTTP(S) URL of the Gateway RPC endpoint
   */
  constructor(contractAddress: `0x${string}`, gatewayRpcEndpoint: string) {
    super()
    this.registrySmartContract = new DstackApp(contractAddress)
    this.gatewayRpcEndpoint = gatewayRpcEndpoint
  }

  /**
   * Retrieves the TEE quote and event log from ACME account information.
   *
   * The Gateway service stores its quote within the ACME account data.
   *
   * @returns Promise resolving to the quote and parsed event log
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
   *
   * Gateway services typically do not require GPU attestation.
   *
   * @returns Promise resolving to null as Gateway doesn't use GPU attestation
   */
  protected async getAttestation(): Promise<AttestationBundle | null> {
    return null
  }

  /**
   * Retrieves application information from the Gateway RPC endpoint.
   *
   * Fetches app info from the DStack endpoint and parses JSON fields.
   *
   * @returns Promise resolving to parsed application information
   * @throws Error if the RPC request fails
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

    const isRegistered =
      await this.registrySmartContract.isComposeHashRegistered(
        `0x${composeHashEvent.event_payload}`,
      )

    const calculatedHash = calculate(
      'appInfo.tcb_info.app_compose',
      appComposeConfig,
      'compose_hash',
      'sha256',
      () => createHash('sha256').update(appComposeConfig).digest('hex'),
    )

    console.log(getCollectedEvents())

    return (
      isRegistered &&
      measure(
        composeHashEvent?.event_payload,
        calculatedHash,
        () => calculatedHash === composeHashEvent?.event_payload,
      )
    )
  }

  /**
   * Retrieves metadata about the Gateway verification process and results.
   *
   * @returns Promise resolving to verification metadata including endpoint and capabilities
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
   *
   * This includes historical keys, certificates, and account details needed
   * for domain ownership verification.
   *
   * @returns Promise resolving to ACME account information
   * @throws Error if the RPC request fails
   */
  protected async getAcmeInfo(): Promise<AcmeInfo> {
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
   *
   * This method validates that the private key used for ACME account operations
   * is generated and stored within the TEE by checking the quote report data
   * against the expected ACME account URI hash.
   *
   * @returns Promise resolving to true if the key is TEE-controlled
   */
  public async verifyTeeControlledKey(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    const accountUri = acmeInfo.account_uri
    const accountQuote = acmeInfo.account_quote

    const extendedQuoteData = safeParseQuoteExt(accountQuote)
    const verificationResult = await verifyQuote(
      `0x${extendedQuoteData.quote}`,
      {hex: true},
    )

    if (verificationResult.status !== 'UpToDate') {
      return false
    }

    const reportData = verificationResult.report.TD10.report_data
    const expectedAccountHash = createHash('sha512')
      .update('acme-account:')
      .update(accountUri)
      .digest('hex')

    return reportData === expectedAccountHash
  }

  /**
   * Parses a PEM certificate chain into individual X.509 certificate objects.
   *
   * @param certChainPem - PEM-encoded certificate chain string
   * @returns Array of parsed X509Certificate objects
   */
  private parseCertificateChain(certChainPem: string): X509Certificate[] {
    const pemCertificateRegex =
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
    const parsedCertificates: X509Certificate[] = []

    for (const certificateMatch of certChainPem.matchAll(pemCertificateRegex)) {
      try {
        parsedCertificates.push(new X509Certificate(certificateMatch[0]))
      } catch (parseError) {
        console.error('Failed to parse certificate from PEM:', parseError)
      }
    }

    return parsedCertificates
  }

  /**
   * Verifies the integrity of a certificate chain.
   *
   * Validates that each certificate is properly signed by its issuer and that
   * the issuer/subject relationships are correct throughout the chain.
   *
   * @param certificates - Array of certificates in the chain (leaf to root)
   * @returns True if the certificate chain is valid
   */
  private verifyCertificateChain(certificates: X509Certificate[]): boolean {
    if (certificates.length === 0) return false

    return certificates.every((certificate, index) => {
      if (index === certificates.length - 1) return true // Skip root certificate

      const issuerCertificate = certificates[index + 1]
      if (!issuerCertificate) return false

      try {
        return (
          certificate.verify(issuerCertificate.publicKey) &&
          certificate.issuer === issuerCertificate.subject
        )
      } catch (verificationError) {
        console.error(
          'Certificate chain verification error:',
          verificationError,
        )
        return false
      }
    })
  }

  /**
   * Verifies if a root certificate is from a trusted Certificate Authority.
   *
   * Checks against known trusted root CAs (Let's Encrypt roots) and validates
   * self-signed root certificates.
   *
   * @param rootCertificate - The root certificate to verify
   * @returns True if the root certificate is trusted
   */
  private isRootCertificateTrusted(rootCertificate: X509Certificate): boolean {
    const trustedRootCaIssuers = [
      'C=US\nO=Internet Security Research Group\nCN=ISRG Root X1',
      'C=US\nO=Digital Signature Trust Co.\nCN=DST Root CA X3',
    ]

    try {
      // For self-signed certificates (root CAs), verify the signature
      return rootCertificate.issuer === rootCertificate.subject
        ? rootCertificate.verify(rootCertificate.publicKey)
        : trustedRootCaIssuers.includes(rootCertificate.issuer)
    } catch (trustVerificationError) {
      console.error(
        'Root certificate trust verification error:',
        trustVerificationError,
      )
      return false
    }
  }

  /**
   * Verifies that the TLS certificate matches the TEE-controlled public key.
   *
   * This method validates the complete certificate chain, checks the certificate
   * validity period, and ensures the leaf certificate's public key matches the
   * TEE-controlled key from the ACME account.
   *
   * @returns Promise resolving to true if certificate key matches TEE key
   */
  public async verifyCertificateKey(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    const {active_cert: activeCertificate, hist_keys: historicalKeys} = acmeInfo
    const teePublicKey = historicalKeys[0]

    if (!activeCertificate || !teePublicKey) {
      console.error('Missing active certificate or TEE public key')
      return false
    }

    try {
      const certificateChain = this.parseCertificateChain(activeCertificate)
      const leafCertificate = certificateChain[0]

      if (!leafCertificate) {
        console.error('No leaf certificate found in chain')
        return false
      }

      // Verify certificate chain integrity
      if (!this.verifyCertificateChain(certificateChain)) {
        console.error('Certificate chain verification failed')
        return false
      }

      // Verify root certificate trust (if chain has multiple certificates)
      const rootCertificate = certificateChain[certificateChain.length - 1]
      if (
        certificateChain.length > 1 &&
        rootCertificate &&
        !this.isRootCertificateTrusted(rootCertificate)
      ) {
        console.error('Root certificate in chain is not trusted')
        return false
      }

      // Check certificate validity period
      const currentTime = new Date()
      if (
        new Date(leafCertificate.validFrom) > currentTime ||
        new Date(leafCertificate.validTo) < currentTime
      ) {
        console.error('Certificate is not valid at current time')
        return false
      }

      // Compare public keys
      const leafCertificatePublicKey = leafCertificate.publicKey.export({
        type: 'spki',
        format: 'der',
      })
      const teePublicKeyBuffer = Buffer.from(teePublicKey, 'hex')

      return leafCertificatePublicKey.equals(teePublicKeyBuffer)
    } catch (certificateError) {
      console.error('Certificate verification error:', certificateError)
      return false
    }
  }

  /**
   * Verifies domain control through DNS CAA (Certificate Authority Authorization) records.
   *
   * This method checks that DNS CAA records are properly configured to restrict
   * certificate issuance to the specific ACME account controlled by the TEE.
   *
   * @returns Promise resolving to true if DNS CAA records properly restrict certificate issuance
   */
  public async verifyDnsCAA(): Promise<boolean> {
    const {base_domain: domainName, account_uri: acmeAccountUri} =
      await this.getAcmeInfo()

    try {
      const dnsResponse = await fetch(
        `https://dns.google/resolve?name=${domainName}&type=CAA`,
      )
      const {Answer: dnsRecords} = (await dnsResponse.json()) as {
        Answer?: Array<{type: number; data?: string}>
      }

      const caaRecords =
        dnsRecords?.filter((record) => record.type === 257) ?? []

      // For TEE domain verification, all CAA records must reference the specific ACME account
      return (
        caaRecords.length > 0 &&
        caaRecords.every((record) => record.data?.includes(acmeAccountUri))
      )
    } catch (dnsError) {
      console.error('DNS CAA verification error:', dnsError)
      return false
    }
  }

  /**
   * Queries Certificate Transparency logs to retrieve certificate history for a domain.
   *
   * Uses the crt.sh service to fetch all certificates issued for the specified domain.
   *
   * @param domainName - The domain name to query certificates for
   * @returns Promise resolving to array of certificate log entries
   */
  private async queryCTLogs(domainName: string): Promise<CTLogEntry[]> {
    const ctLogQueryUrl = `https://crt.sh/?q=${encodeURIComponent(domainName)}&output=json`

    try {
      const response = await fetch(ctLogQueryUrl, {
        headers: {
          ...CHROME_USER_AGENT_HEADERS,
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      })

      if (!response.ok) {
        throw new Error(
          `CT Log query failed: ${response.status} ${response.statusText}`,
        )
      }

      const certificateData = await response.json()
      return Array.isArray(certificateData) ? certificateData : []
    } catch (queryError) {
      console.error('Error querying Certificate Transparency logs:', queryError)
      return []
    }
  }

  /**
   * Fetches the actual certificate data from crt.sh using the certificate ID.
   *
   * @param certificateId - The unique certificate ID from crt.sh
   * @returns Promise resolving to PEM certificate data or null if failed
   */
  private async fetchCertificateById(
    certificateId: number,
  ): Promise<string | null> {
    const certificateUrl = `https://crt.sh/?d=${certificateId}`

    try {
      const response = await fetch(certificateUrl, {
        headers: {
          ...CHROME_USER_AGENT_HEADERS,
          Accept: 'text/plain, */*',
        },
      })

      if (!response.ok) {
        console.error(
          `Failed to fetch certificate ${certificateId}: ${response.status}`,
        )
        return null
      }

      return await response.text()
    } catch (fetchError) {
      console.error(`Error fetching certificate ${certificateId}:`, fetchError)
      return null
    }
  }

  /**
   * Extracts the public key from a PEM-encoded certificate.
   *
   * @param certificatePem - PEM-encoded certificate string
   * @returns Buffer containing the public key in DER format, or null if failed
   */
  private extractPublicKeyFromCert(certificatePem: string): Buffer | null {
    try {
      const certificate = new X509Certificate(certificatePem)
      return certificate.publicKey.export({
        type: 'spki',
        format: 'der',
      })
    } catch (extractionError) {
      console.error(
        'Error extracting public key from certificate:',
        extractionError,
      )
      return null
    }
  }

  /**
   * Compares an extracted public key with known TEE-controlled public keys.
   *
   * @param extractedPublicKey - The public key extracted from a certificate
   * @param teeControlledKeys - Array of known TEE-controlled public keys (hex strings)
   * @returns True if the extracted key matches any TEE-controlled key
   */
  private compareTEEPublicKeys(
    extractedPublicKey: Buffer,
    teeControlledKeys: string[],
  ): boolean {
    const extractedKeyHex = extractedPublicKey.toString('hex').toLowerCase()

    return teeControlledKeys.some((teeKey) => {
      // Try direct hex string comparison
      if (extractedKeyHex === teeKey.toLowerCase()) return true

      // Try buffer comparison for different key formats
      try {
        return extractedPublicKey.equals(Buffer.from(teeKey, 'hex'))
      } catch {
        return false
      }
    })
  }

  /**
   * Processes a certificate from CT logs to extract and verify its public key.
   *
   * @param certificateEntry - Certificate entry from CT logs
   * @param teeControlledKeys - Array of known TEE-controlled public keys
   * @returns Object with public key hex and TEE control status, or null if processing failed
   */
  private async processCertificate(
    certificateEntry: CTLogEntry,
    teeControlledKeys: string[],
  ): Promise<{publicKeyHex: string; isTeeControlled: boolean} | null> {
    const certificatePem = await this.fetchCertificateById(certificateEntry.id)
    if (!certificatePem) {
      console.warn(`Could not fetch certificate ${certificateEntry.id}`)
      return null
    }

    const extractedPublicKey = this.extractPublicKeyFromCert(certificatePem)
    if (!extractedPublicKey) {
      console.warn(
        `Could not extract public key from certificate ${certificateEntry.id}`,
      )
      return null
    }

    const publicKeyHex = extractedPublicKey.toString('hex')
    const isTeeControlled = this.compareTEEPublicKeys(
      extractedPublicKey,
      teeControlledKeys,
    )

    console.log(
      `Certificate ${certificateEntry.id} is ${isTeeControlled ? '' : 'NOT '}TEE-controlled`,
    )

    return {publicKeyHex, isTeeControlled}
  }

  /**
   * Verifies complete TEE control over the domain through Certificate Transparency logs.
   *
   * This method analyzes all historical certificates for the domain to ensure they
   * were all issued using TEE-controlled keys, providing evidence that the domain
   * has always been under exclusive TEE control.
   *
   * @returns Promise resolving to detailed CT log verification results
   */
  public async verifyCTLog(): Promise<CTResult> {
    const {base_domain: domainName, hist_keys: teePublicKeys} =
      await this.getAcmeInfo()
    const certificateHistory = await this.queryCTLogs(domainName)

    let teeControlledCertificateCount = 0
    const discoveredPublicKeys: string[] = []

    // Process each certificate from the CT logs
    for (const certificateEntry of certificateHistory) {
      try {
        const processingResult = await this.processCertificate(
          certificateEntry,
          teePublicKeys,
        )
        if (processingResult) {
          discoveredPublicKeys.push(processingResult.publicKeyHex)
          if (processingResult.isTeeControlled) {
            teeControlledCertificateCount++
          }
        }
      } catch (processingError) {
        console.error(
          `Error processing certificate ${certificateEntry.id}:`,
          processingError,
        )
      }
    }

    // Sort certificates chronologically
    const chronologicalCertificates = certificateHistory.sort(
      (a, b) =>
        new Date(a.not_before).getTime() - new Date(b.not_before).getTime(),
    )

    return {
      domain: domainName,
      tee_controlled:
        teeControlledCertificateCount === certificateHistory.length &&
        certificateHistory.length > 0,
      certificates: certificateHistory,
      public_keys_found: discoveredPublicKeys,
      verification_details: {
        certificates_checked: certificateHistory.length,
        tee_certificates: teeControlledCertificateCount,
        non_tee_certificates:
          certificateHistory.length - teeControlledCertificateCount,
        earliest_certificate: chronologicalCertificates[0]?.not_before || null,
        latest_certificate:
          chronologicalCertificates[chronologicalCertificates.length - 1]
            ?.not_before || null,
      },
    }
  }
}
