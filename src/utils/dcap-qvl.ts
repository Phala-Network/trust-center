import {exec} from 'node:child_process'
import {rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import * as path from 'node:path'
import {promisify} from 'node:util'

import type {DecodedQuoteResult, VerifyQuoteResult} from '../types'

const execAsync = promisify(exec)

const DCAP_QVL_CLI_PATH = path.join(__dirname, '../..//bin/dcap-qvl')

export async function decodeQuoteFile(
  quoteFile: string,
  options?: {hex?: boolean; fmspc?: boolean},
): Promise<DecodedQuoteResult> {
  let command = `${DCAP_QVL_CLI_PATH} decode`
  if (options?.hex) {
    command += ' --hex'
  }
  if (options?.fmspc) {
    command += ' --fmspc'
  }
  command += ` ${quoteFile}`

  try {
    const {stdout} = await execAsync(command)
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Failed to decode quote: ${error.message}`)
  }
}

export async function verifyQuoteFile(
  quoteFile: string,
  options?: {hex?: boolean},
): Promise<VerifyQuoteResult> {
  let command = `${DCAP_QVL_CLI_PATH} verify`
  if (options?.hex) {
    command += ' --hex'
  }
  command += ` ${quoteFile}`

  try {
    const {stdout} = await execAsync(command)
    return JSON.parse(stdout)
  } catch (error) {
    throw new Error(`Failed to verify quote: ${error.message}`)
  }
}

export async function decodeQuote(
  quote: string,
  options?: {hex?: boolean; fmspc?: boolean},
): Promise<DecodedQuoteResult> {
  const tmp = path.join(tmpdir(), `quote-${Date.now()}.hex`)
  await writeFile(tmp, quote)
  const decoded = await decodeQuoteFile(tmp, options)
  await rm(tmp)
  return decoded
}

export async function verifyQuote(
  quote: string,
  options?: {hex?: boolean},
): Promise<VerifyQuoteResult> {
  const tmp = path.join(tmpdir(), `quote-${Date.now()}.hex`)
  await writeFile(tmp, quote)
  const verified = await verifyQuoteFile(tmp, options)
  await rm(tmp)
  return verified
}
