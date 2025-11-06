import { isAddress } from 'viem'
import { z } from 'zod'

import type {
  AppInfo,
  KeyProvider,
  LegacyAppInfo,
  TcbInfo,
  VmConfig,
} from './application'
import type { AttestationBundle } from './attestation'

/**
 * Utility functions for parsing and handling type conversions.
 */

/**
 * Branded type for App ID (contract address WITHOUT 0x prefix)
 * This ensures type safety and prevents mixing app_id and contract_address
 */
export type AppId = string & { readonly __brand: 'AppId' }

/**
 * Branded type for Contract Address (Ethereum address WITH 0x prefix)
 * This ensures type safety and prevents mixing app_id and contract_address
 */
export type ContractAddress = `0x${string}` & {
  readonly __brand: 'ContractAddress'
}

/**
 * Zod schema for AppId (hex string without 0x prefix)
 * Automatically strips 0x prefix if present and validates format
 */
export const AppIdSchema = z
  .string()
  .min(1, 'AppId cannot be empty')
  .transform((val) => {
    // Strip 0x prefix if present
    const cleaned = val.toLowerCase().startsWith('0x') ? val.slice(2) : val
    return cleaned
  })
  .pipe(
    z
      .string()
      .regex(
        /^[a-f0-9]+$/i,
        'AppId must contain only hexadecimal characters',
      )
      .transform((val) => val as AppId),
  )

/**
 * Zod schema for ContractAddress (Ethereum address with 0x prefix)
 * Automatically adds 0x prefix if missing and validates using viem's isAddress
 */
export const ContractAddressSchema = z
  .string()
  .min(1, 'ContractAddress cannot be empty')
  .transform((val) => {
    // Add 0x prefix if missing
    const withPrefix = val.toLowerCase().startsWith('0x')
      ? val
      : `0x${val}`
    return withPrefix
  })
  .pipe(
    z
      .string()
      .refine(
        (val) => isAddress(val),
        'ContractAddress must be a valid Ethereum address (0x + 40 hex characters)',
      )
      .transform((val) => val as ContractAddress),
  )

/**
 * Type guard to check if a value is a valid AppId
 *
 * @param value - Value to check
 * @returns true if the value matches AppId format
 */
export function isAppId(value: unknown): value is AppId {
  return AppIdSchema.safeParse(value).success
}

/**
 * Type guard to check if a value is a valid ContractAddress
 *
 * @param value - Value to check
 * @returns true if the value matches ContractAddress format
 */
export function isContractAddress(value: unknown): value is ContractAddress {
  return ContractAddressSchema.safeParse(value).success
}

/**
 * Converts a string to AppId format (strips 0x prefix if present)
 *
 * @param value - String that might be an app_id or contract_address
 * @returns AppId without 0x prefix
 * @throws ZodError if the value is not a valid AppId format
 */
export function toAppId(value: string): AppId {
  return AppIdSchema.parse(value)
}

/**
 * Converts a string to ContractAddress format (ensures 0x prefix)
 *
 * @param value - String that might be an app_id or contract_address
 * @returns ContractAddress with 0x prefix
 * @throws ZodError if the value is not a valid ContractAddress format
 */
export function toContractAddress(value: string): ContractAddress {
  return ContractAddressSchema.parse(value)
}

/**
 * Parses JSON fields in an object based on configuration using Zod validation.
 *
 * @template T - The expected return type after parsing
 * @param rawObject - The raw object containing potential JSON strings
 * @param parseConfig - Configuration object mapping field names to Zod schemas for validation
 * @returns The object with specified fields parsed and validated from JSON strings
 */
export function parseJsonFields<T>(
  rawObject: Record<string, unknown>,
  parseConfig: Record<string, z.ZodSchema> = {},
): T {
  const result = { ...rawObject }

  Object.keys(parseConfig).forEach((fieldName) => {
    if (parseConfig[fieldName] && typeof result[fieldName] === 'string') {
      try {
        const parsed = JSON.parse(result[fieldName] as string)
        result[fieldName] = parseConfig[fieldName].parse(parsed)
      } catch (parseError) {
        console.error(`Failed to parse JSON field '${fieldName}':`, parseError)
        throw new Error(
          `Invalid JSON format in field '${fieldName}': ${parseError}`,
        )
      }
    }
  })

  return result as T
}

/**
 * Selectively parses known JSON string fields within the AppInfo structure
 */
