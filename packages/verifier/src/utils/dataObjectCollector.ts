import type {
  DataObject,
  DataObjectEvent,
  DataObjectEventCallback,
  ObjectRelationship,
  VerifierRelationshipConfig,
} from '../types'

/**
 * DataObject Collector - Manages DataObject generation and relationships
 * during TEE verification processes.
 *
 * IMPORTANT: Each verification should create its own instance to avoid
 * data pollution between concurrent verifications.
 */
export class DataObjectCollector {
  private dataObjects: Map<string, DataObject> = new Map()
  private relationships: ObjectRelationship[] = []
  private eventCallbacks: DataObjectEventCallback[] = []

  constructor() {}

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
