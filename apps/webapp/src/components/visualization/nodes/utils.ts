import {Position} from '@xyflow/react'

import {INITIAL_POSITIONS} from '@/data/positions'
import type {DataObject} from '@/data/schema'
import type {HandleConfig, ObjectNodeData} from './types'

// Color constants
const COLORS = {
  handle: {
    target: {
      background: 'white',
      border: '#bbb',
      shadow: '0 0 0 1px white',
    },
    source: {
      background: '#8884d8',
    },
  },
  edge: {
    default: '#bbb',
    highlighted: '#fbbf24',
  },
} as const

// Handle style constants
const HANDLE_SIZE = 8

// Handle position constants
const HANDLE_HORIZONTAL_OFFSET = -9
const HANDLE_TOP_OFFSET = 8
const HANDLE_OBJECT_HORIZONTAL_OFFSET = -1
const HANDLE_OBJECT_TOP_OFFSET = 18

// Dynamic handle style generator
const createHandleStyle = (
  type: 'target' | 'source',
  position: 'left' | 'right',
  isObject: boolean,
) => {
  const offset = isObject
    ? HANDLE_OBJECT_HORIZONTAL_OFFSET
    : HANDLE_HORIZONTAL_OFFSET
  const topOffset = isObject ? HANDLE_OBJECT_TOP_OFFSET : HANDLE_TOP_OFFSET

  return {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    background:
      type === 'target'
        ? COLORS.handle.target.background
        : COLORS.handle.source.background,
    [position]: offset,
    top: topOffset,
    ...(type === 'target' && {
      border: `2px solid ${COLORS.handle.target.border}`,
      boxShadow: COLORS.handle.target.shadow,
    }),
  }
}

export const generateHandleId = (
  id: string,
  itemType: 'object' | 'field' | 'output',
  item: string | undefined,
  position: 'left' | 'right',
): string => {
  if (itemType === 'object') {
    return `object-${id}-${position}`
  } else if (item) {
    return `${itemType}-${id}-${item}-${position}`
  } else {
    // Fallback for object type without item
    return `object-${id}-${position}`
  }
}

export const generateHandleIdFromRef = (
  obj: DataObject,
  ref: NonNullable<DataObject['measuredBy']>[0],
  sourceIsLeft: boolean,
  isSource: boolean,
): string => {
  const position = sourceIsLeft === isSource ? 'right' : 'left'
  const calcOutputName = isSource ? ref.calcOutputName : ref.selfCalcOutputName
  const fieldName = isSource ? ref.fieldName : ref.selfFieldName

  if (calcOutputName) {
    return generateHandleId(obj.id, 'output', calcOutputName, position)
  } else if (fieldName) {
    return generateHandleId(obj.id, 'field', fieldName, position)
  } else {
    return generateHandleId(obj.id, 'object', undefined, position)
  }
}

export const generateHandleIdForEdge = (
  obj: DataObject,
  ref: NonNullable<DataObject['measuredBy']>[0],
  sourceIsLeft: boolean,
  isSource: boolean,
): string => {
  const baseId = generateHandleIdFromRef(obj, ref, sourceIsLeft, isSource)
  const type = isSource ? 'source' : 'target'
  return `${type}-${baseId}`
}

export const generateEdgeId = (
  sourceObj: DataObject,
  targetObj: DataObject,
  ref: NonNullable<DataObject['measuredBy']>[0],
  edgeIdCounter: Map<string, number>,
): string => {
  const sourceIdentifier = ref.calcOutputName || ref.fieldName || 'object'
  const targetIdentifier =
    ref.selfCalcOutputName || ref.selfFieldName || 'object'
  const baseEdgeId = `${sourceObj.id}->${targetObj.id}-${sourceIdentifier}-${targetIdentifier}`
  const currentCount = edgeIdCounter.get(baseEdgeId) || 0
  const uniqueEdgeId =
    currentCount === 0 ? baseEdgeId : `${baseEdgeId}-${currentCount}`
  edgeIdCounter.set(baseEdgeId, currentCount + 1)
  return uniqueEdgeId
}

export const calculateHandleShowProps = (
  id: string,
  edges: ObjectNodeData['edges'],
  itemType: 'object' | 'field' | 'output',
  item?: string,
) => {
  // Generate all possible handle ids for this item
  const leftId = generateHandleId(id, itemType, item, 'left')
  const rightId = generateHandleId(id, itemType, item, 'right')

  const showTargetLeft = edges.some(
    (edge) => edge.target === id && edge.targetHandle === `target-${leftId}`,
  )
  const showTargetRight = edges.some(
    (edge) => edge.target === id && edge.targetHandle === `target-${rightId}`,
  )
  const showSourceLeft = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === `source-${leftId}`,
  )
  const showSourceRight = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === `source-${rightId}`,
  )

  const result = {
    showTargetLeft,
    showTargetRight,
    showSourceLeft,
    showSourceRight,
  }

  return result
}

// Unified layout selection function
export const getLayoutPositions = (attestationData: DataObject[]) => {
  return INITIAL_POSITIONS
  // const hasAppGpu = attestationData.some((o) => o.id === 'app-gpu')
  // return hasAppGpu ? INITIAL_POSITIONS_GPU : INITIAL_POSITIONS
}

// Unified position calculation function
export const calculatePosition = (
  customPos: {x: number; y: number} | undefined,
  initialPos: {x: number; y: number},
) => {
  const rawPosition = customPos || initialPos || {x: 0, y: 0}
  return {
    x: Math.round(rawPosition.x),
    y: Math.round(rawPosition.y),
  }
}

// Unified style calculation functions
export const getEdgeStyle = (isHighlighted: boolean, isDimmed: boolean) => ({
  stroke: isHighlighted ? COLORS.edge.highlighted : COLORS.edge.default,
  strokeWidth: isHighlighted ? 3 : 2,
  opacity: isDimmed ? 0.3 : 1,
})

// Unified handle configuration generator
export const createHandleConfigs = (
  id: string,
  options: {
    itemType: 'object' | 'field' | 'output'
    item?: string
    showTargetLeft: boolean
    showTargetRight: boolean
    showSourceLeft: boolean
    showSourceRight: boolean
  },
): HandleConfig[] => {
  const {
    itemType,
    item,
    showTargetLeft,
    showTargetRight,
    showSourceLeft,
    showSourceRight,
  } = options
  const isObject = itemType === 'object'

  const allConfigs: HandleConfig[] = [
    {
      type: 'target',
      position: Position.Left,
      id: `target-${generateHandleId(id, itemType, item, 'left')}`,
      style: createHandleStyle('target', 'left', isObject),
      show: showTargetLeft,
    },
    {
      type: 'target',
      position: Position.Right,
      id: `target-${generateHandleId(id, itemType, item, 'right')}`,
      style: createHandleStyle('target', 'right', isObject),
      show: showTargetRight,
    },
    {
      type: 'source',
      position: Position.Left,
      id: `source-${generateHandleId(id, itemType, item, 'left')}`,
      style: createHandleStyle('source', 'left', isObject),
      show: showSourceLeft,
    },
    {
      type: 'source',
      position: Position.Right,
      id: `source-${generateHandleId(id, itemType, item, 'right')}`,
      style: createHandleStyle('source', 'right', isObject),
      show: showSourceRight,
    },
  ]

  // Filter out handles that shouldn't be shown
  return allConfigs.filter((config) => config.show)
}
