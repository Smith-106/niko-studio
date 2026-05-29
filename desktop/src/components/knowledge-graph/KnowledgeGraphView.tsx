import { useRef } from 'react'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useCytoscape } from './useCytoscape'
import { KnowledgeGraphToolbar } from './KnowledgeGraphToolbar'

export function KnowledgeGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    nodes,
    edges,
    viewMode,
    selectedNodeId,
    selectNode,
  } = useKnowledgeGraphStore()

  useCytoscape({
    containerRef,
    nodes,
    edges,
    layout: 'force-directed',
    onNodeClick: (nodeId) => selectNode(nodeId),
  })

  return (
    <div
      className="flex flex-col h-full bg-gray-900"
      data-view-mode={viewMode}
    >
      <KnowledgeGraphToolbar />
      <div ref={containerRef} className="flex-1" />
      {selectedNodeId && (
        <div className="p-3 border-t border-gray-700 bg-gray-800 text-gray-200">
          <p className="font-medium">{nodes.find((n) => n.id === selectedNodeId)?.label ?? selectedNodeId}</p>
          <p className="text-sm text-gray-400">
            {nodes.find((n) => n.id === selectedNodeId)?.type}
          </p>
        </div>
      )}
    </div>
  )
}