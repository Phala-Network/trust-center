import type { QuoteData, VerifyQuoteResult } from '../types'
import { verifyQuote } from '../utils/dcap-qvl'

/**
 * Verifies TEE hardware attestation using DCAP-QVL.
 *
 * @param quoteData - The quote and event log data
 * @returns Promise resolving to verification result
 */
export async function verifyTeeQuote(
  quoteData: QuoteData,
): Promise<VerifyQuoteResult> {
  return verifyQuote(quoteData.quote, { hex: true })
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
