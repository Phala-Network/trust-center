import { exec } from 'node:child_process'
import * as path from 'node:path'
import { promisify } from 'node:util'

import { safeParseOsMeasurement } from '../schemas'
import type { VmConfig } from '../types'

/** Promisified version of child_process.exec for async/await usage */
const execAsync = promisify(exec)

/** Path to the local dstack-mr-cli binary */
const DSTACK_MR_CLI_PATH = '/usr/local/bin/dstack-mr-cli'

const DSTACK_MR_PATH = '/usr/local/bin/dstack-mr'

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
 * Different dstack versions have different vm_config formats:
 * - prod7+: has qemu_single_pass_add_pages, pic (used for measurement)
 * - use1/use2: has qemu_version, image (qemu_single_pass_add_pages defaults to false)
 *
 * @param vmConfiguration - Virtual machine configuration object
 * @returns Array of CLI arguments
 */
function buildCliArgs(vmConfiguration: VmConfig): string[] {
  const cliArguments: string[] = []

  cliArguments.push('--cpu', vmConfiguration.cpu_count.toString())
  cliArguments.push('--memory', vmConfiguration.memory_size.toString())

  // For use1/use2 format (with qemu_version), default to false
  // For prod7+ format, use the actual value
  const twoPassAddPages = vmConfiguration.qemu_single_pass_add_pages ?? false
  cliArguments.push('--two-pass-add-pages', twoPassAddPages.toString())

  // For use1/use2 format (with qemu_version), default to false
  // For prod7+ format, use the actual value
  const pic = vmConfiguration.pic ?? false
  cliArguments.push('--pic', pic.toString())

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
 * Measures DStack OS images using the local measurement CLI tool.
 *
 * This function runs the DStack measurement tool locally to calculate measurement
 * registers (MRTD, RTMRs) for the specified OS images and VM configuration.
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
  const absoluteImagePath = path.resolve(measurementOptions.image_folder)
  const metadataPath = path.join(absoluteImagePath, 'metadata.json')

  const command = `${DSTACK_MR_CLI_PATH} measure "${metadataPath}" ${cliArguments.join(' ')}`

  try {
    const { stdout } = await execAsync(command)
    return safeParseOsMeasurement(stdout)
  } catch (execError: unknown) {
    const error = execError as { stderr?: string; message: string }
    const errorMessage = error.stderr || error.message
    throw new Error(`Failed to run DStack measurement tool: ${errorMessage}`)
  }
}

/**
 * Measures DStack OS images using the Go-based dstack-mr CLI tool for legacy versions.
 *
 * This function uses the standalone Go-based dstack-mr tool which is specifically
 * designed for legacy dstack image verification.
 *
 * @param measurementOptions - Configuration for the measurement operation
 * @returns Promise resolving to measurement results containing MRTD and RTMR values
 * @throws Error if the measurement process fails or tool is not installed
 */
export async function measureDstackImagesLegacy(options: {
  image_folder: string
}): Promise<{
  mrtd: string
  rtmr0: string
  rtmr1: string
  rtmr2: string
}> {
  const absoluteImagePath = path.resolve(options.image_folder)
  const metadataPath = path.join(absoluteImagePath, 'metadata.json')

  const dstackMrCommand = `${DSTACK_MR_PATH} -metadata "${metadataPath}" -json`

  try {
    const { stdout } = await execAsync(dstackMrCommand)
    return safeParseOsMeasurement(stdout)
  } catch (legacyError: unknown) {
    const execError = legacyError as {
      stderr?: string
      message: string
      code?: string
    }

    if (
      execError.message?.includes('command not found') ||
      execError.code === 'ENOENT'
    ) {
      throw new Error(
        'dstack-mr CLI tool not found. Please install it using: go install github.com/kvinwang/dstack-mr@latest',
      )
    }

    const errorMessage = execError.stderr || execError.message
    throw new Error(
      `Failed to run legacy DStack measurement tool: ${errorMessage}`,
    )
  }
}
