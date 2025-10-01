import type {
  DataObject,
  DataObjectEvent,
  DataObjectEventCallback,
  ObjectRelationship,
  VerifierRelationshipConfig,
} from '../types'

/**
 * Global DataObject Collector - Singleton class for managing DataObject generation
 * and relationships during TEE verification processes.
 */
class DataObjectCollector {
  private static instance: DataObjectCollector
  private dataObjects: Map<string, DataObject> = new Map()
  private relationships: ObjectRelationship[] = []
  private eventCallbacks: DataObjectEventCallback[] = []

  private constructor() {}

  /**
   * Get the singleton instance of DataObjectCollector
   */
  public static getInstance(): DataObjectCollector {
    if (!DataObjectCollector.instance) {
      DataObjectCollector.instance = new DataObjectCollector()
    }
    return DataObjectCollector.instance
  }

  /**
   * Add an event callback for DataObject events
   */
  public addEventListener(callback: DataObjectEventCallback): void {
    this.eventCallbacks.push(callback)
  }

  /**
   * Emit a DataObject event to all registered callbacks
   */
  private emitEvent(
    type: DataObjectEvent['type'],
    objectId: string,
    data: DataObject,
  ): void {
    const event: DataObjectEvent = {
      type,
      objectId,
      data: { ...data }, // Create a copy to prevent mutations
      timestamp: Date.now(),
    }

    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event)
      } catch (error) {
        console.error('Error in DataObject event callback:', error)
      }
    })
  }

  /**
   * Create or update a DataObject
   */
  public createOrUpdateObject(dataObject: DataObject): void {
    const isUpdate = this.dataObjects.has(dataObject.id)
    this.dataObjects.set(dataObject.id, { ...dataObject })

    this.emitEvent(
      isUpdate ? 'object_updated' : 'object_created',
      dataObject.id,
      dataObject,
    )
  }

  /**
   * Get all DataObjects as an array
   */
  public getAllObjects(): DataObject[] {
    return Array.from(this.dataObjects.values())
  }

  /**
   * Add relationships between objects
   */
  public addRelationships(relationships: ObjectRelationship[]): void {
    this.relationships.push(...relationships)
    this.updateObjectRelationships()
  }

  /**
   * Configure verifier relationships
   */
  public configureVerifierRelationships(
    config: VerifierRelationshipConfig,
  ): void {
    this.addRelationships(config.relationships)
  }

  /**
   * Update all objects with their measured-by relationships
   */
  private updateObjectRelationships(): void {
    for (const relationship of this.relationships) {
      const targetObject = this.dataObjects.get(relationship.targetObjectId)
      if (targetObject) {
        if (!targetObject.measuredBy) {
          targetObject.measuredBy = []
        }

        // Check if this relationship already exists
        const existingRelationship = targetObject.measuredBy.find(
          (mb) =>
            mb.objectId === relationship.sourceObjectId &&
            mb.fieldName === relationship.sourceField &&
            mb.selfFieldName === relationship.targetField &&
            mb.calcOutputName === relationship.sourceCalcOutput &&
            mb.selfCalcOutputName === relationship.targetCalcOutput,
        )

        if (!existingRelationship) {
          targetObject.measuredBy.push({
            objectId: relationship.sourceObjectId,
            fieldName: relationship.sourceField,
            selfFieldName: relationship.targetField,
            calcOutputName: relationship.sourceCalcOutput,
            selfCalcOutputName: relationship.targetCalcOutput,
          })

          this.emitEvent('relationship_added', targetObject.id, targetObject)
        }
      }
    }
  }

  /**
   * Clear all DataObjects and relationships
   */
  public clear(): void {
    this.dataObjects.clear()
    this.relationships.length = 0
  }
}

// Export the singleton instance
export const dataObjectCollector = DataObjectCollector.getInstance()

// Export convenience functions
export function createDataObject(dataObject: DataObject): void {
  dataObjectCollector.createOrUpdateObject(dataObject)
}

export function getAllDataObjects(): DataObject[] {
  return dataObjectCollector.getAllObjects()
}

export function addDataObjectRelationships(
  relationships: ObjectRelationship[],
): void {
  dataObjectCollector.addRelationships(relationships)
}

export function configureVerifierRelationships(
  config: VerifierRelationshipConfig,
): void {
  dataObjectCollector.configureVerifierRelationships(config)
}

export function clearAllDataObjects(): void {
  dataObjectCollector.clear()
}

export function addDataObjectEventListener(
  callback: DataObjectEventCallback,
): void {
  dataObjectCollector.addEventListener(callback)
}
