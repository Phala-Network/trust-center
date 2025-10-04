import type React from 'react'

import {HandleGroup} from './handle-group'
import type {ObjectNodeData} from './types'

interface ItemWithHandlesProps {
  id: string
  item: string
  itemType: 'field' | 'calculation'
  edges: ObjectNodeData['edges']
}

export const ItemWithHandles: React.FC<ItemWithHandlesProps> = ({
  id,
  item,
  itemType,
  edges,
}) => {
  const newItemType = itemType === 'calculation' ? 'output' : 'field'

  return (
    <li className="relative pb-0.5">
      <HandleGroup id={id} itemType={newItemType} item={item} edges={edges} />
      <span className="text-xs">{item}</span>
    </li>
  )
}
