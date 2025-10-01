import {ReactFlowProvider} from '@xyflow/react'
import type React from 'react'

import LayoutFlow from './nodes/LayoutFlow'

const NodesView: React.FC = () => {
  return (
    <ReactFlowProvider>
      <LayoutFlow />
    </ReactFlowProvider>
  )
}

export default NodesView
