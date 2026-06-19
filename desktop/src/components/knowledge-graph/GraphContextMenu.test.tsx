import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { useKnowledgeGraphStore } from '@/stores/knowledgeGraphStore'

import { GraphContextMenu } from './GraphContextMenu'

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

describe('GraphContextMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    resetKnowledgeGraphStore()
  })

  it('returns nothing when the target node does not exist', () => {
    const { container } = render(
      <GraphContextMenu nodeId="missing" x={10} y={20} onClose={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('opens and focuses nodes through the shared store', () => {
    useKnowledgeGraphStore.setState({
      nodes: [
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
    })

    const onClose = vi.fn()
    render(<GraphContextMenu nodeId="node-1" x={10} y={20} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '打开笔记' }))
    expect(useKnowledgeGraphStore.getState().selectedNodeId).toBe('node-1')

    fireEvent.click(screen.getByRole('button', { name: '聚焦此节点' }))
    expect(useKnowledgeGraphStore.getState().selectedNodeId).toBe('node-1')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('copies wikilinks and dispatches graph actions', () => {
    useKnowledgeGraphStore.setState({
      nodes: [
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
    })

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const onClose = vi.fn()

    render(<GraphContextMenu nodeId="node-1" x={10} y={20} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '复制 Wikilink' }))
    expect(writeText).toHaveBeenCalledWith('[[Hero]]')

    fireEvent.click(screen.getByRole('button', { name: 'AI 摘要' }))
    fireEvent.click(screen.getByRole('button', { name: '从图谱隐藏' }))

    expect(dispatchSpy.mock.calls[0][0]).toMatchObject({
      type: 'graph-node-action',
      detail: { action: 'ai-summary', nodeId: 'node-1' },
    })
    expect(dispatchSpy.mock.calls[1][0]).toMatchObject({
      type: 'graph-node-action',
      detail: { action: 'hide', nodeId: 'node-1' },
    })
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
