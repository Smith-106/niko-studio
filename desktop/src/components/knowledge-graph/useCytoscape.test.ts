import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphLayoutAlgorithm, KnowledgeGraphEdge, KnowledgeGraphNode } from '@/stores/knowledgeGraphStore'

const cytoscapeFactoryMock = vi.hoisted(() => vi.fn())
const cytoscapeUseMock = vi.hoisted(() => vi.fn())
const coseBilkentMock = vi.hoisted(() => ({ name: 'cose-bilkent-plugin' }))

vi.mock('cytoscape-cose-bilkent', () => ({
  default: coseBilkentMock,
}))

vi.mock('cytoscape', () => {
  const cytoscapeMock = Object.assign(cytoscapeFactoryMock, { use: cytoscapeUseMock })
  return { default: cytoscapeMock }
})

import { useCytoscape } from './useCytoscape'

function createNode(id: string, size = 1): KnowledgeGraphNode {
  return {
    id,
    label: id,
    type: 'character',
    tags: [],
    lastModified: '2026-06-03T00:00:00.000Z',
    size,
    source: 'niko-studio',
  }
}

function createEdge(id: string, source: string, target: string): KnowledgeGraphEdge {
  return {
    id,
    source,
    target,
    type: 'reference',
    weight: 1,
  }
}

function createCyMock() {
  const listeners = new Map<string, (event: { target: { id: () => string } }) => void>()
  const layoutRunMock = vi.fn()
  const layoutMock = vi.fn(() => ({ run: layoutRunMock }))
  const elementsRemoveMock = vi.fn()
  const addMock = vi.fn()
  const fitMock = vi.fn()
  const destroyMock = vi.fn()
  const selectorResult = { kind: 'selector' }
  const selectorMock = vi.fn(() => selectorResult)
  const filteredAddClassMock = vi.fn()
  const filteredNotMock = vi.fn(() => ({ addClass: filteredAddClassMock }))
  const removeClassMock = vi.fn()
  const nodesMock = vi.fn(() => ({
    removeClass: removeClassMock,
    not: filteredNotMock,
  }))
  const onMock = vi.fn(
    (
      event: string,
      selectorOrHandler: string | ((event: { target: { id: () => string } }) => void),
      maybeHandler?: (event: { target: { id: () => string } }) => void,
    ) => {
      const handler = typeof selectorOrHandler === 'function' ? selectorOrHandler : maybeHandler
      if (handler) {
        listeners.set(event, handler)
      }
    },
  )

  const cy = {
    on: onMock,
    destroy: destroyMock,
    elements: vi.fn(() => ({ remove: elementsRemoveMock })),
    add: addMock,
    layout: layoutMock,
    fit: fitMock,
    nodes: nodesMock,
    $: selectorMock,
  }

  return {
    cy,
    listeners,
    layoutMock,
    layoutRunMock,
    elementsRemoveMock,
    addMock,
    fitMock,
    destroyMock,
    selectorMock,
    selectorResult,
    filteredNotMock,
    filteredAddClassMock,
    removeClassMock,
  }
}

