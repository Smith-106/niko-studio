import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useCytoscape } from './useCytoscape'
import { GraphContextMenu } from './GraphContextMenu'
import { useState, useCallback, useRef } from 'react'

export function SidebarGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)

  const {
    nodes,
    edges,
    selectedNodeId,
    selectNode,
  } = useKnowledgeGraphStore()

  // Only show first-degree connections of selected node
  const displayNodes = selectedNodeId
    ? nodes.filter(
        (n) =>
          n.id === selectedNodeId ||
          edges.some((e) => (e.source === selectedNodeId && e.target === n.id) || (e.target === selectedNodeId && e.source === n.id)),
      )
    : nodes.slice(0, 30)

  const displayEdges = edges.filter(
    (e) =>
      displayNodes.some((n) => n.id === e.source) &&
      displayNodes.some((n) => n.id === e.target),
  )

  useCytoscape({
    containerRef,
    nodes: displayNodes,
    edges: displayEdges,
    layout: 'radial',
    onNodeClick: (nodeId) => selectNode(nodeId),
  })

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    // Context menu triggered from Cytoscape event would set this
  }, [])

  return (
    <div className="flex flex-col h-full bg-gray-900 relative" onContextMenu={handleContextMenu}>
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-xs text-gray-400">
          {displayNodes.length} 节点 · {displayEdges.length} 边
          {selectedNodeId && ` · 聚焦: ${nodes.find((n) => n.id === selectedNodeId)?.label}`}
        </span>
      </div>
      <div ref={containerRef} className="flex-1" />
      {contextMenu && (
        <GraphContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
