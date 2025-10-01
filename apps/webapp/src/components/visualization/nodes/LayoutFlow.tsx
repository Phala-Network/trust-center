import {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type React from 'react'
import {useCallback, useEffect, useState} from 'react'
import '@xyflow/react/dist/style.css'

import {useAttestationData} from '@/components/AttestationDataContext'
import {ObjectNode} from './ObjectNode'
import {
  calculatePosition,
  generateEdgeId,
  generateHandleIdForEdge,
  getEdgeStyle,
  getLayoutPositions,
} from './utils'

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development'

const LayoutFlow: React.FC = () => {
  const {selectedObjectId, setSelectedObjectId, attestationData} =
    useAttestationData()
  const [customPositions, setCustomPositions] = useState<
    Map<string, {x: number; y: number}>
  >(new Map())
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize custom positions
  useEffect(() => {
    const initialPositionsMap = new Map<string, {x: number; y: number}>()
    const initialPositions = getLayoutPositions(attestationData)

    attestationData.forEach((o) => {
      const position = initialPositions[o.id] || {x: 0, y: 0}
      initialPositionsMap.set(o.id, position)
    })
    setCustomPositions(initialPositionsMap)
    setIsInitialized(true)
  }, [attestationData])

  // Create initial elements
  const createInitialElements = useCallback(() => {
    const edges: Edge[] = []
    const nodes: Node[] = []
    const edgeIdCounter = new Map<string, number>()
    const initialPositions = getLayoutPositions(attestationData)

    // Create nodes
    attestationData.forEach((o) => {
      const customPos = customPositions.get(o.id)
      const position = calculatePosition(customPos, initialPositions[o.id])
      const calculations = o.calculations?.flatMap((calc) => calc.outputs) || []
      const uniqueCalculations = [...new Set(calculations)]

      nodes.push({
        id: o.id,
        type: 'objectNode',
        data: {
          name: o.name,
          fields: Object.keys(o.fields),
          calculations:
            uniqueCalculations.length > 0 ? uniqueCalculations : undefined,
          isHighlighted: false,
          isDimmed: false,
          kind: o.kind,
          isPlaceholder: o.isPlaceholder,
          edges: [],
        },
        position,
        selected: selectedObjectId === o.id,
      })
    })

    // Create edges
    for (const targetObj of attestationData) {
      if (!targetObj.measuredBy) continue

      for (const ref of targetObj.measuredBy) {
        const sourceObj = attestationData.find((obj) => obj.id === ref.objectId)
        if (!sourceObj) continue

        const sourceNode = nodes.find((n) => n.id === sourceObj.id)
        const targetNode = nodes.find((n) => n.id === targetObj.id)
        if (!sourceNode || !targetNode) continue

        const sourceIsLeft = sourceNode.position.x < targetNode.position.x
        const sourceHandle = generateHandleIdForEdge(
          sourceObj,
          ref,
          sourceIsLeft,
          true,
        )
        const targetHandle = generateHandleIdForEdge(
          targetObj,
          ref,
          sourceIsLeft,
          false,
        )
        const uniqueEdgeId = generateEdgeId(
          sourceObj,
          targetObj,
          ref,
          edgeIdCounter,
        )

        const isHighlightedEdge =
          selectedObjectId === sourceObj.id || selectedObjectId === targetObj.id
        const isDimmedEdge = selectedObjectId !== null && !isHighlightedEdge

        edges.push({
          id: uniqueEdgeId,
          source: sourceObj.id,
          sourceHandle,
          target: targetObj.id,
          targetHandle,
          animated: true,
          style: getEdgeStyle(isHighlightedEdge, isDimmedEdge),
        })
      }
    }

    // Update node data with connection information
    nodes.forEach((node) => {
      const isHighlighted = selectedObjectId === node.id
      const isDimmed =
        selectedObjectId !== null &&
        !isHighlighted &&
        !edges.some(
          (edge) =>
            (edge.source === selectedObjectId && edge.target === node.id) ||
            (edge.target === selectedObjectId && edge.source === node.id),
        )

      const nodeEdges = edges
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
        }))

      node.data = {...node.data, isHighlighted, isDimmed, edges: nodeEdges}
    })

    return {nodes, edges}
  }, [selectedObjectId, customPositions, attestationData])

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])

  useEffect(() => {
    if (!isInitialized) return
    const {nodes: newNodes, edges: newEdges} = createInitialElements()
    setNodes(newNodes)
    setEdges(newEdges)
  }, [isInitialized, createInitialElements, setNodes, setEdges])

  const nodeTypes = {objectNode: ObjectNode}

  // Update node highlighting
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => {
        const isHighlighted = selectedObjectId === node.id
        const isDimmed =
          selectedObjectId !== null &&
          !isHighlighted &&
          !prevNodes.some(
            (n) =>
              n.id === selectedObjectId &&
              edges.some(
                (edge) =>
                  (edge.source === selectedObjectId &&
                    edge.target === node.id) ||
                  (edge.target === selectedObjectId && edge.source === node.id),
              ),
          )
        return {...node, data: {...node.data, isHighlighted, isDimmed}}
      }),
    )
  }, [selectedObjectId, edges, setNodes])

  // Update edge highlighting
  useEffect(() => {
    setEdges((prevEdges) =>
      prevEdges.map((edge) => {
        const isHighlightedEdge =
          selectedObjectId === edge.source || selectedObjectId === edge.target
        const isDimmedEdge = selectedObjectId !== null && !isHighlightedEdge
        return {...edge, style: getEdgeStyle(isHighlightedEdge, isDimmedEdge)}
      }),
    )
  }, [selectedObjectId, setEdges])

  const handleNodeClick: NodeMouseHandler = (
    _event: React.MouseEvent,
    node: Node,
  ) => {
    if (node?.id) {
      const dataObject = attestationData.find((o) => o.id === node.id)
      // Don't allow selection of placeholder objects
      if (dataObject && !dataObject.isPlaceholder) {
        setSelectedObjectId(node.id)
      }
    }
  }

  const handlePaneClick = () => {
    setSelectedObjectId(null)
  }

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    setCustomPositions((prev) => {
      const newPositions = new Map(prev)
      const roundedPosition = {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      }
      newPositions.set(node.id, roundedPosition)

      if (isDevelopment) {
        const allPositions = Object.fromEntries(
          Array.from(newPositions.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
          ),
        )
        console.log('All node positions after drag:', allPositions)
      }

      return newPositions
    })
  }, [])

  return (
    <div className="h-full min-h-[400px] w-full">
      {isInitialized && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          nodesDraggable={isDevelopment}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={false}
          preventScrolling={true}
          minZoom={0.1}
        >
          <Controls />
          <Background gap={16} size={1} />
        </ReactFlow>
      )}
    </div>
  )
}

export default LayoutFlow
