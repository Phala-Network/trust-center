/**
 * UI Export Module for DStack Verifier
 *
 * This module provides a clean interface for UI consumption of DataObjects
 * generated during TEE verification processes. It includes utilities for
 * real-time data access, event listening, and relationship management.
 */

import type {
  DataObject,
  DataObjectEvent,
  DataObjectEventCallback,
  ObjectRelationship,
  VerifierMetadata,
  VerifierRelationshipConfig,
} from './types'

import {
  addCalculationsToObject,
  addDataObjectEventListener,
  clearAllDataObjects,
  configureVerifierRelationships,
  dataObjectCollector,
  getAllDataObjects,
  getDataObject,
  removeDataObjectEventListener,
  updateObjectFields,
} from './utils/dataObjectCollector'

/**
 * Main UI interface for accessing verification DataObjects
 */
export class UIDataInterface {
  private eventListeners: DataObjectEventCallback[] = []

  /**
   * Get all generated DataObjects
   */
  public getAllDataObjects(): DataObject[] {
    return getAllDataObjects()
  }

  /**
   * Get a specific DataObject by ID
   */
  public getDataObject(id: string): DataObject | undefined {
    return getDataObject(id)
  }

  /**
   * Get DataObjects filtered by type
   */
  public getDataObjectsByType(type: string): DataObject[] {
    return dataObjectCollector.getObjectsByType(type)
  }

  /**
   * Get DataObjects filtered by kind (kms, gateway, app)
   */
  public getDataObjectsByKind(kind: 'kms' | 'gateway' | 'app'): DataObject[] {
    return dataObjectCollector.getObjectsByKind(kind)
  }

  /**
   * Get DataObjects filtered by layer
   */
  public getDataObjectsByLayer(layer: number): DataObject[] {
    return dataObjectCollector.getObjectsByLayer(layer)
  }

  /**
   * Add an event listener for DataObject changes
   */
  public addEventListener(callback: DataObjectEventCallback): void {
    this.eventListeners.push(callback)
    addDataObjectEventListener(callback)
  }

  /**
   * Remove an event listener
   */
  public removeEventListener(callback: DataObjectEventCallback): void {
    const index = this.eventListeners.indexOf(callback)
    if (index > -1) {
      this.eventListeners.splice(index, 1)
    }
    removeDataObjectEventListener(callback)
  }

  /**
   * Clear all DataObjects and reset the collector
   */
  public clearAll(): void {
    clearAllDataObjects()
  }

  /**
   * Configure relationships between verifiers
   */
  public configureRelationships(config: VerifierRelationshipConfig): void {
    configureVerifierRelationships(config)
  }

  /**
   * Get verification statistics
   */
  public getVerificationStats(): {
    totalObjects: number
    objectsByKind: Record<string, number>
    objectsByType: Record<string, number>
    objectsByLayer: Record<number, number>
  } {
    const allObjects = this.getAllDataObjects()

    const stats = {
      totalObjects: allObjects.length,
      objectsByKind: {} as Record<string, number>,
      objectsByType: {} as Record<string, number>,
      objectsByLayer: {} as Record<number, number>,
    }

    allObjects.forEach((obj) => {
      // Count by kind
      const kind = obj.kind || 'unknown'
      stats.objectsByKind[kind] = (stats.objectsByKind[kind] || 0) + 1

      // Count by type
      stats.objectsByType[obj.type] = (stats.objectsByType[obj.type] || 0) + 1

      // Count by layer
      stats.objectsByLayer[obj.layer] =
        (stats.objectsByLayer[obj.layer] || 0) + 1
    })

    return stats
  }

  /**
   * Export data in JSON format suitable for visualization
   */
  public exportForVisualization(): {
    dataObjects: DataObject[]
    metadata: {
      timestamp: number
      totalObjects: number
      stats: ReturnType<typeof this.getVerificationStats>
    }
  } {
    const dataObjects = this.getAllDataObjects()
    const stats = this.getVerificationStats()

    return {
      dataObjects,
      metadata: {
        timestamp: Date.now(),
        totalObjects: dataObjects.length,
        stats,
      },
    }
  }

  /**
   * Get objects with their relationships resolved
   */
  public getObjectsWithRelationships(): Array<
    DataObject & {
      relationships: {
        measuredBy: Array<{
          object: DataObject | null
          relationship: NonNullable<DataObject['measuredBy']>[0]
        }>
      }
    }
  > {
    const allObjects = this.getAllDataObjects()

    return allObjects.map((obj) => ({
      ...obj,
      relationships: {
        measuredBy: (obj.measuredBy || []).map((relationship) => ({
          object: this.getDataObject(relationship.objectId) || null,
          relationship,
        })),
      },
    }))
  }
}

/**
 * Convenience function to create a new UI data interface
 */
export function createUIInterface(): UIDataInterface {
  return new UIDataInterface()
}

/**
 * Direct exports for advanced usage
 */
export {
  addDataObjectEventListener,
  removeDataObjectEventListener,
  getAllDataObjects,
  getDataObject,
  clearAllDataObjects,
  configureVerifierRelationships,
  updateObjectFields,
  addCalculationsToObject,
}

/**
 * Type exports for UI development
 */
export type {
  DataObject,
  DataObjectEvent,
  DataObjectEventCallback,
  ObjectRelationship,
  VerifierRelationshipConfig,
  VerifierMetadata,
}

/**
 * Default export - ready-to-use UI interface instance
 */
export default createUIInterface()
