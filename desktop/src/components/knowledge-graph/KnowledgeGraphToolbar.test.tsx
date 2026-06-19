import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

import { KnowledgeGraphToolbar } from './KnowledgeGraphToolbar'

const defaultFilterState = {
  nodeTypes: ['note', 'concept', 'character', 'location', 'ai-suggestion', 'obsidian-note'] as const,
  edgeTypes: ['wikilink', 'reference', 'semantic-similarity', 'shared-tags', 'ai-inferred'] as const,
  tagFilter: [] as string[],
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

describe('KnowledgeGraphToolbar', () => {
  beforeEach(() => {
    localStorage.clear()
    resetKnowledgeGraphStore()
  })

  it('renders graph counts and updates search, filter, layout, and view state', () => {
    useKnowledgeGraphStore.setState({
      nodes: [
        {
          id: 'node-1',
          label: 'Hero',
          type: 'character',
          tags: ['lead'],
          lastModified: '2026-06-03T00:00:00.000Z',
          size: 10,
          source: 'niko-studio',
        },
        {
          id: 'node-2',
          label: 'Vault',
          type: 'note',
          tags: ['world'],
          lastModified: '2026-06-03T00:00:00.000Z',
          size: 8,
          source: 'obsidian',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'reference',
          weight: 0.8,
        },
      ],
      viewMode: 'split',
      layoutAlgorithm: 'force-directed',
      filterState: { ...defaultFilterState, searchQuery: 'old query' },
    })

    render(<KnowledgeGraphToolbar />)

    const searchInput = screen.getByPlaceholderText('搜索节点...') as HTMLInputElement
    const filterButton = screen.getByTitle('过滤')
    const radialButton = screen.getByTitle('径向')
    const sidebarButton = screen.getByTitle('侧栏')

    expect(searchInput.value).toBe('old query')
    expect(screen.getByText('2 节点 · 1 边')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'hero arc' } })
    expect(useKnowledgeGraphStore.getState().filterState.searchQuery).toBe('hero arc')

    expect(filterButton.className).not.toContain('bg-gray-600')
    fireEvent.click(filterButton)
    expect(filterButton.className).toContain('bg-gray-600')

    fireEvent.click(radialButton)
    expect(useKnowledgeGraphStore.getState().layoutAlgorithm).toBe('radial')
    expect(radialButton.className).toContain('bg-blue-600')

    fireEvent.click(sidebarButton)
    expect(useKnowledgeGraphStore.getState().viewMode).toBe('sidebar')
    expect(sidebarButton.className).toContain('bg-blue-600')
  })
})
