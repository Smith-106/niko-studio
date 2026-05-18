import type { NarrativeVisualizationCharacterData } from '../../api/narrative-visualization'

interface CharacterGraphViewProps {
  data: NarrativeVisualizationCharacterData
}

export function CharacterGraphView({ data }: CharacterGraphViewProps) {
  if (data.empty) {
    return (
      <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Character graph empty state">
        <h3 className="text-sm font-semibold text-dark-text-primary">Character Graph</h3>
        <p className="mt-2 text-sm text-dark-text-muted">{data.summary}</p>
      </section>
    )
  }

  const width = 640
  const height = 220
  const columns = Math.min(3, Math.max(1, data.nodes.length))
  const nodePositions = data.nodes.map((node, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return {
      ...node,
      x: 110 + column * 200,
      y: 56 + row * 96,
    }
  })

  const nodeMap = new Map(nodePositions.map((node) => [node.id, node]))

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

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-56 w-full"
        role="img"
        aria-label={`Character graph with ${data.nodes.length} characters and ${data.edges.length} relationships`}
      >
        {data.edges.map((edge, index) => {
          const source = nodeMap.get(edge.source)
          const target = nodeMap.get(edge.target)
          if (!source || !target) return null
          return (
            <g key={`${edge.source}-${edge.target}-${index}`}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="currentColor"
                opacity={Math.max(0.2, edge.weight)}
                strokeWidth={1 + edge.weight * 2}
              />
              <text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 6}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
              >
                {edge.type}
              </text>
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
