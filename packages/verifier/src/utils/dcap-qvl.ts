import { exec } from 'node:child_process'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

import { safeParseQuoteData, safeParseQuoteResult } from '../schemas'
import type { QuoteResult, VerifyQuoteResult } from '../types'

/** Promisified version of child_process.exec for async/await usage */
const execAsync = promisify(exec)

/** Path to the DCAP-QVL CLI binary */
const DCAP_QVL_CLI_PATH = path.join(__dirname, '../../bin/dcap-qvl')

/**
 * Decodes a TEE quote file using the DCAP-QVL CLI tool.
 *
 * @param quoteFilePath - Path to the quote file to decode
 * @param options - Decoding options
 * @param options.hex - Whether the quote is in hexadecimal format
 * @param options.fmspc - Whether to include FMSPC information
 * @returns Promise resolving to decoded quote structure
 * @throws Error if decoding fails
 */
export async function decodeQuoteFile(
  quoteFilePath: string,
  options?: { hex?: boolean; fmspc?: boolean },
): Promise<QuoteResult> {
  let cliCommand = `${DCAP_QVL_CLI_PATH} decode`
  if (options?.hex) {
    cliCommand += ' --hex'
  }
  if (options?.fmspc) {
    cliCommand += ' --fmspc'
  }
  cliCommand += ` ${quoteFilePath}`

  try {
    const { stdout } = await execAsync(cliCommand)
    return safeParseQuoteData(stdout)
  } catch (cliError: unknown) {
    const errorMessage =
      cliError instanceof Error ? cliError.message : String(cliError)
    throw new Error(`Failed to decode quote file: ${errorMessage}`)
  }
}

/**
 * Verifies a TEE quote file using the DCAP-QVL CLI tool.
 *
 * @param quoteFilePath - Path to the quote file to verify
 * @param options - Verification options
 * @param options.hex - Whether the quote is in hexadecimal format
 * @returns Promise resolving to quote verification result
 * @throws Error if verification fails
 */
export async function verifyQuoteFile(
  quoteFilePath: string,
  options?: { hex?: boolean },
): Promise<VerifyQuoteResult> {
  let cliCommand = `${DCAP_QVL_CLI_PATH} verify`
  if (options?.hex) {
    cliCommand += ' --hex'
  }
  cliCommand += ` ${quoteFilePath}`

  try {
    const { stdout } = await execAsync(cliCommand)
    return safeParseQuoteResult(stdout)
  } catch (cliError: unknown) {
    const errorMessage =
      cliError instanceof Error ? cliError.message : String(cliError)
    throw new Error(`Failed to verify quote file: ${errorMessage}`)
  }
}

/**
 * Decodes a TEE quote string by writing it to a temporary file.
 *
 * This is a convenience function that handles temporary file creation and cleanup.
 *
 * @param quoteString - The quote data as a string
 * @param options - Decoding options
 * @param options.hex - Whether the quote is in hexadecimal format
 * @param options.fmspc - Whether to include FMSPC information
 * @returns Promise resolving to decoded quote structure
 * @throws Error if decoding fails
 */
export async function decodeQuote(
  quoteString: string,
  options?: { hex?: boolean; fmspc?: boolean },
): Promise<QuoteResult> {
  const temporaryFilePath = path.join(tmpdir(), `quote-${Date.now()}.hex`)
  await writeFile(temporaryFilePath, quoteString)

  try {
    const decodedResult = await decodeQuoteFile(temporaryFilePath, options)
    return decodedResult
  } finally {
    await rm(temporaryFilePath)
  }
}

/**
 * Verifies a TEE quote string by writing it to a temporary file.
 *
 * This is a convenience function that handles temporary file creation and cleanup.
 *
 * @param quoteString - The quote data as a string
 * @param options - Verification options
 * @param options.hex - Whether the quote is in hexadecimal format
 * @returns Promise resolving to quote verification result
 * @throws Error if verification fails
 */
export async function verifyQuote(
  quoteString: string,
  options?: { hex?: boolean },
): Promise<VerifyQuoteResult> {
  const temporaryFilePath = path.join(tmpdir(), `quote-${Date.now()}.hex`)
  await writeFile(temporaryFilePath, quoteString)

  try {
    const verificationResult = await verifyQuoteFile(temporaryFilePath, options)
    return verificationResult
  } finally {
    await rm(temporaryFilePath)
  }
}
