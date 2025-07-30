import {exec} from 'child_process'
import * as path from 'path'
import {promisify} from 'util'

const execAsync = promisify(exec)

const DSTACK_MR_CLI_PATH = path.join(__dirname, '../../bin/dstack-mr')

export interface DstackMrOptions {
  cpu?: number
  memory?: string
  metadata?: string
}

export async function measureDstackImages(
  options: DstackMrOptions = {},
): Promise<any> {
  // Always add -json flag to get structured output
  let command = `${DSTACK_MR_CLI_PATH} -json`

  if (options.cpu) {
    command += ` -cpu ${options.cpu}`
  }
  if (options.memory) {
    command += ` -memory ${options.memory}`
  }
  if (options.metadata) {
    command += ` -metadata ${options.metadata}`
  }

  try {
    const {stdout} = await execAsync(command)
    return JSON.parse(stdout)
  } catch (error) {
    const execError = error as {stderr?: string; message: string}
    const errorMessage = execError.stderr || execError.message
    throw new Error(`Failed to run dstack-mr: ${errorMessage}`)
  }
}
