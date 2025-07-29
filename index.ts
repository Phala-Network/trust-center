interface DataObject {
  id: string
  name: string
  description?: string
  fields: Record<string, unknown>
  layer: number // Layer number for positioning in the graph
  type: string // Category
  kind?: 'gateway' | 'kms' | 'app' // Component type for styling
  measuredBy?: {
    /** ID of the object that is making the measurement */
    objectId: string
    /** Name of the field in the object that is making the measurement */
    fieldName?: string
    /** Name of the field in the current object that is being measured */
    selfFieldName?: string
    /** Name of the calculation output in the object that is making the measurement */
    calcOutputName?: string
    /** Name of the calculation output in the current object that is being measured */
    selfCalcOutputName?: string
  }[] // Multiple measurements between objects/fields/calculations
  // New structure for calculations with inputs, calculation functions, and outputs
  calculations?: Array<{
    inputs: string[]
    calcFunc: string
    outputs: string[]
  }>
}


console.log("Hello via Bun!");