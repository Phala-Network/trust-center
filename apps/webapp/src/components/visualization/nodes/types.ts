import type {Position} from '@xyflow/react'

export interface ObjectNodeData {
  name: string
  fields: string[]
  calculations?: string[]
  isHighlighted: boolean
  isDimmed: boolean
  kind?: 'gateway' | 'kms' | 'app'
  isPlaceholder?: boolean
  edges: Array<{
    id: string
    source: string
    target: string
    sourceHandle: string
    targetHandle: string
  }>
  [key: string]: unknown
}

export interface HandleConfig {
  type: 'target' | 'source'
  position: Position
  id: string
  style: React.CSSProperties
  show: boolean
}
