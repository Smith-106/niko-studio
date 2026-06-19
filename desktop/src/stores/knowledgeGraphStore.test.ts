import { beforeEach, describe, expect, it } from 'vitest'

import { useKnowledgeGraphStore } from './knowledgeGraphStore'

const defaultFilterState = {
  nodeTypes: ['note', 'concept', 'character', 'location', 'ai-suggestion', 'obsidian-note'],
  edgeTypes: ['wikilink', 'reference', 'semantic-similarity', 'shared-tags', 'ai-inferred'],
  tagFilter: [],
  searchQuery: '',
  minConnectionCount: 0,
}

function resetKnowledgeGraphStore() {
  useKnowledgeGraphStore.setState({
    nodes: [],
    edges: [],
    dataLoaded: false,
    dataError: null,
    selectedNodeId: null,
    hoveredNodeId: null,
    viewMode: 'hidden',
    layoutAlgorithm: 'force-directed',
    zoomLevel: 1,
    filterState: { ...defaultFilterState },
    obsidianSyncStatus: 'idle',
    obsidianVaultPath: null,
    lastSyncTimestamp: null,
  })
}

describe('knowledgeGraphStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetKnowledgeGraphStore()
  })

  it('updates graph data, filters, and view state', () => {
    const nodes = [
      {
        id: 'node-1',
        label: 'Hero',
        type: 'character' as const,
        tags: ['lead'],
        lastModified: '2026-06-03T00:00:00.000Z',
        size: 12,
        source: 'niko-studio' as const,
      },
    ]
    const edges = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'reference' as const,
        weight: 0.8,
        label: 'knows',
      },
    ]

    const store = useKnowledgeGraphStore.getState()
    store.setViewMode('split')
    store.setLayout('radial')
    store.selectNode('node-1')
    store.updateFilter({
      searchQuery: 'Hero',
      tagFilter: ['lead'],
      minConnectionCount: 2,
    })
    store.setGraphData(nodes, edges)
    store.setSyncStatus('synced')
    store.setVaultPath('/vaults/story')

    expect(useKnowledgeGraphStore.getState()).toMatchObject({
      nodes,
      edges,
      dataLoaded: true,
      selectedNodeId: 'node-1',
      viewMode: 'split',
      layoutAlgorithm: 'radial',
      obsidianSyncStatus: 'synced',
      obsidianVaultPath: '/vaults/story',
      filterState: expect.objectContaining({
        searchQuery: 'Hero',
        tagFilter: ['lead'],
        minConnectionCount: 2,
      }),
    })

    useKnowledgeGraphStore.setState({ viewMode: 'hidden' })
    useKnowledgeGraphStore.getState().toggleGraphView()
    expect(useKnowledgeGraphStore.getState().viewMode).toBe('fullscreen')

    useKnowledgeGraphStore.getState().toggleGraphView()
    expect(useKnowledgeGraphStore.getState().viewMode).toBe('hidden')
  })

  it('persists only configuration fields', () => {
    const store = useKnowledgeGraphStore.getState()
    store.setViewMode('sidebar')
    store.setLayout('hierarchical')
    store.selectNode('node-1')
    store.setVaultPath('/vaults/story')
    store.updateFilter({
      searchQuery: 'mystery',
      tagFilter: ['plot'],
    })
    store.setGraphData(
      [
        {
          id: 'node-1',
          label: 'Hero',
          type: 'character',
          tags: [],
          lastModified: '2026-06-03T00:00:00.000Z',
          size: 8,
          source: 'niko-studio',
        },
      ],
      [],
    )

    const persistedRaw = localStorage.getItem('niko-knowledge-graph')
    expect(persistedRaw).toBeTruthy()

    const persisted = JSON.parse(persistedRaw!) as {
      state: Record<string, unknown>
    }

    expect(persisted.state).toEqual({
      viewMode: 'sidebar',
      layoutAlgorithm: 'hierarchical',
      obsidianVaultPath: '/vaults/story',
      filterState: expect.objectContaining({
        searchQuery: 'mystery',
        tagFilter: ['plot'],
      }),
    })
    expect(persisted.state).not.toHaveProperty('nodes')
    expect(persisted.state).not.toHaveProperty('edges')
    expect(persisted.state).not.toHaveProperty('selectedNodeId')
  })

  it('rehydrates persisted config without restoring transient graph data', async () => {
    resetKnowledgeGraphStore()
    localStorage.setItem(
      'niko-knowledge-graph',
      JSON.stringify({
        state: {
          viewMode: 'fullscreen',
          layoutAlgorithm: 'hierarchical',
          obsidianVaultPath: '/vaults/rehydrated',
          filterState: {
            ...defaultFilterState,
            searchQuery: 'rehydrated',
            tagFilter: ['canon'],
          },
        },
        version: 0,
      }),
    )
    await useKnowledgeGraphStore.persist.rehydrate()

    expect(useKnowledgeGraphStore.getState()).toMatchObject({
      nodes: [],
      edges: [],
      dataLoaded: false,
      selectedNodeId: null,
      viewMode: 'fullscreen',
      layoutAlgorithm: 'hierarchical',
      obsidianVaultPath: '/vaults/rehydrated',
      filterState: expect.objectContaining({
        searchQuery: 'rehydrated',
        tagFilter: ['canon'],
      }),
    })
  })
})
