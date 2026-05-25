import { useMemo, useState } from 'react'
import type { NarrativeVisualizationCharacterData } from '../../api/narrative-visualization'

interface CharacterGraphViewProps {
  data: NarrativeVisualizationCharacterData
}

const typeColors: Record<string, string> = {
  ally: '#22c55e',
  rival: '#ef4444',
  family: '#3b82f6',
  mentor: '#a855f7',
  other: '#9ca3af',
}

function getEdgeColor(type: string): string {
  return typeColors[type] ?? typeColors.other
}

interface NodePosition {
  id: string
  name: string
  role: string
  importance: number
  chapterCount: number
  x: number
  y: number
}

function computeForceLayout(
  nodes: NarrativeVisualizationCharacterData['nodes'],
  edges: NarrativeVisualizationCharacterData['edges'],
  width: number,
  height: number,
): NodePosition[] {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.35

  // Initialize positions in a circle with small random offset
  const positions: NodePosition[] = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const offset = (Math.random() - 0.5) * 20
    return {
      ...node,
      x: cx + (radius + offset) * Math.cos(angle),
      y: cy + (radius + offset) * Math.sin(angle),
    }
  })

  const nodeMap = new Map(positions.map((p) => [p.id, p]))

  // Run 50 iterations of simplified force simulation
  for (let iter = 0; iter < 50; iter++) {
    const alpha = 1 - iter / 50 // cooling factor

    // Repulsion: push all node pairs apart if too close
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]
        const b = positions[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const idealDist = 120
        if (dist < idealDist) {
          const force = (idealDist - dist) * 0.05 * alpha
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.x -= fx
          a.y -= fy
          b.x += fx
          b.y += fy
        }
      }
    }

    // Attraction: pull connected nodes closer
    for (const edge of edges) {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) continue
      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const idealDist = 80
      const force = (dist - idealDist) * 0.03 * alpha
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      source.x += fx
      source.y += fy
      target.x -= fx
      target.y -= fy
    }

    // Centering: pull all nodes toward center
    for (const pos of positions) {
      pos.x += (cx - pos.x) * 0.01 * alpha
      pos.y += (cy - pos.y) * 0.01 * alpha
    }
  }

  return positions
}

export function CharacterGraphView({ data }: CharacterGraphViewProps) {
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)

  if (data.empty) {
    return (
      <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Character graph empty state">
        <h3 className="text-sm font-semibold text-dark-text-primary">Character Graph</h3>
        <p className="mt-2 text-sm text-dark-text-muted">{data.summary}</p>
      </section>
    )
  }

  const width = 640
  const height = 360

  const nodePositions = useMemo(
    () => computeForceLayout(data.nodes, data.edges, width, height),
    [data.nodes, data.edges, width, height],
  )

  const nodeMap = new Map(nodePositions.map((node) => [node.id, node]))

  const hoveredEdgeData = hoveredEdge ? data.edges.find(
    (e) => `${e.source}-${e.target}` === hoveredEdge,
  ) : null

  const hoveredMidpoint = hoveredEdgeData ? (() => {
    const source = nodeMap.get(hoveredEdgeData.source)
    const target = nodeMap.get(hoveredEdgeData.target)
    if (!source || !target) return null
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
  })() : null

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Character graph view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-dark-text-primary">Character Graph</h3>
          <p className="mt-1 text-sm text-dark-text-muted">{data.summary}</p>
        </div>
        <div className="text-right text-xs text-dark-text-muted">
          <div>{data.nodes.length} nodes</div>
          <div>{data.edges.length} edges</div>
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-80 w-full"
          role="img"
          aria-label={`Character graph with ${data.nodes.length} characters and ${data.edges.length} relationships`}
        >
          {data.edges.map((edge, index) => {
            const source = nodeMap.get(edge.source)
            const target = nodeMap.get(edge.target)
            if (!source || !target) return null
            const key = `${edge.source}-${edge.target}`
            const weight = edge.weight ?? 0.5
            const strokeWidth = 1 + weight * 2
            const opacity = 0.3 + weight * 0.7
            const color = getEdgeColor(edge.type)
            return (
              <g key={`${key}-${index}`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={color}
                  opacity={opacity}
                  strokeWidth={strokeWidth}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredEdge(key)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              </g>
            )
          })}

          {nodePositions.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={18 + Math.min(node.importance, 4)}
                fill="rgb(59 130 246)"
                opacity="0.85"
              />
              <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="white">
                {node.name}
              </text>
            </g>
          ))}
        </svg>

        {hoveredEdgeData && hoveredMidpoint && (
          <div
            className="pointer-events-none absolute rounded bg-white px-2 py-1 text-xs shadow"
            style={{
              left: `${(hoveredMidpoint.x / width) * 100}%`,
              top: `${(hoveredMidpoint.y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-medium text-gray-900">
              {hoveredEdgeData.type.charAt(0).toUpperCase() + hoveredEdgeData.type.slice(1)}
            </div>
            <div className="text-gray-600">
              Interactions: {Math.round(hoveredEdgeData.weight * 10)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-dark-text-muted" aria-label="Character graph text fallback">
        {data.edges.map((edge, index) => (
          <div key={`${edge.source}-${edge.target}-${index}`} className="rounded-xl border border-dark-border bg-dark-bg px-3 py-2">
            <div className="font-medium text-dark-text-primary">{edge.label}</div>
            <div className="mt-1">type {edge.type} · weight {edge.weight.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
