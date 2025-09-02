import type { z } from 'zod'
import type { AppInfo } from './application'
import type { AttestationBundle } from './attestation'

/**
 * Utility functions for parsing and handling type conversions.
 */

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
