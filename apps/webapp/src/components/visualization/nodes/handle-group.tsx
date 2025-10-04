import {Handle} from '@xyflow/react'
import type React from 'react'
import {useMemo} from 'react'

import type {HandleConfig, ObjectNodeData} from './types'
import {calculateHandleShowProps, createHandleConfigs} from './utils'

interface HandleGroupProps {
  id: string
  itemType: 'object' | 'field' | 'output'
  item?: string
  edges: ObjectNodeData['edges']
}

export const HandleGroup: React.FC<HandleGroupProps> = ({
  id,
  itemType,
  item,
  edges,
}) => {
  const showProps = useMemo(() => {
    return calculateHandleShowProps(id, edges, itemType, item)
  }, [id, edges, itemType, item])

  const configs = createHandleConfigs(id, {itemType, item, ...showProps})

  return (
    <>
      {configs.map((config: HandleConfig) => (
        <Handle
          key={config.id}
          type={config.type}
          position={config.position}
          style={config.style}
          id={config.id}
        />
      ))}
    </>
  )
}