function parseAppInfoJsonFields(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj

  const result = { ...(obj as Record<string, unknown>) }

  // Parse vm_config if it's a JSON string
  if (typeof result.vm_config === 'string') {
    try {
      result.vm_config = JSON.parse(result.vm_config)
    } catch {
      // Keep as string if parsing fails
    }
  }

  // Parse tcb_info if it's a JSON string
  if (typeof result.tcb_info === 'string') {
    try {
      const tcbData = JSON.parse(result.tcb_info)

      // Parse event_log within tcb_info if it's a JSON string
      if (typeof tcbData.event_log === 'string') {
        try {
          tcbData.event_log = JSON.parse(tcbData.event_log)
        } catch {
          // Keep as string if parsing fails
        }
      }

      result.tcb_info = tcbData
    } catch {
      // Keep as string if parsing fails
    }
  }

  // Parse key_provider_info if it's a JSON string
  if (typeof result.key_provider_info === 'string') {
    try {
      result.key_provider_info = JSON.parse(result.key_provider_info)
    } catch {
      // Keep as string if parsing fails
    }
  }

  return result
}

/**
 * Elegantly parses AttestationBundle with automatic nested JSON handling
 */
export function parseAttestationBundle(
  rawData: Record<string, unknown>,
  schemas: {
    nvidiaPayloadSchema: z.ZodSchema
    eventLogSchema: z.ZodSchema
    appInfoSchema: z.ZodSchema
  },
): AttestationBundle {
  // First, parse the top-level JSON fields
  const parsed = parseJsonFields<AttestationBundle>(rawData, {
    nvidia_payload: schemas.nvidiaPayloadSchema,
    event_log: schemas.eventLogSchema,
  })

  // Then selectively parse the info field's known JSON strings
  if (parsed.info) {
    const parsedInfo = parseAppInfoJsonFields(parsed.info)
    parsed.info = schemas.appInfoSchema.parse(parsedInfo) as AppInfo
  }

  return parsed
}

/**
 * Converts LegacyAppInfo to AppInfo format by extracting missing fields from tcb_info.
 *
 * @param legacyAppInfo - The legacy app info format
 * @returns AppInfo with fields extracted from tcb_info and sensible defaults for missing fields
 */
export function convertLegacyAppInfo(legacyAppInfo: LegacyAppInfo): AppInfo {
  // Create default key provider info
  const defaultKeyProvider: KeyProvider = {
    name: 'Legacy Key Provider',
    id: 'legacy',
  }

  // Create default VM config (minimal configuration for legacy apps)
  const defaultVmConfig: VmConfig = {
    spec_version: 0,
    os_image_hash: '0x', // Use rootfs_hash from legacy format
    cpu_count: 0,
    memory_size: 0,
    qemu_single_pass_add_pages: false,
    pic: true,
    pci_hole64_size: 0,
    hugepages: false,
    num_gpus: 0,
    num_nvswitches: 0,
    hotplug_off: false,
  }

  // Convert LegacyTcbInfo to TcbInfo format
  const convertedTcbInfo: TcbInfo = {
    mrtd: legacyAppInfo.tcb_info.mrtd,
    rtmr0: legacyAppInfo.tcb_info.rtmr0,
    rtmr1: legacyAppInfo.tcb_info.rtmr1,
    rtmr2: legacyAppInfo.tcb_info.rtmr2,
    rtmr3: legacyAppInfo.tcb_info.rtmr3,
    mr_aggregated: '0x', // Not available in legacy format
    os_image_hash: legacyAppInfo.tcb_info.rootfs_hash, // Use rootfs_hash
    compose_hash: '0x', // Not available in legacy format
    device_id: '0x', // Not available in legacy format
    event_log: legacyAppInfo.tcb_info.event_log,
    app_compose: legacyAppInfo.tcb_info.app_compose,
  }

  return {
    app_id: legacyAppInfo.app_id,
    instance_id: legacyAppInfo.instance_id,
    app_cert: legacyAppInfo.app_cert,
    tcb_info: convertedTcbInfo,
    app_name: legacyAppInfo.app_name,
    device_id: '0x', // Not available in legacy format
    mr_aggregated: '0x', // Not available in legacy format
    os_image_hash: legacyAppInfo.tcb_info.rootfs_hash,
    key_provider_info: defaultKeyProvider,
    compose_hash: '0x', // Not available in legacy format
    vm_config: defaultVmConfig,
  }
}
