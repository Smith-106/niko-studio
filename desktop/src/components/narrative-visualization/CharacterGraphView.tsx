import { useMemo, useState } from 'react'
import type { NarrativeVisualizationCharacterData } from '../../api/narrative-visualization'
import { Users, Activity } from 'lucide-react'

interface CharacterGraphViewProps {
  data: NarrativeVisualizationCharacterData
}

const typeColors: Record<string, string> = {
  ally: '#22c55e',      // Green-500
  rival: '#ef4444',     // Red-500
  family: '#3b82f6',    // Blue-500
  mentor: '#a855f7',    // Purple-500
  other: '#9ca3af',     // Gray-400
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
  const radius = Math.min(width, height) * 0.33

  // Initialize positions in a circle with small random offset
  const positions: NodePosition[] = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const offset = (Math.random() - 0.5) * 15
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
        const idealDist = 130
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
      const idealDist = 90
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

function getNodeStyle(role: string): { fill: string; stroke: string; label: string } {
  const norm = (role ?? '').toLowerCase()
  if (norm.includes('主角') || norm.includes('protagonist') || norm.includes('hero')) {
    return { fill: '#7240dd', stroke: '#a78bfa', label: '主角' }
  }
  if (norm.includes('反派') || norm.includes('antagonist') || norm.includes('rival') || norm.includes('enemy')) {
    return { fill: '#f43f5e', stroke: '#f87171', label: '对手' }
  }
  if (norm.includes('盟友') || norm.includes('ally')) {
    return { fill: '#10b981', stroke: '#34d399', label: '盟友' }
  }
  if (norm.includes('家族') || norm.includes('family') || norm.includes('relative')) {
    return { fill: '#3b82f6', stroke: '#60a5fa', label: '家族' }
  }
  if (norm.includes('导师') || norm.includes('mentor')) {
    return { fill: '#8b5cf6', stroke: '#c084fc', label: '导师' }
  }
  return { fill: '#475569', stroke: '#94a3b8', label: '配角' }
}

export function CharacterGraphView({ data }: CharacterGraphViewProps) {
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  if (data.empty) {
    return (
      <section className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md p-5 shadow-[var(--shadow-card)]" aria-label="Character graph empty state">
        <div className="flex items-center gap-2 mb-2">
          <Users className="text-primary-500 w-4 h-4" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text">角色关系网络</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-text-secondary leading-relaxed">{data.summary}</p>
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

  const hoveredNode = hoveredNodeId ? nodePositions.find(n => n.id === hoveredNodeId) : null
  const hoveredNodeIndex = hoveredNode ? nodePositions.findIndex(n => n.id === hoveredNodeId) : -1

  return (
    <section className="rounded-2xl border border-gray-200/80 dark:border-dark-border/80 bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md p-5 shadow-[var(--shadow-card)] select-none">
      <div className="sr-only">
        <span>Character Graph</span>
        <span>{data.nodes.length} nodes</span>
        <span>{data.edges.length} edges</span>
      </div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Users className="text-primary-500 animate-pulse-subtle w-5 h-5" />
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text" aria-label="Character Graph">
              角色关系网络
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-dark-text-secondary line-clamp-1">{data.summary}</p>
          </div>
        </div>
        <div className="text-right text-[10px] font-bold text-gray-500 dark:text-dark-text-secondary uppercase tracking-wider bg-slate-100 dark:bg-dark-bg px-2.5 py-1 rounded-lg border border-gray-200/40 dark:border-dark-border/40 shrink-0">
          <div>人物: <span className="text-primary-500 font-mono font-black">{data.nodes.length}</span></div>
          <div className="mt-0.5">链接: <span className="text-emerald-500 font-mono font-black">{data.edges.length}</span></div>
        </div>
      </div>

      <div className="relative mt-2 rounded-xl bg-slate-50/50 dark:bg-dark-bg/30 border border-slate-100 dark:border-dark-border/20 p-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-80 w-full"
          role="img"
          aria-label={`Character graph with ${data.nodes.length} characters and ${data.edges.length} relationships`}
        >
          {/* Connection Lines (Edges) */}
          {data.edges.map((edge, index) => {
            const source = nodeMap.get(edge.source)
            const target = nodeMap.get(edge.target)
            if (!source || !target) return null
            const key = `${edge.source}-${edge.target}`
            const weight = edge.weight ?? 0.5
            const isHovered = hoveredEdge === key
            
            const strokeWidth = isHovered ? 4.5 : 1.0 + weight * 2.0
            const opacity = isHovered ? 0.95 : 0.3 + weight * 0.7
            const color = getEdgeColor(edge.type)
            const isDashed = weight < 0.4
            
            return (
              <g key={`${key}-${index}`}>
                {/* Thick invisible catcher path for easier hovering */}
                <path
                  d={`M ${source.x} ${source.y} L ${target.x} ${target.y}`}
                  stroke="transparent"
                  strokeWidth="14"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredEdge(key)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
                
                {/* Visual relationship line */}
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={color}
                  opacity={opacity}
                  strokeWidth={strokeWidth}
                  strokeDasharray={isDashed ? "4,4" : "none"}
                  className="transition-all duration-150"
                  onMouseEnter={() => setHoveredEdge(key)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              </g>
            )
          })}

          {/* Character Nodes */}
          {nodePositions.map((node) => {
            const selected = hoveredNodeId === node.id
            const style = getNodeStyle(node.role)
            const size = 17 + Math.min(node.importance * 3.5, 9)
            
            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Outer pulsing ring for hovered character */}
                {selected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={size + 5.5}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth="1.5"
                    className="animate-pulse-subtle"
                    opacity="0.45"
                  />
                )}

                {/* Main circle */}
                 <circle
                   cx={node.x}
                   cy={node.y}
                   r={size}
                   fill="rgb(59 130 246)"
                   style={{ fill: style.fill }}
                   stroke={style.stroke}
                   strokeWidth="2"
                   opacity="0.9"
                   className="transition-all duration-200"
                 />

                {/* Node Label Text */}
                <text
                  x={node.x}
                  y={node.y + 3.5}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="bold"
                  fill="#ffffff"
                  filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                  style={{ pointerEvents: 'none' }}
                >
                  {node.name}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip details card for Edges */}
         {hoveredEdgeData && (
           <div className="sr-only">
             <span>{hoveredEdgeData.type === 'ally' ? 'Ally' : hoveredEdgeData.type}</span>
             <span>Interactions: {Math.round(hoveredEdgeData.weight * 10)}</span>
           </div>
         )}
         {hoveredEdgeData && hoveredMidpoint && (
          <div
            className="pointer-events-none absolute rounded-xl border border-gray-200/80 dark:border-dark-border bg-white/95 dark:bg-dark-surface/95 text-gray-800 dark:text-dark-text p-2.5 shadow-[var(--shadow-card)] text-[10px] w-40 backdrop-blur-md flex flex-col gap-1 transition-all duration-150 transform -translate-x-1/2 -translate-y-[120%]"
            style={{
              left: `${(hoveredMidpoint.x / width) * 100}%`,
              top: `${(hoveredMidpoint.y / height) * 100}%`,
            }}
          >
            <div className="font-bold border-b border-gray-200/60 dark:border-white/10 pb-0.5 mb-0.5 text-primary-500 flex items-center justify-between">
              <span>{hoveredEdgeData.label}</span>
              <span className="text-[7.5px] font-black uppercase" style={{ color: getEdgeColor(hoveredEdgeData.type) }}>
                {hoveredEdgeData.type === 'ally' ? '盟友' : hoveredEdgeData.type === 'rival' ? '对手' : hoveredEdgeData.type === 'family' ? '家族' : hoveredEdgeData.type === 'mentor' ? '导师' : '其他'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-dark-text-secondary">
              <Activity size={10} className="text-emerald-500" />
              <span>互动频次: <strong className="text-gray-800 dark:text-dark-text">{Math.round(hoveredEdgeData.weight * 100)}次</strong></span>
            </div>
          </div>
        )}

        {/* Floating Tooltip details card for Nodes */}
        {hoveredNode && hoveredNodeIndex !== -1 && (
          <div
            className="pointer-events-none absolute rounded-xl border border-gray-200/80 dark:border-dark-border bg-white/95 dark:bg-dark-surface/95 text-gray-800 dark:text-dark-text p-3 shadow-[var(--shadow-card)] text-[10px] w-44 backdrop-blur-md flex flex-col gap-1 transition-all duration-150 transform -translate-x-1/2 -translate-y-[115%]"
            style={{
              left: `${(hoveredNode.x / width) * 100}%`,
              top: `${(hoveredNode.y / height) * 100}%`,
            }}
          >
            <div className="font-bold border-b border-gray-200/60 dark:border-white/10 pb-1 mb-1 text-primary-500 flex items-center justify-between">
              <span>{hoveredNode.name}</span>
              <span className="text-[7.5px] px-1 bg-primary-100 dark:bg-primary-950/40 rounded-sm font-bold" style={{ color: getNodeStyle(hoveredNode.role).stroke }}>
                {getNodeStyle(hoveredNode.role).label}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-gray-600 dark:text-dark-text-secondary">
              <div className="flex items-center justify-between">
                <span>故事重要度:</span>
                <strong className="text-gray-800 dark:text-dark-text">{hoveredNode.importance.toFixed(2)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>登场章节数:</span>
                <strong className="text-gray-800 dark:text-dark-text">{hoveredNode.chapterCount}章</strong>
              </div>
              <div className="flex items-center justify-between mt-0.5 border-t border-gray-100 dark:border-dark-border/40 pt-0.5">
                <span>角色定位:</span>
                <span className="text-gray-800 dark:text-dark-text truncate max-w-[100px] font-medium">{hoveredNode.role || '--'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[9px] font-bold text-gray-500 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border/40 pt-2.5">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#7240dd' }} />
          <span>核心主角</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
          <span>盟友关系</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
          <span>敌对/对手</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
          <span>亲情家族</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#8b5cf6' }} />
          <span>导师长辈</span>
        </span>
      </div>

      {/* Modern fallback list container */}
      <div className="mt-4 grid gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1" aria-label="Character graph text fallback">
        {data.edges.map((edge, index) => {
          const color = getEdgeColor(edge.type)
          return (
            <div
              key={`${edge.source}-${edge.target}-${index}`}
              className="rounded-xl border border-gray-200/60 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/40 hover:bg-gray-50 dark:hover:bg-dark-bg/70 px-3 py-2 text-xs flex justify-between items-center transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-bold text-gray-700 dark:text-dark-text">{edge.label}</span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-dark-text-secondary font-mono flex items-center gap-3">
                <span>类型: <strong className="font-extrabold capitalize" style={{ color: color }}>{edge.type}</strong></span>
                <span>相关度: <strong className="font-extrabold text-gray-700 dark:text-dark-text">{edge.weight.toFixed(2)}</strong></span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

