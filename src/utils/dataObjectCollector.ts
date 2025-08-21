import type {
  DataObject,
  DataObjectEvent,
  DataObjectEventCallback,
  LogEntry,
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
   * Remove an event callback
   */
  public removeEventListener(callback: DataObjectEventCallback): void {
    const index = this.eventCallbacks.indexOf(callback)
    if (index > -1) {
      this.eventCallbacks.splice(index, 1)
    }
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
      data: {...data}, // Create a copy to prevent mutations
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
    this.dataObjects.set(dataObject.id, {...dataObject})

    this.emitEvent(
      isUpdate ? 'object_updated' : 'object_created',
      dataObject.id,
      dataObject,
    )
  }

  /**
   * Get a DataObject by ID
   */
  public getObject(id: string): DataObject | undefined {
    return this.dataObjects.get(id)
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

  /**
   * Get objects by type
   */
  public getObjectsByType(type: string): DataObject[] {
    return this.getAllObjects().filter((obj) => obj.type === type)
  }

  /**
   * Get objects by kind
   */
  public getObjectsByKind(kind: 'gateway' | 'kms' | 'app'): DataObject[] {
    return this.getAllObjects().filter((obj) => obj.kind === kind)
  }

  /**
   * Get objects by layer
   */
  public getObjectsByLayer(layer: number): DataObject[] {
    return this.getAllObjects().filter((obj) => obj.layer === layer)
  }

  /**
   * Update object fields
   */
  public updateObjectFields(
    objectId: string,
    fields: Record<string, unknown>,
  ): void {
    const existingObject = this.dataObjects.get(objectId)
    if (existingObject) {
      existingObject.fields = {...existingObject.fields, ...fields}
      this.emitEvent('object_updated', objectId, existingObject)
    }
  }

  /**
   * Add calculations to an object
   */
  public addCalculationsToObject(
    objectId: string,
    calculations: Array<{
      inputs: string[]
      calcFunc: string
      outputs: string[]
    }>,
  ): void {
    const existingObject = this.dataObjects.get(objectId)
    if (existingObject) {
      if (!existingObject.calculations) {
        existingObject.calculations = []
      }
      existingObject.calculations.push(...calculations)
      this.emitEvent('object_updated', objectId, existingObject)
    }
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

export function getDataObject(id: string): DataObject | undefined {
  return dataObjectCollector.getObject(id)
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

export function removeDataObjectEventListener(
  callback: DataObjectEventCallback,
): void {
  dataObjectCollector.removeEventListener(callback)
}

export function updateObjectFields(
  objectId: string,
  fields: Record<string, unknown>,
): void {
  dataObjectCollector.updateObjectFields(objectId, fields)
}

export function addCalculationsToObject(
  objectId: string,
  calculations: Array<{
    inputs: string[]
    calcFunc: string
    outputs: string[]
  }>,
): void {
  dataObjectCollector.addCalculationsToObject(objectId, calculations)
}

/**
 * Groups event log entries by their IMR (Index Measurement Register) values.
 *
 * @param eventLog - Array of event log entries with imr property
 * @returns Object with keys being IMR numbers and values being arrays of event log entries
 */
export function groupEventLogsByIMR(
  eventLog: LogEntry[],
): Record<number, LogEntry[]> {
  return eventLog.reduce(
    (groups, entry) => {
      const imr = entry.imr
      if (!groups[imr]) {
        groups[imr] = []
      }
      groups[imr].push(entry)
      return groups
    },
    {} as Record<number, LogEntry[]>,
  )
}

/**
 * Creates DataObjects for event logs grouped by IMR/RTMR values.
 *
 * @param eventLog - Array of event log entries
 * @param objectIdPrefix - Prefix for generating object IDs
 * @param layer - Layer number for the DataObjects
 * @param kind - Kind of verifier ('kms', 'gateway', or 'app')
 * @param type - Type of DataObject based on verifier context
 * @returns Array of DataObjects representing grouped event logs
 */
export function createEventLogDataObjects(
  eventLog: LogEntry[],
  objectIdPrefix: string,
  layer: number,
  kind: 'gateway' | 'kms' | 'app',
  type?: string,
): DataObject[] {
  const groupedLogs = groupEventLogsByIMR(eventLog)
  const dataObjects: DataObject[] = []

  Object.entries(groupedLogs).forEach(([imr, logs]) => {
    const imrNumber = Number(imr)
    const fields: Record<string, unknown> = {}

    // Create numbered event log fields, using event names for RTMR3
    logs.forEach((log, index) => {
      const fieldName =
        imrNumber === 3 && log.event ? log.event : `event_log_${index}`
      fields[fieldName] = JSON.stringify(log)
    })

    // Get description based on IMR number
    const getIMRDescription = (imrNum: number): string => {
      switch (imrNum) {
        case 0:
          return 'Event log entries associated with RTMR0, capturing secure boot and early system measurements.'
        case 1:
          return 'Event log entries associated with RTMR1, capturing kernel and boot services measurements.'
        case 2:
          return 'Event log entries associated with RTMR2, capturing application loader measurements.'
        case 3:
          return 'Event log entries associated with RTMR3, capturing application and runtime system measurements.'
        default:
          return `Event log entries associated with RTMR${imrNum}, capturing system measurements.`
      }
    }

    const dataObject: DataObject = {
      id: `${objectIdPrefix}-imr${imr}`,
      name: `Event Logs for RTMR${imr}`,
      description: getIMRDescription(imrNumber),
      fields,
      layer,
      type: type || 'application_report',
      kind,
      calculations: [
        {
          inputs: ['*'],
          calcFunc: 'replay_rtmr',
          outputs: [`rtmr${imr}`],
        },
      ],
      measuredBy: [
        {
          objectId: `${kind}-main`,
          fieldName: 'event_log',
        },
        {
          selfCalcOutputName: `rtmr${imr}`,
          objectId: `${kind}-quote`,
          fieldName: `rtmr${imr}`,
        },
      ],
    }

    dataObjects.push(dataObject)
  })

  return dataObjects
}
