import {createHash, X509Certificate} from 'node:crypto'
import path from 'node:path'
import {
  type AcmeInfo,
  type AppInfo,
  type AttestationBundle,
  type CTLogEntry,
  type CTVerificationResult,
  parseJsonFields,
  type QuoteAndEventLog,
} from './types'
import {verifyQuote} from './utils/dcap-qvl'
import {measureDstackImages} from './utils/dstack-mr'
import {DstackApp} from './utils/dstackContract'
import {calculate, getCollectedEvents, measure} from './utils/operations'
import {type OwnDomain, Verifier} from './verifier'

// Common fetch headers for external requests
const CHROME_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
} as const

export class GatewayVerifier extends Verifier implements OwnDomain {
  public registrySmartContract: DstackApp
  public gatewayRpc: string

  constructor(contractAddress: `0x${string}`, gatewayRpc: string) {
    super()

    this.registrySmartContract = new DstackApp(contractAddress)
    this.gatewayRpc = gatewayRpc
  }

  // Get quote and event log from TDX
  protected async getQuote(): Promise<QuoteAndEventLog> {
    const acmeInfo = await this.getAcmeInfo()
    const extendedQuote = JSON.parse(acmeInfo.account_quote)

    return {
      quote: `0x${extendedQuote.quote}` as const,
      eventlog: JSON.parse(extendedQuote.event_log),
    }
  }

  // Get both TDX and Nvidia attestation
  protected async getAttestation(): Promise<AttestationBundle | null> {
    // Gateway does not use GPU
    return null
  }

