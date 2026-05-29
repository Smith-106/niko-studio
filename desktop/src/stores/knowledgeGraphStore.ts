import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type KnowledgeGraphViewMode = 'fullscreen' | 'split' | 'sidebar' | 'hidden'
export type GraphLayoutAlgorithm = 'force-directed' | 'radial' | 'hierarchical'

export type KnowledgeGraphNode = {
  id: string
  label: string
  type: 'note' | 'concept' | 'character' | 'location' | 'ai-suggestion' | 'obsidian-note'
  tags: string[]
  lastModified: string
  size: number
  source: 'niko-studio' | 'obsidian' | 'ai-generated'
}

export type KnowledgeGraphEdge = {
  id: string
  source: string
  target: string
  type: 'wikilink' | 'reference' | 'semantic-similarity' | 'shared-tags' | 'ai-inferred'
  weight: number
  label?: string
}

export type GraphFilterState = {
  nodeTypes: KnowledgeGraphNode['type'][]
  edgeTypes: KnowledgeGraphEdge['type'][]
  tagFilter: string[]
  searchQuery: string
  minConnectionCount: number
}

export type ObsidianSyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface KnowledgeGraphStore {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  dataLoaded: boolean
  dataError: string | null
  selectedNodeId: string | null
  hoveredNodeId: string | null
  viewMode: KnowledgeGraphViewMode
  layoutAlgorithm: GraphLayoutAlgorithm
  zoomLevel: number
  filterState: GraphFilterState
  obsidianSyncStatus: ObsidianSyncStatus
  obsidianVaultPath: string | null
  lastSyncTimestamp: number | null
  setViewMode: (mode: KnowledgeGraphViewMode) => void
  setLayout: (algo: GraphLayoutAlgorithm) => void
  selectNode: (nodeId: string | null) => void
  updateFilter: (partial: Partial<GraphFilterState>) => void
  setGraphData: (nodes: KnowledgeGraphNode[], edges: KnowledgeGraphEdge[]) => void
  setSyncStatus: (status: ObsidianSyncStatus) => void
  setVaultPath: (path: string | null) => void
  toggleGraphView: () => void
}

const defaultFilter: GraphFilterState = {
  nodeTypes: ['note', 'concept', 'character', 'location', 'ai-suggestion', 'obsidian-note'],
  edgeTypes: ['wikilink', 'reference', 'semantic-similarity', 'shared-tags', 'ai-inferred'],
  tagFilter: [],
  searchQuery: '',
  minConnectionCount: 0,
}

export const useKnowledgeGraphStore = create<KnowledgeGraphStore>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      dataLoaded: false,
      dataError: null,
      selectedNodeId: null,
      hoveredNodeId: null,
      viewMode: 'hidden',
      layoutAlgorithm: 'force-directed',
      zoomLevel: 1,
      filterState: defaultFilter,
      obsidianSyncStatus: 'idle',
      obsidianVaultPath: null,
      lastSyncTimestamp: null,
      setViewMode: (mode) => set({ viewMode: mode }),
      setLayout: (algo) => set({ layoutAlgorithm: algo }),
      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
      updateFilter: (partial) =>
        set((state) => ({ filterState: { ...state.filterState, ...partial } })),
      setGraphData: (nodes, edges) => set({ nodes, edges, dataLoaded: true }),
      setSyncStatus: (status) => set({ obsidianSyncStatus: status }),
      setVaultPath: (path) => set({ obsidianVaultPath: path }),
      toggleGraphView: () => {
        const current = get().viewMode
        set({ viewMode: current === 'hidden' ? 'fullscreen' : 'hidden' })
      },
    }),
    {
      name: 'niko-knowledge-graph',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        layoutAlgorithm: state.layoutAlgorithm,
        obsidianVaultPath: state.obsidianVaultPath,
        filterState: state.filterState,
      }),
    },
  ),
)
