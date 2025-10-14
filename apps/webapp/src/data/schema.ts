import {z} from 'zod'

const dataObjectIds = [
  'app-code',
  'app-cpu',
  'app-event-logs-imr0',
  'app-event-logs-imr1',
  'app-event-logs-imr2',
  'app-event-logs-imr3',

  // Only for GPU apps
  'app-gpu',
  'app-gpu-quote',

  'app-main',
  'app-os',
  'app-os-code',
  'app-quote',
  'gateway-code',
  'gateway-cpu',
  'gateway-event-logs-imr0',
  'gateway-event-logs-imr1',
  'gateway-event-logs-imr2',
  'gateway-event-logs-imr3',
  'gateway-main',
  'gateway-os',
  'gateway-os-code',
  'gateway-quote',
  'kms-code',
  'kms-cpu',
  'kms-event-logs-imr0',
  'kms-event-logs-imr1',
  'kms-event-logs-imr2',
  'kms-event-logs-imr3',
  'kms-main',
  'kms-os',
  'kms-os-code',
  'kms-quote',
] as const

// Create a Zod enum from the dataIds array
export const dataObjectIdSchema = z.enum(dataObjectIds)

// Schema for measuredBy array items
const measuredBySchema = z.object({
  objectId: dataObjectIdSchema,
  fieldName: z.string().optional(),
  selfFieldName: z.string().optional(),
  calcOutputName: z.string().optional(),
  selfCalcOutputName: z.string().optional(),
})

export type MeasuredBy = z.infer<typeof measuredBySchema>

// Schema for calculations array items
const calculationSchema = z.object({
  inputs: z.array(z.string()),
  calcFunc: z.string(),
  outputs: z.array(z.string()),
})

// Main DataObject schema
export const dataObjectSchema = z.object({
  id: dataObjectIdSchema,
  name: z.string(),
  description: z.string().optional(),
  fields: z.record(z.string(), z.unknown()),
  kind: z.enum(['gateway', 'kms', 'app']),
  measuredBy: z.array(measuredBySchema).optional(),
  calculations: z.array(calculationSchema).optional(),
})

export const dataSchema = z.array(dataObjectSchema)

export function safeParseMeasuredBy(data: unknown): MeasuredBy | null {
  const result = measuredBySchema.safeParse(data)
  return result.success ? result.data : null
}

export function safeParseData(data: unknown[]): DataObject[] {
  const results: DataObject[] = []

  for (const rawItem of data) {
    // Type guard to ensure rawItem is an object
    if (typeof rawItem !== 'object' || rawItem === null) {
      continue
    }

    const item = rawItem as Record<string, unknown>

    // First, manually clean the measuredBy array before validating the object
    const cleanedItem = {
      ...item,
      measuredBy: Array.isArray(item.measuredBy)
        ? item.measuredBy
            .map(safeParseMeasuredBy)
            .filter((entry): entry is MeasuredBy => entry != null)
        : undefined,
    }

    // Now validate the cleaned object
    const result = dataObjectSchema.safeParse(cleanedItem)
    if (!result.success) {
      continue
    }

    results.push(result.data)
  }

  return results
}

export type DataObjectId = z.infer<typeof dataObjectIdSchema>
export type DataObject = z.infer<typeof dataObjectSchema>
export type Data = z.infer<typeof dataSchema>
