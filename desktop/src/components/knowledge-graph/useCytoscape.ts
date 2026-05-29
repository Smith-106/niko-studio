import { useEffect, useRef, useCallback } from 'react'
import cytoscape, { type Core, type NodeSingular } from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import type {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  GraphLayoutAlgorithm,
} from '@/stores/knowledgeGraphStore'

cytoscape.use(coseBilkent)

const graphStylesheet: cytoscape.Stylesheet[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'text-wrap': 'ellipsis',
      'text-max-width': '80px',
      'font-size': '12px',
      'text-valign': 'center',
      'text-halign': 'center',
      width: 'data(size)',
      height: 'data(size)',
      'background-color': '#4a5568',
      color: '#e2e8f0',
      'border-width': 2,
      'border-color': '#718096',
      'text-outline-color': '#1a202c',
      'text-outline-width': 2,
    },
  },
  {
    selector: 'node[type="obsidian-note"]',
    style: { 'background-color': '#805ad5', 'border-color': '#9f7aea' },
  },
  {
    selector: 'node[type="concept"]',
    style: { 'background-color': '#5b21b6', 'border-color': '#7c3aed' },
  },
  {
    selector: 'node[type="character"]',
    style: { 'background-color': '#38a169', 'border-color': '#48bb78' },
  },
  {
    selector: 'node[type="location"]',
    style: { 'background-color': '#d69e2e', 'border-color': '#ecc94b' },
  },
  {
    selector: 'node[type="ai-suggestion"]',
    style: {
      'background-color': '#ed64a6',
      'border-color': '#f687b3',
      'border-style': 'dashed',
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#4a5568',
      'curve-style': 'bezier',
      opacity: 0.6,
    },
  },
  {
    selector: 'edge[type="wikilink"]',
    style: { 'line-color': '#a0aec0', width: 2 },
  },
  {
    selector: 'edge[type="semantic-similarity"]',
    style: { 'line-color': '#667eea', width: 1, 'line-style': 'dashed' },
  },
  {
    selector: 'edge[type="ai-inferred"]',
    style: { 'line-color': '#ed64a6', width: 1, 'line-style': 'dotted', opacity: 0.4 },
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 4,
      'border-color': '#63b3ed',
      'background-color': '#2b6cb0',
    },
  },
  {
    selector: '.filtered-out',
    style: { opacity: 0.1 },
  },
]

const layoutConfigs: Record<GraphLayoutAlgorithm, cytoscape.LayoutOptions> = {
  'force-directed': { name: 'cose-bilkent', animate: true, animationDuration: 500 },
  radial: { name: 'concentric', animate: true },
  hierarchical: { name: 'breadthfirst', animate: true, spacingFactor: 1.5 },
}

interface UseCytoscapeOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  layout: GraphLayoutAlgorithm
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
}

export function useCytoscape({
  containerRef,
  nodes,
  edges,
  layout,
  onNodeClick,
  onNodeHover,
}: UseCytoscapeOptions) {
  const cyRef = useRef<Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map((n) => ({
          data: { id: n.id, label: n.label, size: Math.max(20, n.size * 10), ...n },
          classes: n.type,
        })),
        ...edges.map((e) => ({
          data: { id: e.id, source: e.source, target: e.target, ...e },
          classes: e.type,
        })),
      ],
      style: graphStylesheet,
      layout: layoutConfigs[layout],
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.3,
    })

    cyRef.current = cy

    if (onNodeClick) {
      cy.on('tap', 'node', (evt) => {
        onNodeClick(evt.target.id())
      })
    }

    if (onNodeHover) {
      cy.on('mouseover', 'node', (evt) => onNodeHover(evt.target.id()))
      cy.on('mouseout', 'node', () => onNodeHover(null))
    }

    return () => cy.destroy()
  }, [containerRef])

  // Update elements incrementally
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().remove()
    cy.add([
      ...nodes.map((n) => ({
        data: { id: n.id, label: n.label, size: Math.max(20, n.size * 10), ...n },
        classes: n.type,
      })),
      ...edges.map((e) => ({
        data: { id: e.id, source: e.source, target: e.target, ...e },
        classes: e.type,
      })),
    ])
    cy.layout(layoutConfigs[layout]).run()
  }, [nodes, edges])

  // Layout change
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.layout(layoutConfigs[layout]).run()
  }, [layout])

  const zoomToFit = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.fit(undefined, 50)
  }, [])

  const highlightNodes = useCallback((ids: string[]) => {
    const cy = cyRef.current
    if (!cy) return
    cy.nodes().removeClass('filtered-out')
    if (ids.length > 0) {
      cy.nodes().not(cy.collection(ids.map((id) => cy.$(`node[id="${id}"]`))).addClass('filtered-out'))
    }
  }, [])

  return { cyRef, zoomToFit, highlightNodes }
}