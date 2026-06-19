import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const useCytoscapeMock = vi.hoisted(() => vi.fn())

vi.mock('./useCytoscape', () => ({
  useCytoscape: useCytoscapeMock,
}))

import { SidebarGraphView } from './SidebarGraphView'

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

describe('SidebarGraphView', () => {
  beforeEach(() => {
    localStorage.clear()
    resetKnowledgeGraphStore()
    useCytoscapeMock.mockReset()
  })

  it('limits the default sidebar view to the first 30 nodes', () => {
    useKnowledgeGraphStore.setState({
      nodes: Array.from({ length: 35 }, (_, index) => ({
        id: `node-${index + 1}`,
        label: `Node ${index + 1}`,
        type: 'note' as const,
        tags: [],
        lastModified: '2026-06-03T00:00:00.000Z',
        size: 8,
        source: 'niko-studio' as const,
      })),
      edges: [],
    })

    render(<SidebarGraphView />)

    const options = useCytoscapeMock.mock.calls[0][0] as {
      layout: string
      nodes: Array<{ id: string }>
      edges: Array<{ id: string }>
    }

    expect(options.layout).toBe('radial')
    expect(options.nodes).toHaveLength(30)
    expect(options.edges).toHaveLength(0)
    expect(screen.getByText(/30 节点/)).toBeInTheDocument()
  })

  it('focuses first-degree connections around the selected node', () => {
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
          label: 'Villain',
          type: 'character',
          tags: [],
          lastModified: '2026-06-03T00:00:00.000Z',
          size: 8,
          source: 'niko-studio',
        },
        {
          id: 'node-3',
          label: 'City',
          type: 'location',
          tags: [],
          lastModified: '2026-06-03T00:00:00.000Z',
          size: 8,
          source: 'obsidian',
        },
        {
          id: 'node-4',
          label: 'Isolated',
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
        {
          id: 'edge-2',
          source: 'node-3',
          target: 'node-1',
          type: 'reference',
          weight: 1,
        },
        {
          id: 'edge-3',
          source: 'node-4',
          target: 'node-2',
          type: 'reference',
          weight: 1,
        },
      ],
      selectedNodeId: 'node-1',
    })

    const { container } = render(<SidebarGraphView />)

    const options = useCytoscapeMock.mock.calls[0][0] as {
      nodes: Array<{ id: string }>
      edges: Array<{ id: string }>
      onNodeClick?: (nodeId: string) => void
    }

    expect(options.nodes.map((node) => node.id)).toEqual(['node-1', 'node-2', 'node-3'])
    expect(options.edges.map((edge) => edge.id)).toEqual(['edge-1', 'edge-2'])
    expect(screen.getByText(/聚焦: Hero/)).toBeInTheDocument()

    act(() => {
      options.onNodeClick?.('node-2')
    })
    expect(useKnowledgeGraphStore.getState().selectedNodeId).toBe('node-2')

    const contextEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })
    container.firstElementChild?.dispatchEvent(contextEvent)
    expect(contextEvent.defaultPrevented).toBe(true)
  })
})
