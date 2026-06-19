import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const useCytoscapeMock = vi.hoisted(() => vi.fn())

vi.mock('./useCytoscape', () => ({
  useCytoscape: useCytoscapeMock,
}))

vi.mock('./KnowledgeGraphToolbar', () => ({
  KnowledgeGraphToolbar: () => <div data-testid="kg-toolbar">toolbar</div>,
}))

import { KnowledgeGraphView } from './KnowledgeGraphView'

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
    filterState: {
      nodeTypes: ['note', 'concept', 'character', 'location', 'ai-suggestion', 'obsidian-note'],
      edgeTypes: ['wikilink', 'reference', 'semantic-similarity', 'shared-tags', 'ai-inferred'],
      tagFilter: [],
      searchQuery: '',
      minConnectionCount: 0,
    },
    obsidianSyncStatus: 'idle',
    obsidianVaultPath: null,
    lastSyncTimestamp: null,
  })
}

describe('KnowledgeGraphView', () => {
  beforeEach(() => {
    localStorage.clear()
    resetKnowledgeGraphStore()
    useCytoscapeMock.mockReset()
  })

  it('wires the graph hook and renders the selected node details', () => {
    useKnowledgeGraphStore.setState({
      nodes: [
        {
          id: 'node-1',
          label: 'Hero',
          type: 'character',
          tags: [],
          lastModified: '2026-06-03T00:00:00.000Z',
          size: 10,
          source: 'niko-studio',
        },
        {
          id: 'node-2',
          label: 'Vault',
          type: 'note',
          tags: [],
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
          weight: 1,
        },
      ],
      viewMode: 'fullscreen',
      selectedNodeId: 'node-1',
    })

    const { container } = render(<KnowledgeGraphView />)

    expect(screen.getByTestId('kg-toolbar')).toBeInTheDocument()
    expect(screen.getByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('character')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveAttribute('data-view-mode', 'fullscreen')

    const options = useCytoscapeMock.mock.calls[0][0] as {
      layout: string
      nodes: Array<{ id: string }>
      edges: Array<{ id: string }>
      onNodeClick?: (nodeId: string) => void
    }

    expect(options.layout).toBe('force-directed')
    expect(options.nodes).toHaveLength(2)
    expect(options.edges).toHaveLength(1)

    act(() => {
      options.onNodeClick?.('node-2')
    })
    expect(useKnowledgeGraphStore.getState().selectedNodeId).toBe('node-2')
  })

  it('falls back to the selected node id when the node is no longer present', () => {
    useKnowledgeGraphStore.setState({
      nodes: [],
      edges: [],
      selectedNodeId: 'missing-node',
    })

    render(<KnowledgeGraphView />)

    expect(screen.getByText('missing-node')).toBeInTheDocument()
  })
})
