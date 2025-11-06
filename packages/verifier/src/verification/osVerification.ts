import path from 'node:path'

import type { AppInfo, TcbInfo, VmConfig } from '../types'
import {
  measureDstackImages,
  measureDstackImagesLegacy,
} from '../utils/dstack-mr'

/**
 * Type guard to check if vm_config is a full VmConfig (vs BasicVmConfig)
 */
function isFullVmConfig(
  vmConfig: AppInfo['vm_config'],
): vmConfig is VmConfig {
  return 'spec_version' in vmConfig
}

/**
 * Get the base path for DStack images.
 * Uses import.meta.dirname to resolve relative to source file.
 * Works in both dev and Docker since verifier package structure is identical.
 */
function getDStackImagesBasePath(): string {
  if (!import.meta.dirname) {
    throw new Error('import.meta.dirname is not available')
  }
  return path.join(import.meta.dirname, '../../external/dstack-images')
}

/**
 * Measures DStack OS images and compares with expected TCB values.
 * Automatically selects the appropriate measurement tool based on vm_config format:
 * - Full VmConfig (with spec_version): uses modern Rust-based dstack-mr-cli
 * - BasicVmConfig: uses legacy Go-based dstack-mr (reads metadata.json)
 *
 * @param appInfo - Application information containing VM config
 * @param imageFolderName - Name of the image folder to use (required)
 * @returns Promise resolving to true if all measurement registers match
 */
export async function verifyOSIntegrity(
  appInfo: AppInfo,
  imageFolderName: string,
): Promise<boolean> {
  // Check if vm_config has full VmConfig fields using type guard
  if (isFullVmConfig(appInfo.vm_config)) {
    // Full VmConfig (>= 0.5.3) - use modern Rust-based measurement
    const measurementResult = await measureDstackImages({
      image_folder: path.join(getDStackImagesBasePath(), imageFolderName),
      vm_config: appInfo.vm_config,
    })
    const expectedTcb = appInfo.tcb_info
    return compareMeasurementRegisters(measurementResult, expectedTcb)
  } else {
    // BasicVmConfig (0.5.0-0.5.2) - use legacy Go-based measurement
    const measurementResult = await measureDstackImagesLegacy({
      image_folder: path.join(getDStackImagesBasePath(), imageFolderName),
    })
    const expectedTcb = appInfo.tcb_info
    return compareMeasurementRegisters(measurementResult, expectedTcb)
  }
}

/**
 * Measures DStack OS images for legacy versions using the Go-based dstack-mr tool.
 * This tool reads metadata.json and doesn't require vm_config parameters.
 *
 * @param appInfo - Application information (vm_config not used)
 * @param imageFolderName - Name of the image folder to use for legacy versions (required)
 * @returns Promise resolving to true if all measurement registers match
 */
export async function verifyOSIntegrityLegacy(
  appInfo: AppInfo,
  imageFolderName: string,
): Promise<boolean> {
  const measurementResult = await measureDstackImagesLegacy({
    image_folder: path.join(getDStackImagesBasePath(), imageFolderName),
  })

  const expectedTcb = appInfo.tcb_info
  return compareMeasurementRegisters(measurementResult, expectedTcb)
}

/**
 * Compares measurement register results with expected TCB values.
 *
 * @param measurementResult - Result from DStack measurement tool
 * @param expectedTcb - Expected TCB information
 * @returns True if all registers match
 */
function compareMeasurementRegisters(
  measurementResult: {
    mrtd: string
    rtmr0: string
    rtmr1: string
    rtmr2: string
  },
  expectedTcb: TcbInfo,
): boolean {
  return (
    measurementResult.mrtd === expectedTcb.mrtd &&
    measurementResult.rtmr0 === expectedTcb.rtmr0 &&
    measurementResult.rtmr1 === expectedTcb.rtmr1 &&
    measurementResult.rtmr2 === expectedTcb.rtmr2
  )
}
