import {createHash, X509Certificate} from 'node:crypto'
import {safeParseQuoteExt} from '../schemas'
import type {AcmeInfo, CTLogEntry, CTResult} from '../types'
import {verifyQuote} from '../utils/dcap-qvl'

/** HTTP headers that mimic Chrome browser requests for external API calls */
const CHROME_USER_AGENT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
} as const

/**
 * Verifies that the ACME account key is controlled by the TEE.
 */
export async function verifyTeeControlledKey(
  acmeInfo: AcmeInfo,
): Promise<boolean> {
  const accountUri = acmeInfo.account_uri
  const accountQuote = acmeInfo.account_quote

  const extendedQuoteData = safeParseQuoteExt(accountQuote)
  const verificationResult = await verifyQuote(`0x${extendedQuoteData.quote}`, {
    hex: true,
  })

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
 * Verifies certificate chain integrity and trust.
 */
export function verifyCertificateKey(acmeInfo: AcmeInfo): boolean {
  const {active_cert: activeCertificate, hist_keys: historicalKeys} = acmeInfo
  const teePublicKey = historicalKeys[0]

  if (!activeCertificate || !teePublicKey) {
    return false
  }

  try {
    const certificateChain = parseCertificateChain(activeCertificate)
    const leafCertificate = certificateChain[0]

    if (!leafCertificate) {
      return false
    }

    // Verify certificate chain integrity
    if (!verifyCertificateChain(certificateChain)) {
      return false
    }

    // Verify root certificate trust
    const rootCertificate = certificateChain[certificateChain.length - 1]
    if (
      certificateChain.length > 1 &&
      rootCertificate &&
      !isRootCertificateTrusted(rootCertificate)
    ) {
      return false
    }

    // Check certificate validity period
    const currentTime = new Date()
    if (
      new Date(leafCertificate.validFrom) > currentTime ||
      new Date(leafCertificate.validTo) < currentTime
    ) {
      return false
    }

    // Compare public keys
    const leafCertificatePublicKey = leafCertificate.publicKey.export({
      type: 'spki',
      format: 'der',
    })
    const teePublicKeyBuffer = Buffer.from(teePublicKey, 'hex')

    return leafCertificatePublicKey.equals(teePublicKeyBuffer)
  } catch (error) {
    console.error('Certificate verification error:', error)
    return false
  }
}

/**
 * Verifies DNS CAA records for domain control.
 */
export async function verifyDnsCAA(
  domainName: string,
  acmeAccountUri: string,
): Promise<boolean> {
  try {
    const dnsResponse = await fetch(
      `https://dns.google/resolve?name=${domainName}&type=CAA`,
    )
    const {Answer: dnsRecords} = (await dnsResponse.json()) as {
      Answer?: Array<{type: number; data?: string}>
    }

    const caaRecords = dnsRecords?.filter((record) => record.type === 257) ?? []

    return (
      caaRecords.length > 0 &&
      caaRecords.every((record) => record.data?.includes(acmeAccountUri))
    )
  } catch (error) {
    console.error('DNS CAA verification error:', error)
    return false
  }
}

/**
 * Verifies complete TEE control through Certificate Transparency logs.
 */
export async function verifyCTLog(acmeInfo: AcmeInfo): Promise<CTResult> {
  const {base_domain: domainName, hist_keys: teePublicKeys} = acmeInfo
  const certificateHistory = await queryCTLogs(domainName)

  let teeControlledCertificateCount = 0
  const discoveredPublicKeys: string[] = []

  for (const certificateEntry of certificateHistory) {
    try {
      const processingResult = await processCertificate(
        certificateEntry,
        teePublicKeys,
      )
      if (processingResult) {
        discoveredPublicKeys.push(processingResult.publicKeyHex)
        if (processingResult.isTeeControlled) {
          teeControlledCertificateCount++
        }
      }
    } catch (error) {
      console.error(
        `Error processing certificate ${certificateEntry.id}:`,
        error,
      )
    }
  }

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

// Helper functions

function parseCertificateChain(certChainPem: string): X509Certificate[] {
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

function verifyCertificateChain(certificates: X509Certificate[]): boolean {
  if (certificates.length === 0) return false

  return certificates.every((certificate, index) => {
    if (index === certificates.length - 1) return true

    const issuerCertificate = certificates[index + 1]
    if (!issuerCertificate) return false

    try {
      return (
        certificate.verify(issuerCertificate.publicKey) &&
        certificate.issuer === issuerCertificate.subject
      )
    } catch (error) {
      console.error('Certificate chain verification error:', error)
      return false
    }
  })
}

function isRootCertificateTrusted(rootCertificate: X509Certificate): boolean {
  const trustedRootCaIssuers = [
    'C=US\nO=Internet Security Research Group\nCN=ISRG Root X1',
    'C=US\nO=Digital Signature Trust Co.\nCN=DST Root CA X3',
  ]

  try {
    return rootCertificate.issuer === rootCertificate.subject
      ? rootCertificate.verify(rootCertificate.publicKey)
      : trustedRootCaIssuers.includes(rootCertificate.issuer)
  } catch (error) {
    console.error('Root certificate trust verification error:', error)
    return false
  }
}

async function queryCTLogs(domainName: string): Promise<CTLogEntry[]> {
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
  } catch (error) {
    console.error('Error querying Certificate Transparency logs:', error)
    return []
  }
}

async function processCertificate(
  certificateEntry: CTLogEntry,
  teeControlledKeys: string[],
): Promise<{publicKeyHex: string; isTeeControlled: boolean} | null> {
  const certificatePem = await fetchCertificateById(certificateEntry.id)
  if (!certificatePem) {
    return null
  }

  const extractedPublicKey = extractPublicKeyFromCert(certificatePem)
  if (!extractedPublicKey) {
    return null
  }

  const publicKeyHex = extractedPublicKey.toString('hex')
  const isTeeControlled = compareTEEPublicKeys(
    extractedPublicKey,
    teeControlledKeys,
  )

  return {publicKeyHex, isTeeControlled}
}

async function fetchCertificateById(
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
      return null
    }

    return await response.text()
  } catch (error) {
    console.error(`Error fetching certificate ${certificateId}:`, error)
    return null
  }
}

function extractPublicKeyFromCert(certificatePem: string): Buffer | null {
  try {
    const certificate = new X509Certificate(certificatePem)
    return certificate.publicKey.export({
      type: 'spki',
      format: 'der',
    })
  } catch (error) {
    console.error('Error extracting public key from certificate:', error)
    return null
  }
}

function compareTEEPublicKeys(
  extractedPublicKey: Buffer,
  teeControlledKeys: string[],
): boolean {
  const extractedKeyHex = extractedPublicKey.toString('hex').toLowerCase()

  return teeControlledKeys.some((teeKey) => {
    if (extractedKeyHex === teeKey.toLowerCase()) return true

    try {
      return extractedPublicKey.equals(Buffer.from(teeKey, 'hex'))
    } catch {
      return false
    }
  })
}