  protected async getAppInfo(): Promise<AppInfo> {
    const response = await fetch(`${this.gatewayRpc}/.dstack/app-info`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch app info: ${response.status} ${response.statusText}`,
      )
    }
    return parseJsonFields(await response.json(), {
      tcb_info: true,
      key_provider_info: true,
      vm_config: true,
    }) as AppInfo
  }

  // Verify TDX and Nvidia attestation signatures
  public async verifyHardware(): Promise<boolean> {
    const quote = await this.getQuote()
    const result = await verifyQuote(quote.quote, {hex: true})
    return result.status === 'UpToDate'
  }

  public async verifyOperatingSystem(): Promise<boolean> {
    const appInfo = await this.getAppInfo()

    const result = await measureDstackImages({
      image_folder: path.join(
        __dirname,
        '../external/dstack-images/dstack-0.5.3',
      ),
      vm_config: appInfo.vm_config,
    })

    return (
      result.mrtd === appInfo.tcb_info.mrtd &&
      result.rtmr0 === appInfo.tcb_info.rtmr0 &&
      result.rtmr1 === appInfo.tcb_info.rtmr1 &&
      result.rtmr2 === appInfo.tcb_info.rtmr2
    )
  }

  public async verifySourceCode(): Promise<boolean> {
    const appInfo = await this.getAppInfo()
    const quote = await this.getQuote()

    const appCompose = appInfo.tcb_info.app_compose
    const appComposeEvent = quote.eventlog.find(
      (value) => value.event === 'compose-hash',
    )

    const hash = calculate(
      'appInfo.tcb_info.app_compose',
      appCompose,
      'compose_hash',
      'sha256',
      () => createHash('sha256').update(appCompose).digest('hex'),
    )

    console.log(getCollectedEvents())

    return measure(
      appComposeEvent?.event_payload,
      hash,
      () => hash === appComposeEvent?.event_payload,
    )
  }

  public async getMetadata(): Promise<Record<string, unknown>> {
    return {}
  }

  // OwnDomain implementation
  protected async getAcmeInfo(): Promise<AcmeInfo> {
    const response = await fetch(`${this.gatewayRpc}/.dstack/acme-info`)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ACME info: ${response.status} ${response.statusText}`,
      )
    }
    return (await response.json()) as AcmeInfo
  }

  public async verifyTeeControlledKey(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    const accountUri = acmeInfo.account_uri
    const quote = acmeInfo.account_quote

    const extendedQuote = JSON.parse(quote)
    const result = await verifyQuote(`0x${extendedQuote.quote}`, {hex: true})

    if (result.status !== 'UpToDate') {
      return false
    }

    const reportData = result.report.TD10.report_data
    // Generate expected hash using SHA-512 with format "acme-account:<account_uri>"
    const expectedHash = createHash('sha512')
      .update('acme-account:')
      .update(accountUri)
      .digest('hex')

    return reportData === expectedHash
  }

  private parseCertificateChain(certChainPem: string): X509Certificate[] {
    const certRegex =
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
    const certificates: X509Certificate[] = []

    for (const match of certChainPem.matchAll(certRegex)) {
      try {
        certificates.push(new X509Certificate(match[0]))
      } catch (error) {
        console.error('Failed to parse certificate:', error)
      }
    }

    return certificates
  }

  private verifyCertificateChain(certificates: X509Certificate[]): boolean {
    if (certificates.length === 0) return false

    return certificates.every((cert, i) => {
      if (i === certificates.length - 1) return true // Skip last cert

      const issuerCert = certificates[i + 1]
      if (!issuerCert) return false

      try {
        return (
          cert.verify(issuerCert.publicKey) &&
          cert.issuer === issuerCert.subject
        )
      } catch (error) {
        console.error('Certificate chain verification error:', error)
        return false
      }
    })
  }

  private isRootCertificateTrusted(cert: X509Certificate): boolean {
    const trustedIssuers = [
      'C=US\nO=Internet Security Research Group\nCN=ISRG Root X1',
      'C=US\nO=Digital Signature Trust Co.\nCN=DST Root CA X3',
    ]

    try {
      // Check if it's a self-signed certificate (root CA)
      return cert.issuer === cert.subject
        ? cert.verify(cert.publicKey)
        : trustedIssuers.includes(cert.issuer)
    } catch (error) {
      console.error('Root certificate trust verification error:', error)
      return false
    }
  }

  public async verifyCertificateKey(): Promise<boolean> {
    const acmeInfo = await this.getAcmeInfo()
    const {active_cert: certificate, hist_keys} = acmeInfo
    const publicKey = hist_keys[0]

    if (!certificate || !publicKey) {
      console.error('Missing certificate or public key')
      return false
    }

    try {
      const certificates = this.parseCertificateChain(certificate)
      const leafCert = certificates[0]

      if (!leafCert) {
        console.error('No leaf certificate found')
        return false
      }

      // Verify certificate chain
      if (!this.verifyCertificateChain(certificates)) {
        console.error('Certificate chain verification failed')
        return false
      }

      // Verify root certificate trust (if chain has multiple certs)
      const rootCert = certificates[certificates.length - 1]
      if (
        certificates.length > 1 &&
        rootCert &&
        !this.isRootCertificateTrusted(rootCert)
      ) {
        console.error('Root certificate in chain is not trusted')
        return false
      }

      // Check certificate validity period
      const now = new Date()
      if (
        new Date(leafCert.validFrom) > now ||
        new Date(leafCert.validTo) < now
      ) {
        console.error('Certificate is not valid at current time')
        return false
      }

      // Compare public keys
      const leafCertPublicKey = leafCert.publicKey.export({
        type: 'spki',
        format: 'der',
      })
      const providedPublicKey = Buffer.from(publicKey, 'hex')

      return leafCertPublicKey.equals(providedPublicKey)
    } catch (error) {
      console.error('Certificate verification error:', error)
      return false
    }
  }

  public async verifyDnsCAA(): Promise<boolean> {
    const {base_domain: domain, account_uri: accountUri} =
      await this.getAcmeInfo()

    try {
      const response = await fetch(
        `https://dns.google/resolve?name=${domain}&type=CAA`,
      )
      const {Answer: records} = (await response.json()) as {
        Answer?: Array<{type: number; data?: string}>
      }

      const caaRecords = records?.filter((record) => record.type === 257) ?? []

      // For TEE domain verification, all CAA records must contain the account URI
      return (
        caaRecords.length > 0 &&
        caaRecords.every((record) => record.data?.includes(accountUri))
      )
    } catch (error) {
      console.error('DNS CAA verification error:', error)
      return false
    }
  }

  /**
   * Query Certificate Transparency logs to verify domain control by TEE
   */
  private async queryCTLogs(domain: string): Promise<CTLogEntry[]> {
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`

    try {
      const response = await fetch(url, {
        headers: {
          ...CHROME_HEADERS,
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      })

      if (!response.ok) {
        throw new Error(
          `CT Log query failed: ${response.status} ${response.statusText}`,
        )
      }

      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Error querying CT logs:', error)
      return []
    }
  }

  /**
   * Fetch actual certificate data from crt.sh using certificate ID
   */
  private async fetchCertificateById(certId: number): Promise<string | null> {
    const url = `https://crt.sh/?d=${certId}`

    try {
      const response = await fetch(url, {
        headers: {
          ...CHROME_HEADERS,
          Accept: 'text/plain, */*',
        },
      })

      if (!response.ok) {
        console.error(
          `Failed to fetch certificate ${certId}: ${response.status}`,
        )
        return null
      }

      return await response.text()
    } catch (error) {
      console.error(`Error fetching certificate ${certId}:`, error)
      return null
    }
  }

  /**
   * Extract public key from PEM certificate data
   */
  private extractPublicKeyFromCert(certPem: string): Buffer | null {
    try {
      const cert = new X509Certificate(certPem)
      return cert.publicKey.export({
        type: 'spki',
        format: 'der',
      })
    } catch (error) {
      console.error('Error extracting public key from certificate:', error)
      return null
    }
  }

  /**
   * Compare extracted public key with known TEE public keys
   */
  private compareTEEPublicKeys(
    extractedKey: Buffer,
    teePublicKeys: string[],
  ): boolean {
    const extractedKeyHex = extractedKey.toString('hex').toLowerCase()

    return teePublicKeys.some((teeKey) => {
      // Try direct hex comparison
      if (extractedKeyHex === teeKey.toLowerCase()) return true

      // Try buffer comparison for different formats
      try {
        return extractedKey.equals(Buffer.from(teeKey, 'hex'))
      } catch {
        return false
      }
    })
  }

  /**
   * Process a certificate to extract and verify its public key
   */
  private async processCertificate(cert: CTLogEntry, teeKeys: string[]) {
    const certPem = await this.fetchCertificateById(cert.id)
    if (!certPem) {
      console.warn(`Could not fetch certificate ${cert.id}`)
      return null
    }

    const publicKey = this.extractPublicKeyFromCert(certPem)
    if (!publicKey) {
      console.warn(`Could not extract public key from certificate ${cert.id}`)
      return null
    }

    const publicKeyHex = publicKey.toString('hex')
    const isTeeControlled = this.compareTEEPublicKeys(publicKey, teeKeys)

    console.log(
      `Certificate ${cert.id} is ${isTeeControlled ? '' : 'NOT '}TEE-controlled`,
    )

    return {publicKeyHex, isTeeControlled}
  }

  /**
   * Verify if domain certificates are controlled by TEE by checking public keys
   */
  public async verifyCTLog(): Promise<CTVerificationResult> {
    const {base_domain: domain, hist_keys: keys} = await this.getAcmeInfo()
    const certificates = await this.queryCTLogs(domain)

    let teeControlledCount = 0
    const publicKeysFound: string[] = []

    // Process each certificate
    for (const cert of certificates) {
      try {
        const result = await this.processCertificate(cert, keys)
        if (result) {
          publicKeysFound.push(result.publicKeyHex)
          if (result.isTeeControlled) teeControlledCount++
        }
      } catch (error) {
        console.error(`Error processing certificate ${cert.id}:`, error)
      }
    }

    // Sort certificates by date
    const sortedCerts = certificates.sort(
      (a, b) =>
        new Date(a.not_before).getTime() - new Date(b.not_before).getTime(),
    )

    return {
      domain,
      tee_controlled:
        teeControlledCount === certificates.length && certificates.length > 0,
      certificates,
      public_keys_found: publicKeysFound,
      verification_details: {
        certificates_checked: certificates.length,
        tee_certificates: teeControlledCount,
        non_tee_certificates: certificates.length - teeControlledCount,
        earliest_certificate: sortedCerts[0]?.not_before || null,
        latest_certificate:
          sortedCerts[sortedCerts.length - 1]?.not_before || null,
      },
    }
  }
}

console.log(
  await new GatewayVerifier(
    '0x39F2f3373CEcFf85BD8BBd985adeeF32547a302c',
    'https://gateway.llm-04.phala.network:9204/',
  ).verifyTeeControlledKey(),
)
