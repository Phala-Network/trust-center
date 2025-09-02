import { exec } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { safeParseOsMeasurement } from '../schemas'
import type { VmConfig } from '../types'

/** Promisified version of child_process.exec for async/await usage */
const execAsync = promisify(exec)

/** Docker image containing the DStack measurement CLI tool */
const DSTACK_MR_DOCKER_IMAGE = 'shelvenzhou49/dstack-mr-cli:latest'

/**
 * Configuration options for DStack image measurement operations.
 */
export interface DstackMrOptions {
  /** Path to the folder containing DStack OS images */
  image_folder: string
  /** Virtual machine configuration for measurement */
  vm_config: VmConfig
}

/**
 * Builds CLI arguments array from VM configuration for the DStack measurement tool.
 *
 * @param vmConfiguration - Virtual machine configuration object
 * @returns Array of CLI arguments
 */
function buildCliArgs(vmConfiguration: VmConfig): string[] {
  const cliArguments: string[] = []

  cliArguments.push('--cpu', vmConfiguration.cpu_count.toString())
  cliArguments.push('--memory', vmConfiguration.memory_size.toString())

  cliArguments.push(
    '--two-pass-add-pages',
    vmConfiguration.qemu_single_pass_add_pages.toString(),
  )

  // TODO: PIC setting is currently hardcoded - should use vm_config.pic
  cliArguments.push('--pic', 'false')

  if (vmConfiguration.pci_hole64_size > 0) {
    cliArguments.push(
      '--pci-hole64-size',
      vmConfiguration.pci_hole64_size.toString(),
    )
  }

  if (vmConfiguration.hugepages) {
    cliArguments.push('--hugepages')
  }

  cliArguments.push('--num-gpus', vmConfiguration.num_gpus.toString())
  cliArguments.push(
    '--num-nvswitches',
    vmConfiguration.num_nvswitches.toString(),
  )
  cliArguments.push('--hotplug-off', vmConfiguration.hotplug_off.toString())

  cliArguments.push('--json')

  return cliArguments
}

/**
 * Measures DStack OS images using the measurement CLI tool in a Docker container.
 *
 * This function runs the DStack measurement tool in a privileged Docker container
 * to calculate measurement registers (MRTD, RTMRs) for the specified OS images
 * and VM configuration.
 *
 * @param measurementOptions - Configuration for the measurement operation
 * @returns Promise resolving to measurement results containing MRTD and RTMR values
 * @throws Error if the measurement process fails
 */
export async function measureDstackImages(
  measurementOptions: DstackMrOptions,
): Promise<{
  mrtd: string
  rtmr0: string
  rtmr1: string
  rtmr2: string
}> {
  const cliArguments = buildCliArgs(measurementOptions.vm_config)
  const argumentsString = cliArguments.join(' ')
  const absoluteImagePath = path.resolve(measurementOptions.image_folder)

  const dockerCommand = `docker run --rm --privileged -v "${absoluteImagePath}":/app/dstack-images ${DSTACK_MR_DOCKER_IMAGE} measure /app/dstack-images/metadata.json ${argumentsString}`

  try {
    const { stdout } = await execAsync(dockerCommand)
    return safeParseOsMeasurement(stdout)
  } catch (dockerError: unknown) {
    const execError = dockerError as { stderr?: string; message: string }
    const errorMessage = execError.stderr || execError.message
    throw new Error(`Failed to run DStack measurement tool: ${errorMessage}`)
  }
}