describe('useCytoscape', () => {
  beforeEach(() => {
    cytoscapeFactoryMock.mockReset()
    cytoscapeUseMock.mockClear()
  })

  it('initializes cytoscape, wires node events, updates elements, and exposes helper actions', () => {
    const cyMock = createCyMock()
    cytoscapeFactoryMock.mockReturnValue(cyMock.cy)

    const containerRef = {
      current: document.createElement('div'),
    } as React.RefObject<HTMLDivElement | null>
    const onNodeClick = vi.fn()
    const onNodeHover = vi.fn()
    const firstNodes = [createNode('node-1', 1), createNode('node-2', 4)]
    const firstEdges = [createEdge('edge-1', 'node-1', 'node-2')]

    const { result, rerender, unmount } = renderHook(
      ({
        nodes,
        edges,
        layout,
      }: {
        nodes: KnowledgeGraphNode[]
        edges: KnowledgeGraphEdge[]
        layout: GraphLayoutAlgorithm
      }) =>
        useCytoscape({
          containerRef,
          nodes,
          edges,
          layout,
          onNodeClick,
          onNodeHover,
        }),
      {
        initialProps: {
          nodes: firstNodes,
          edges: firstEdges,
          layout: 'force-directed' as GraphLayoutAlgorithm,
        },
      },
    )

    expect(cytoscapeFactoryMock).toHaveBeenCalledTimes(1)

    const initOptions = cytoscapeFactoryMock.mock.calls[0]?.[0]
    expect(initOptions.container).toBe(containerRef.current)
    expect(initOptions.layout).toMatchObject({
      name: 'cose-bilkent',
      animate: true,
      animationDuration: 500,
    })
    expect(initOptions.elements[0]).toMatchObject({
      data: expect.objectContaining({ id: 'node-1', size: 20 }),
      classes: 'character',
    })
    expect(initOptions.elements[1]).toMatchObject({
      data: expect.objectContaining({ id: 'node-2', size: 40 }),
      classes: 'character',
    })
    expect(initOptions.elements[2]).toMatchObject({
      data: expect.objectContaining({ id: 'edge-1' }),
      classes: 'reference',
    })

    expect(cyMock.cy.on).toHaveBeenCalledWith('tap', 'node', expect.any(Function))
    expect(cyMock.cy.on).toHaveBeenCalledWith('mouseover', 'node', expect.any(Function))
    expect(cyMock.cy.on).toHaveBeenCalledWith('mouseout', 'node', expect.any(Function))
    expect(cyMock.layoutMock).toHaveBeenCalledTimes(2)

    act(() => {
      cyMock.listeners.get('tap')?.({ target: { id: () => 'node-2' } })
      cyMock.listeners.get('mouseover')?.({ target: { id: () => 'node-1' } })
      cyMock.listeners.get('mouseout')?.({ target: { id: () => 'node-1' } })
    })

    expect(onNodeClick).toHaveBeenCalledWith('node-2')
    expect(onNodeHover).toHaveBeenNthCalledWith(1, 'node-1')
    expect(onNodeHover).toHaveBeenNthCalledWith(2, null)

    cyMock.layoutMock.mockClear()
    cyMock.layoutRunMock.mockClear()
    cyMock.elementsRemoveMock.mockClear()
    cyMock.addMock.mockClear()

    const updatedNodes = [createNode('node-3', 2)]
    const updatedEdges = [createEdge('edge-2', 'node-3', 'node-1')]
    rerender({
      nodes: updatedNodes,
      edges: updatedEdges,
      layout: 'force-directed',
    })

    expect(cyMock.elementsRemoveMock).toHaveBeenCalledTimes(1)
    expect(cyMock.addMock).toHaveBeenCalledWith([
      expect.objectContaining({
        data: expect.objectContaining({ id: 'node-3', size: 20 }),
        classes: 'character',
      }),
      expect.objectContaining({
        data: expect.objectContaining({ id: 'edge-2' }),
        classes: 'reference',
      }),
    ])
    expect(cyMock.layoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'cose-bilkent' }),
    )
    expect(cyMock.layoutRunMock).toHaveBeenCalledTimes(1)

    cyMock.layoutMock.mockClear()
    cyMock.layoutRunMock.mockClear()

    rerender({
      nodes: updatedNodes,
      edges: updatedEdges,
      layout: 'hierarchical',
    })

    expect(cyMock.layoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'breadthfirst', spacingFactor: 1.5 }),
    )
    expect(cyMock.layoutRunMock).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.zoomToFit()
    })
    expect(cyMock.fitMock).toHaveBeenCalledWith(undefined, 50)

    act(() => {
      result.current.highlightNodes(['node-3'])
    })
    expect(cyMock.removeClassMock).toHaveBeenCalledWith('filtered-out')
    expect(cyMock.selectorMock).toHaveBeenCalledWith('node[id="node-3"]')
    expect(cyMock.filteredNotMock).toHaveBeenCalledWith(cyMock.selectorResult)
    expect(cyMock.filteredAddClassMock).toHaveBeenCalledWith('filtered-out')

    cyMock.filteredNotMock.mockClear()
    cyMock.filteredAddClassMock.mockClear()
    act(() => {
      result.current.highlightNodes([])
    })
    expect(cyMock.removeClassMock).toHaveBeenCalledWith('filtered-out')
    expect(cyMock.filteredNotMock).not.toHaveBeenCalled()
    expect(cyMock.filteredAddClassMock).not.toHaveBeenCalled()

    unmount()
    expect(cyMock.destroyMock).toHaveBeenCalledTimes(1)
  })

  it('safely no-ops when no container is available', () => {
    const cyMock = createCyMock()
    cytoscapeFactoryMock.mockReturnValue(cyMock.cy)

    const containerRef = {
      current: null,
    } as React.RefObject<HTMLDivElement | null>

    const { result, unmount } = renderHook(() =>
      useCytoscape({
        containerRef,
        nodes: [],
        edges: [],
        layout: 'radial',
      }),
    )

    expect(cytoscapeFactoryMock).not.toHaveBeenCalled()

    act(() => {
      result.current.zoomToFit()
      result.current.highlightNodes(['missing'])
    })

    expect(cyMock.fitMock).not.toHaveBeenCalled()
    expect(cyMock.removeClassMock).not.toHaveBeenCalled()

    unmount()
    expect(cyMock.destroyMock).not.toHaveBeenCalled()
  })
})
