import { createHash, X509Certificate } from 'node:crypto'
import { safeParseQuoteExt } from '../schemas'
import type { AcmeInfo, CTLogEntry, CTResult } from '../types'
import { verifyQuote } from '../utils/dcap-qvl'

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

  if (!accountUri) {
    throw new Error(
      'TEE controlled key verification failed: No ACME account URI provided',
    )
  }

  if (!accountQuote) {
    throw new Error(
      'TEE controlled key verification failed: No account quote provided',
    )
  }

  try {
    const extendedQuoteData = safeParseQuoteExt(accountQuote)
    const verificationResult = await verifyQuote(
      `0x${extendedQuoteData.quote}`,
      {
        hex: true,
      },
    )

    if (verificationResult.status !== 'UpToDate') {
      throw new Error(
        `TEE controlled key verification failed: Quote verification status is '${verificationResult.status}', expected 'UpToDate'`,
      )
    }

    const reportData = verificationResult.report.TD10.report_data
    const expectedAccountHash = createHash('sha512')
      .update('acme-account:')
      .update(accountUri)
      .digest('hex')

    if (reportData !== expectedAccountHash) {
      throw new Error(
        `TEE controlled key verification failed: Report data mismatch. Expected hash for account '${accountUri}' but got different report data`,
      )
    }

    return true
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown error verifying TEE controlled key for account URI '${accountUri}'`
    console.error('TEE controlled key verification error:', errorMessage)
    throw new Error(`TEE controlled key verification failed: ${errorMessage}`)
  }
}

/**
 * Verifies certificate chain integrity and trust.
 */
export function verifyCertificateKey(acmeInfo: AcmeInfo): boolean {
  const { active_cert: activeCertificate, hist_keys: historicalKeys } = acmeInfo
  const teePublicKey = historicalKeys[0]

  if (!activeCertificate) {
    throw new Error(
      'Certificate verification failed: No active certificate provided in ACME info',
    )
  }

  if (!teePublicKey) {
    throw new Error(
      'Certificate verification failed: No TEE public key found in historical keys',
    )
  }

  try {
    const certificateChain = parseCertificateChain(activeCertificate)
    const leafCertificate = certificateChain[0]

    if (!leafCertificate) {
      throw new Error(
        'Certificate verification failed: Unable to parse leaf certificate from certificate chain',
      )
    }

    // Verify certificate chain integrity
    if (!verifyCertificateChain(certificateChain)) {
      throw new Error(
        'Certificate verification failed: Certificate chain validation failed',
      )
    }

    // Verify root certificate trust
    const rootCertificate = certificateChain[certificateChain.length - 1]
    if (
      certificateChain.length > 1 &&
      rootCertificate &&
      !isRootCertificateTrusted(rootCertificate)
    ) {
      throw new Error(
        `Certificate verification failed: Root certificate is not trusted (issuer: ${rootCertificate.issuer})`,
      )
    }

    // Check certificate validity period
    const currentTime = new Date()
    if (new Date(leafCertificate.validFrom) > currentTime) {
      throw new Error(
        `Certificate verification failed: Certificate is not yet valid (valid from: ${leafCertificate.validFrom})`,
      )
    }

    if (new Date(leafCertificate.validTo) < currentTime) {
      throw new Error(
        `Certificate verification failed: Certificate has expired (valid to: ${leafCertificate.validTo})`,
      )
    }

    // Compare public keys
    const leafCertificatePublicKey = leafCertificate.publicKey.export({
      type: 'spki',
      format: 'der',
    })
    const teePublicKeyBuffer = Buffer.from(teePublicKey, 'hex')

    if (!leafCertificatePublicKey.equals(teePublicKeyBuffer)) {
      throw new Error(
        'Certificate verification failed: Certificate public key does not match TEE-controlled key',
      )
    }

    return true
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown certificate verification error'
    console.error('Certificate verification error:', errorMessage)
    throw new Error(`Certificate verification failed: ${errorMessage}`)
  }
}

/**
 * Verifies DNS CAA records for domain control.
 */
export async function verifyDnsCAA(
  domainName: string,
  acmeAccountUri: string,
): Promise<boolean> {
  const dnsUrl = `https://dns.google/resolve?name=${domainName}&type=CAA`
  try {
    const dnsResponse = await fetch(dnsUrl)

    if (!dnsResponse.ok) {
      throw new Error(
        `DNS CAA query failed for domain '${domainName}': ${dnsResponse.status} ${dnsResponse.statusText} (URL: ${dnsUrl})`,
      )
    }

    const { Answer: dnsRecords } = (await dnsResponse.json()) as {
      Answer?: Array<{ type: number; data?: string }>
    }

    const caaRecords = dnsRecords?.filter((record) => record.type === 257) ?? []

    if (caaRecords.length === 0) {
      throw new Error(
        `No CAA records found for domain '${domainName}' - domain does not have Certificate Authority Authorization configured`,
      )
    }

    const hasMatchingRecord = caaRecords.every((record) =>
      record.data?.includes(acmeAccountUri),
    )
    if (!hasMatchingRecord) {
      throw new Error(
        `CAA records for domain '${domainName}' do not authorize ACME account '${acmeAccountUri}' - found records: ${JSON.stringify(caaRecords.map((r) => r.data))}`,
      )
    }

    return true
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown DNS CAA verification error for domain '${domainName}'`
    console.error('DNS CAA verification error:', errorMessage)
    throw new Error(`DNS CAA verification failed: ${errorMessage}`)
  }
}

/**
 * Verifies complete TEE control through Certificate Transparency logs.
 */
export async function verifyCTLog(acmeInfo: AcmeInfo): Promise<CTResult> {
  const { base_domain: domainName, hist_keys: teePublicKeys } = acmeInfo
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
  if (certificates.length === 0) {
    throw new Error(
      'Certificate chain verification failed: Empty certificate chain',
    )
  }

  for (let index = 0; index < certificates.length; index++) {
    if (index === certificates.length - 1) continue // Skip root certificate

    const certificate = certificates[index]
    const issuerCertificate = certificates[index + 1]

    if (!certificate) {
      throw new Error(
        `Certificate chain verification failed: Missing certificate at index ${index}`,
      )
    }

    if (!issuerCertificate) {
      throw new Error(
        `Certificate chain verification failed: Missing issuer certificate for certificate ${index}`,
      )
    }

    try {
      const isVerified = certificate.verify(issuerCertificate.publicKey)
      const issuerMatches = certificate.issuer === issuerCertificate.subject

      if (!isVerified) {
        throw new Error(
          `Certificate chain verification failed: Certificate ${index} signature verification failed`,
        )
      }

      if (!issuerMatches) {
        throw new Error(
          `Certificate chain verification failed: Certificate ${index} issuer '${certificate.issuer}' does not match next certificate subject '${issuerCertificate.subject}'`,
        )
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Unknown certificate chain verification error for certificate ${index}`
      console.error('Certificate chain verification error:', errorMessage)
      throw new Error(`Certificate chain verification failed: ${errorMessage}`)
    }
  }

  return true
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown root certificate trust verification error'
    console.error('Root certificate trust verification error:', errorMessage)
    throw new Error(
      `Root certificate trust verification failed: ${errorMessage}`,
    )
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
        `Certificate Transparency log query failed for domain '${domainName}': ${response.status} ${response.statusText} (URL: ${ctLogQueryUrl})`,
      )
    }

    const certificateData = await response.json()
    if (!Array.isArray(certificateData)) {
      console.warn(
        `CT Log returned non-array data for domain '${domainName}', treating as empty result`,
      )
      return []
    }

    return certificateData
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown error querying Certificate Transparency logs for domain '${domainName}'`
    console.error('Error querying Certificate Transparency logs:', errorMessage)
    throw new Error(
      `Certificate Transparency log query failed: ${errorMessage}`,
    )
  }
}

async function processCertificate(
  certificateEntry: CTLogEntry,
  teeControlledKeys: string[],
): Promise<{ publicKeyHex: string; isTeeControlled: boolean } | null> {
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

  return { publicKeyHex, isTeeControlled }
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
      console.warn(
        `Failed to fetch certificate ${certificateId}: ${response.status} ${response.statusText} (URL: ${certificateUrl})`,
      )
      return null
    }

    return await response.text()
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : `Unknown error fetching certificate ${certificateId}`
    console.error(
      `Error fetching certificate ${certificateId} from ${certificateUrl}:`,
      errorMessage,
    )
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error extracting public key from certificate'
    console.error('Error extracting public key from certificate:', errorMessage)
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
