import { exec } from 'node:child_process'
import { access } from 'node:fs/promises'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

import { safeParseQuoteData, safeParseQuoteResult } from '../schemas'
import type { QuoteResult, VerifyQuoteResult } from '../types'

/** Promisified version of child_process.exec for async/await usage */
const execAsync = promisify(exec)

/**
 * Find the DCAP-QVL CLI binary path
 * Checks in order:
 * 1. /usr/local/bin/dcap-qvl (Docker - installed by Dockerfile)
 * 2. ../../bin/dcap-qvl (Dev - built via npm script)
 * 3. dcap-qvl (system PATH fallback)
 */
async function findDcapQvlPath(): Promise<string> {
  if (!import.meta.dirname) {
    throw new Error('import.meta.dirname is not available')
  }

  const paths = [
    '/usr/local/bin/dcap-qvl',
    path.join(import.meta.dirname, '../../bin/dcap-qvl'),
  ]

  for (const p of paths) {
    try {
      await access(p)
      return p
    } catch {
      // Continue to next path
    }
  }

  return 'dcap-qvl' // Fallback to PATH
}

let cachedDcapQvlPath: string | null = null

async function getDcapQvlPath(): Promise<string> {
  if (!cachedDcapQvlPath) {
    cachedDcapQvlPath = await findDcapQvlPath()
  }
  return cachedDcapQvlPath
}

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
  const dcapQvlPath = await getDcapQvlPath()
  let cliCommand = `${dcapQvlPath} decode`
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
  const dcapQvlPath = await getDcapQvlPath()
  let cliCommand = `${dcapQvlPath} verify`
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
