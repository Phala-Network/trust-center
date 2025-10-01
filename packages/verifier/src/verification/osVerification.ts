import path from 'node:path'

import type { AppInfo, TcbInfo } from '../types'
import {
  measureDstackImages,
  measureDstackImagesLegacy,
} from '../utils/dstack-mr'

/**
 * Measures DStack OS images and compares with expected TCB values.
 *
 * @param appInfo - Application information containing VM config
 * @param imageFolderName - Name of the image folder to use
 * @returns Promise resolving to true if all measurement registers match
 */
export async function verifyOSIntegrity(
  appInfo: AppInfo,
  imageFolderName: string = 'dstack-0.5.3',
): Promise<boolean> {
  const measurementResult = await measureDstackImages({
    image_folder: path.join(
      __dirname,
      `../../external/dstack-images/${imageFolderName}`,
    ),
    vm_config: appInfo.vm_config,
  })

  const expectedTcb = appInfo.tcb_info
  return compareMeasurementRegisters(measurementResult, expectedTcb)
}

/**
 * Measures DStack OS images for legacy versions using the Go-based dstack-mr tool.
 *
 * @param appInfo - Application information containing VM config
 * @param imageFolderName - Name of the image folder to use for legacy versions
 * @returns Promise resolving to true if all measurement registers match
 */
export async function verifyOSIntegrityLegacy(
  appInfo: AppInfo,
  imageFolderName: string = 'dstack-0.5.3',
): Promise<boolean> {
  const measurementResult = await measureDstackImagesLegacy({
    image_folder: path.join(
      __dirname,
      `../../external/dstack-images/${imageFolderName}`,
    ),
    vm_config: appInfo.vm_config,
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

/**
 * Gets the appropriate image folder based on verifier type.
 *
 * @param verifierType - Type of verifier (kms, gateway, app)
 * @returns Image folder name
 */
export function getImageFolder(verifierType: string): string {
  switch (verifierType) {
    case 'app':
      return 'dstack-nvidia-dev-0.5.3'
    default:
      return 'dstack-0.5.3'
  }
}
