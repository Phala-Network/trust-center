import {z} from 'zod'
import path from 'node:path'

import type {AppInfo, TcbInfo, VmConfig} from '../types'
import {
  measureDstackImages,
  measureDstackImagesLegacy,
} from '../utils/dstack-mr'

/**
 * Type guard to check if vm_config is a full VmConfig (vs BasicVmConfig)
 */
function isFullVmConfig(vmConfig: AppInfo['vm_config']): vmConfig is VmConfig {
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

type MeasurementRegisters = {
  mrtd: string
  rtmr0: string
  rtmr1: string
  rtmr2: string
}

type MeasurementRegisterName = keyof MeasurementRegisters

export interface MeasurementRegisterMismatch {
  register: MeasurementRegisterName
  expected: string
  calculated: string
}

export interface OSVerificationResult {
  isValid: boolean
  tool: 'dstack-mr-cli' | 'dstack-mr'
  measurementResult: MeasurementRegisters
  mismatches: MeasurementRegisterMismatch[]
}

/**
 * Measures DStack OS images and compares with expected TCB values.
 * Automatically selects the appropriate measurement tool based on vm_config format:
 * - Full VmConfig (with spec_version): uses modern Rust-based dstack-mr-cli
 * - BasicVmConfig: uses legacy Go-based dstack-mr (reads metadata.json)
 *
 * @param appInfo - Application information containing VM config
 * @param imageFolderName - Name of the image folder to use (required)
 * @returns Promise resolving to detailed verification result
 */
export async function verifyOSIntegrityDetailed(
  appInfo: AppInfo,
  imageFolderName: string,
): Promise<OSVerificationResult> {
  if (isFullVmConfig(appInfo.vm_config)) {
    const measurementResult = await measureDstackImages({
      image_folder: path.join(getDStackImagesBasePath(), imageFolderName),
      vm_config: appInfo.vm_config,
    })
    return buildOSVerificationResult(
      measurementResult,
      appInfo.tcb_info,
      'dstack-mr-cli',
    )
  }

  const measurementResult = await measureDstackImagesLegacy({
    image_folder: path.join(getDStackImagesBasePath(), imageFolderName),
  })
  return buildOSVerificationResult(
    measurementResult,
    appInfo.tcb_info,
    'dstack-mr',
  )
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
  return (await verifyOSIntegrityDetailed(appInfo, imageFolderName)).isValid
}

/**
 * Measures DStack OS images for legacy versions using the Go-based dstack-mr tool.
 * This tool reads metadata.json and doesn't require vm_config parameters.
 *
 * @param appInfo - Application information (vm_config not used)
 * @param imageFolderName - Name of the image folder to use for legacy versions (required)
 * @returns Promise resolving to detailed verification result
 */
export async function verifyOSIntegrityLegacyDetailed(
  appInfo: AppInfo,
  imageFolderName: string,
): Promise<OSVerificationResult> {
  const measurementResult = await measureDstackImagesLegacy({
    image_folder: path.join(getDStackImagesBasePath(), imageFolderName),
  })

  return buildOSVerificationResult(
    measurementResult,
    appInfo.tcb_info,
    'dstack-mr',
  )
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
  return (await verifyOSIntegrityLegacyDetailed(appInfo, imageFolderName))
    .isValid
}

export function formatOSVerificationFailure(
  imageFolderName: string,
  result: OSVerificationResult,
): string {
  const mismatches = result.mismatches
    .map(
      (mismatch) =>
        `${mismatch.register}: expected=${mismatch.expected} calculated=${mismatch.calculated}`,
    )
    .join('; ')

  return `Operating system verification failed: Measurement registers (MRTD, RTMR0-2) do not match expected values (image=${imageFolderName}, tool=${result.tool}, mismatches=${mismatches})`
}

function buildOSVerificationResult(
  measurementResult: MeasurementRegisters,
  expectedTcb: TcbInfo,
  tool: OSVerificationResult['tool'],
): OSVerificationResult {
  const mismatches = compareMeasurementRegisters(measurementResult, expectedTcb)

  return {
    isValid: mismatches.length === 0,
    tool,
    measurementResult,
    mismatches,
  }
}

/**
 * Compares measurement register results with expected TCB values.
 *
 * @param measurementResult - Result from DStack measurement tool
 * @param expectedTcb - Expected TCB information
 * @returns Mismatched registers
 */
function compareMeasurementRegisters(
  measurementResult: MeasurementRegisters,
  expectedTcb: TcbInfo,
): MeasurementRegisterMismatch[] {
  const registerNames: MeasurementRegisterName[] = [
    'mrtd',
    'rtmr0',
    'rtmr1',
    'rtmr2',
  ]

  return registerNames.flatMap((register) =>
    measurementResult[register] === expectedTcb[register]
      ? []
      : [
          {
            register,
            expected: expectedTcb[register],
            calculated: measurementResult[register],
          },
        ],
  )
}

export type DstackEvidence =
  | {attestation: string}
  | {quote: string; event_log: string; vm_config: string}

const DstackVerificationResponseSchema = z.object({
  is_valid: z.boolean(),
  details: z
    .object({
      quote_verified: z.boolean(),
      event_log_verified: z.boolean(),
      os_image_hash_verified: z.boolean(),
      acpi_tables_verified: z.boolean(),
      os_image_version: z.string().nullable(),
      os_image_is_dev: z.boolean().nullable(),
      tee_variant: z.string().nullable(),
      tcb_status: z.string().nullable(),
      advisory_ids: z.array(z.string()),
      report_data: z.string().nullable(),
      app_info: z
        .object({
          app_id: z.string().min(1),
          instance_id: z.string(),
          compose_hash: z.string().min(1),
          os_image_hash: z.string().min(1),
        })
        .passthrough()
        .nullable(),
    })
    .passthrough(),
  reason: z.string().nullable(),
})

export type DstackVerificationResponse = z.infer<
  typeof DstackVerificationResponseSchema
>

export async function verifyDstackEvidence(
  evidence: DstackEvidence,
): Promise<DstackVerificationResponse> {
  const endpoint =
    process.env.DSTACK_VERIFIER_URL || 'http://dstack-verifier:8080'
  const response = await fetch(new URL('/verify', endpoint), {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(
      'attestation' in evidence
        ? {
            attestation: evidence.attestation.replace(/^0x/, ''),
          }
        : {
            quote: evidence.quote.replace(/^0x/, ''),
            event_log: evidence.event_log,
            vm_config: evidence.vm_config,
          },
    ),
    signal: AbortSignal.timeout(330_000),
    redirect: 'error',
  })
  if (!response.ok) {
    throw new Error(
      `dstack-verifier HTTP ${response.status} ${response.statusText}`,
    )
  }
  const result = DstackVerificationResponseSchema.parse(await response.json())
  const details = result.details
  if (
    result.is_valid &&
    (!details.quote_verified ||
      !details.event_log_verified ||
      !details.os_image_hash_verified ||
      !details.app_info ||
      !details.tcb_status ||
      (details.tee_variant === 'dstack-tdx' && !details.acpi_tables_verified))
  ) {
    throw new Error('dstack-verifier returned an incomplete successful result')
  }
  return result
}
