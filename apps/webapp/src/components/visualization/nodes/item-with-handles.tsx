import type React from 'react'

import {cn} from '@/lib/utils'
import {HandleGroup} from './handle-group'
import type {ObjectNodeData} from './types'
import {generateHandleId} from './utils'

interface ItemWithHandlesProps {
  id: string
  item: string
  itemType: 'field' | 'calculation'
  edges: ObjectNodeData['edges']
  selectedObjectId?: string | null
}

export const ItemWithHandles: React.FC<ItemWithHandlesProps> = ({
  id,
  item,
  itemType,
  edges,
  selectedObjectId,
}) => {
  const newItemType = itemType === 'calculation' ? 'output' : 'field'

  // Highlight this row when:
  //   - this node IS the selected one and this item has any outgoing/incoming
  //     edge (i.e. this item is one of the selection's connection points), OR
  //   - this node is NOT selected but has at least one edge whose endpoint on
  //     this side is this item AND whose other endpoint is the selected node.
  const isConnectedToSelection = (() => {
    if (!selectedObjectId) return false
    const leftId = generateHandleId(id, newItemType, item, 'left')
    const rightId = generateHandleId(id, newItemType, item, 'right')
    const possibleHandles = new Set([
      `source-${leftId}`,
      `source-${rightId}`,
      `target-${leftId}`,
      `target-${rightId}`,
    ])

    if (selectedObjectId === id) {
      // Selected node itself — light any item that's actually connected.
      return edges.some(
        (edge) =>
          (edge.source === id && possibleHandles.has(edge.sourceHandle)) ||
          (edge.target === id && possibleHandles.has(edge.targetHandle)),
      )
    }

    // Other node — light only items whose edge goes to the selected node.
    return edges.some((edge) => {
      if (edge.source === id) {
        return (
          edge.target === selectedObjectId && possibleHandles.has(edge.sourceHandle)
        )
      }
      if (edge.target === id) {
        return (
          edge.source === selectedObjectId && possibleHandles.has(edge.targetHandle)
        )
      }
      return false
    })
  })()

  return (
    <li
      className={cn(
        'relative -mx-1 rounded-[2px] px-1 pb-0.5 transition-colors',
        isConnectedToSelection && 'bg-primary/15',
      )}
    >
      <HandleGroup id={id} itemType={newItemType} item={item} edges={edges} />
      <span
        className={cn(
          itemType === 'calculation'
            ? 'font-mono text-xs italic text-primary'
            : 'text-xs text-foreground',
          isConnectedToSelection &&
            itemType !== 'calculation' &&
            'text-primary-700 dark:text-primary',
        )}
      >
        {item}
      </span>
    </li>
  )
}
