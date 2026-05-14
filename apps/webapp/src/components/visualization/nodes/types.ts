import type {Position} from '@xyflow/react'

export interface ObjectNodeData {
  name: string
  fields: string[]
  calculations?: string[]
  isHighlighted: boolean
  isDimmed: boolean
  kind?: 'gateway' | 'kms' | 'app'
  /** ID of the node currently selected globally — passed down so each
   *  ItemWithHandles row can highlight when the selection links to it. */
  selectedObjectId?: string | null
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
