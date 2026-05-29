import { useRef } from 'react'
import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'
import { useCytoscape } from './useCytoscape'
import { KnowledgeGraphToolbar } from './KnowledgeGraphToolbar'
import { invoke } from '@tauri-apps/api/core'

export function KnowledgeGraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    nodes,
    edges,
    viewMode,
    layoutAlgorithm,
    selectedNodeId,
    filterState,
    obsidianSyncStatus,
    setViewMode,
    selectNode,
    setGraphData,
    setSyncStatus,
    setVaultPath,
  } = useKnowledgeGraphStore()

  const { zoomToFit, highlightNodes } = useCytoscape({
    containerRef,
    nodes,
    edges,
    layout: layoutAlgorithm,
    onNodeClick: (nodeId) => selectNode(nodeId),
  })

  // Load vault graph data from Tauri backend
  const loadGraphData = async () => {
    try {
      const result = await invoke<{
        nodes: unknown[]
        edges: unknown[]
      }>('get_vault_graph', { vaultPath: '' })
      // TODO: transform backend data to frontend types
      setGraphData(result.nodes as any, result.edges as any)
    } catch {
      // No vault selected yet — show empty graph
    }
  }

  const filteredNodes = nodes.filter(
    (n) =>
      filterState.nodeTypes.includes(n.type) &&
      (filterState.searchQuery === '' ||
        n.label.toLowerCase().includes(filterState.searchQuery.toLowerCase()) ||
        n.tags.some((t) => t.toLowerCase().includes(filterState.searchQuery.toLowerCase()))) &&
      n.tags.some((t) => filterState.tagFilter.length === 0 || filterState.tagFilter.includes(t)),
  )
  const filteredEdges = edges.filter(
    (e) =>
      filterState.edgeTypes.includes(e.type) &&
      filteredNodes.some((n) => n.id === e.source) &&
      filteredNodes.some((n) => n.id === e.target),
  )

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