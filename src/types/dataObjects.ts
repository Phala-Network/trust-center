/**
 * Types related to data objects and report generation.
 */

/**
 * DataObject interface for report generation.
 */
export interface DataObject {
  id: string
  name: string
  description?: string
  fields: Record<string, unknown>
  layer: number
  type: string
  kind?: 'gateway' | 'kms' | 'app'
  measuredBy?: {
    objectId: string
    fieldName?: string
    selfFieldName?: string
    calcOutputName?: string
    selfCalcOutputName?: string
  }[]
  calculations?: Array<{
    inputs: string[]
    calcFunc: string
    outputs: string[]
  }>
}

/**
 * Relationship definition for DataObject connections.
 */
export interface ObjectRelationship {
  /** Source object ID */
  sourceObjectId: string
  /** Target object ID */
  targetObjectId: string
  /** Field name in source object */
  sourceField?: string
  /** Field name in target object */
  targetField?: string
  /** Calculation output name in source object */
  sourceCalcOutput?: string
  /** Calculation output name in target object */
  targetCalcOutput?: string
  /** Whether this is a self-referential relationship */
  isSelfReference?: boolean
}

/**
 * Configuration for cross-verifier relationships.
 */
export interface VerifierRelationshipConfig {
  /** Relationships between verifiers */
  relationships: ObjectRelationship[]
  /** Additional metadata for relationship mapping */
  metadata?: Record<string, unknown>
}

/**
 * Event types emitted during DataObject generation.
 */
export type DataObjectEvent = {
  type: 'object_created' | 'object_updated' | 'relationship_added'
  objectId: string
  data: DataObject
  timestamp: number
}

/**
 * Callback function type for DataObject events.
 */
export type DataObjectEventCallback = (event: DataObjectEvent) => void
