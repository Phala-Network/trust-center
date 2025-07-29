import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

const DCAP_QVL_CLI_PATH = path.join(__dirname, '../bin/dcap-qvl');

export async function decodeQuote(quoteFile: string, options?: { hex?: boolean; fmspc?: boolean }): Promise<string> {
  let command = `${DCAP_QVL_CLI_PATH} decode`;
  if (options?.hex) {
    command += ' --hex';
  }
  if (options?.fmspc) {
    command += ' --fmspc';
  }
  command += ` ${quoteFile}`;

  try {
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to decode quote: ${error.message}`);
  }
}

export async function verifyQuote(quoteFile: string, options?: { hex?: boolean }): Promise<string> {
  let command = `${DCAP_QVL_CLI_PATH} verify`;
  if (options?.hex) {
    command += ' --hex';
  }
  command += ` ${quoteFile}`;

  try {
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to verify quote: ${error.message}`);
  }
}
