import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

const useCytoscapeMock = vi.hoisted(() => vi.fn())

vi.mock('./useCytoscape', () => ({
  useCytoscape: useCytoscapeMock,
}))

vi.mock('./GraphContextMenu', () => ({
  GraphContextMenu: ({
    nodeId,
    x,
    y,
    onClose,
  }: {
    nodeId: string
    x: number
    y: number
    onClose: () => void
  }) => (
    <button onClick={onClose} type="button">
      {`menu:${nodeId}:${x}:${y}`}
    </button>
  ),
}))

function resetKnowledgeGraphStore() {
  useKnowledgeGraphStore.setState({
    nodes: [
      {
        id: 'node-1',
        label: 'Alpha',
        type: 'note',
        tags: [],
        lastModified: '2026-06-03T00:00:00.000Z',
        size: 8,
        source: 'niko-studio',
      },
    ],
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

async function loadSidebarGraphViewWithOpenMenu() {
  vi.resetModules()
  vi.doMock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react')
    let hookCalls = 0
    return {
      ...actual,
      useState: ((initial: unknown) => {
        hookCalls += 1
        if (hookCalls === 1) {
          return [{ nodeId: 'node-1', x: 10, y: 20 }, vi.fn()] as const
        }
        return actual.useState(initial as never)
      }) as typeof actual.useState,
    }
  })

  const module = await import('./SidebarGraphView')
  vi.doUnmock('react')
  return module.SidebarGraphView
}

describe('SidebarGraphView additional coverage', () => {
  beforeEach(() => {
    resetKnowledgeGraphStore()
    useCytoscapeMock.mockReset()
    vi.restoreAllMocks()
  })

  it('renders the context menu branch when the initial state contains an open menu', async () => {
    const user = userEvent.setup()
    const SidebarGraphView = await loadSidebarGraphViewWithOpenMenu()

    render(<SidebarGraphView />)

    const menuButton = screen.getByText('menu:node-1:10:20')
    expect(menuButton).toBeInTheDocument()

    await user.click(menuButton)
  })
})
