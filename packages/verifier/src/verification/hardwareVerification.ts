import type {QuoteData, VerifyQuoteResult} from '../types'
import {verifyQuote} from '../utils/dcap-qvl'

/**
 * Verifies TEE hardware attestation using DCAP-QVL.
 *
 * @param quoteData - The quote and event log data
 * @returns Promise resolving to verification result
 */
export async function verifyTeeQuote(
  quoteData: QuoteData,
): Promise<VerifyQuoteResult> {
  return verifyQuote(quoteData.quote, {hex: true})
}

/**
 * Checks if verification result indicates hardware is up-to-date.
 *
 * @param verificationResult - Result from DCAP-QVL verification
 * @returns True if hardware attestation is valid and up-to-date
 */
export function isUpToDate(verificationResult: VerifyQuoteResult): boolean {
  return verificationResult.status === 'UpToDate'
}

/**
 * Optional: Intel Trust Authority appraisal
 */
export async function verifyWithIntelTrustAuthority(
  quoteHex: string,
  apiKey?: string,
): Promise<Record<string, unknown> | null> {
  if (!apiKey) {
    console.log(
      '[ITA] Skipping Intel Trust Authority appraisal: API key not provided',
    )
    return null
  }

  console.log('[ITA] Starting Intel Trust Authority appraisal...')
  try {
    const quoteBytes = Buffer.from(quoteHex.replace(/^0x/, ''), 'hex')
    const quoteBase64 = quoteBytes.toString('base64')

    const response = await fetch(
      'https://api.trustauthority.intel.com/appraisal/v2/attest',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tdx: {quote: quoteBase64},
        }),
      },
    )

    if (response.ok) {
      const data = (await response.json()) as {token?: string}
      const token = data.token
      if (token) {
        // Simple JWT decode without verification (we trust HTTPS + API key)
        const parts = token.split('.')
        if (parts.length === 3 && parts[1]) {
          const payload = Buffer.from(parts[1], 'base64').toString('utf-8')
          return JSON.parse(payload) as Record<string, unknown>
        }
      }
    }
    return null
  } catch (err) {
    // Silent failure for optional ITA verification
    console.warn(
      `ITA Verification failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return null
  }
}
