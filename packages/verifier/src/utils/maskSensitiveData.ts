import type { DataObject } from '../types'

/**
 * Masks sensitive data in DataObjects before returning to client.
 * Specifically masks the docker_compose_file field within compose_file JSON.
 */
export function maskSensitiveDataObjects(
  dataObjects: DataObject[],
): DataObject[] {
  return dataObjects.map((obj) => maskDataObject(obj))
}

/**
 * Masks sensitive fields in a single DataObject
 */
function maskDataObject(dataObject: DataObject): DataObject {
  // Create a shallow copy to avoid mutating the original
  const masked: DataObject = { ...dataObject }

  // Mask compose_file field if it exists
  if (masked.fields?.compose_file) {
    masked.fields = {
      ...masked.fields,
      compose_file: maskComposeFile(masked.fields.compose_file),
    }
  }

  return masked
}

/**
 * Masks the docker_compose_file field within a compose_file JSON string
 */
function maskComposeFile(composeFile: unknown): string {
  if (typeof composeFile !== 'string') {
    return String(composeFile)
  }

  try {
    const parsed = JSON.parse(composeFile)

    // If docker_compose_file exists, mask it
    if (parsed.docker_compose_file) {
      parsed.docker_compose_file = '[MASKED]'
    }

    return JSON.stringify(parsed)
  } catch (error) {
    // If parsing fails, return original string
    console.warn(
      '[maskSensitiveData] Failed to parse compose_file as JSON:',
      error,
    )
    return composeFile
  }
}
