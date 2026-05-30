import { useState } from 'react'
import type { NarrativeVisualizationTensionData } from '../../api/narrative-visualization'
import { Activity, Flame, Heart, Sparkles } from 'lucide-react'

interface TensionCurveViewProps {
  data: NarrativeVisualizationTensionData
  selectedChapterId: string | null
  onSelectChapter: (chapterId: string) => void
}

export function TensionCurveView({
  data,
  selectedChapterId,
  onSelectChapter,
}: TensionCurveViewProps) {
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null)

  if (data.empty) {
    return (
      <section className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md p-5 shadow-[var(--shadow-card)]" aria-label="Tension empty state">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="text-primary-500 w-4 h-4" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text">叙事张力曲线</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-text-secondary leading-relaxed">{data.summary}</p>
      </section>
    )
  }

  const width = 640
  const height = 180
  const chartHeight = 110
  const chartTop = 28

  const hasReaderState = data.points.length > 0 && data.points[0].readerState != null
  const highRiskSet = new Set(data.highRiskChapters ?? [])

  const xStep = (width - 80) / Math.max(data.points.length - 1, 1)

  function getX(index: number): number {
    return 40 + index * xStep
  }

  function getY(value: number): number {
    return chartTop + chartHeight - value * chartHeight
  }

  const tensionPath = data.points
    .map((point, index) => {
      const x = getX(index)
      const y = getY(point.tension)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Gradient area fill under the curve down to the baseline
  const tensionAreaPath = data.points.length > 0
    ? `${tensionPath} L ${getX(data.points.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`
    : ''

  const engagementPath = hasReaderState
    ? data.points
        .map((point, index) => {
          const x = getX(index)
          const y = getY(point.readerState!.engagement)
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
        })
        .join(' ')
    : ''

  const immersionPath = hasReaderState
    ? data.points
        .map((point, index) => {
          const x = getX(index)
          const y = getY(point.readerState!.immersion)
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
        })
        .join(' ')
    : ''

  const hoveredIndex = data.points.findIndex(p => p.chapterId === hoveredPointId)
  const hoveredPoint = hoveredIndex !== -1 ? data.points[hoveredIndex] : null

  return (
    <section className="rounded-2xl border border-gray-200/80 dark:border-dark-border/80 bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md p-5 shadow-[var(--shadow-card)] select-none">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-primary-500 w-5 h-5 flex items-center justify-center text-lg animate-pulse-subtle" aria-label="flame">🔥</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text" aria-label="Tension Curve">
              叙事张力曲线
              <span className="sr-only">Tension Curve</span>
            </h3>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-dark-text-secondary line-clamp-1">{data.summary}</p>
          </div>
        </div>
        <div className="text-right text-[10px] font-bold text-gray-500 dark:text-dark-text-secondary uppercase tracking-wider bg-slate-100 dark:bg-dark-bg px-2.5 py-1 rounded-lg border border-gray-200/40 dark:border-dark-border/40 shrink-0">
          <div>
            弧线评分: <span className="text-primary-500 font-mono font-black">{`${data.overallArcScore}分`}</span>
            <span className="sr-only">{`arc score ${data.overallArcScore}`}</span>
          </div>
          <div className="mt-0.5">
            <span className="text-amber-500 font-mono font-black">{`${data.deserts.length}个`}</span>张力沙漠
            <span className="sr-only">{`${data.deserts.length} low-tension deserts`}</span>
          </div>
        </div>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
          role="img"
          aria-label={`Tension curve with ${data.points.length} plotted chapters`}
        >
          {/* SVG Gradients and Filters */}
          <defs>
            <linearGradient id="tension-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7240dd" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#7240dd" stopOpacity="0.0" />
            </linearGradient>
            
            <linearGradient id="tension-stroke-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7240dd" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>

            <filter id="neon-glow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="32" y1={getY(0)} x2={width - 32} y2={getY(0)} stroke="currentColor" className="text-slate-200 dark:text-dark-border/40" strokeWidth="1" />
          <line x1="32" y1={getY(0.5)} x2={width - 32} y2={getY(0.5)} stroke="currentColor" className="text-slate-200 dark:text-dark-border/30" strokeDasharray="3,3" strokeWidth="1" />
          <line x1="32" y1={getY(1)} x2={width - 32} y2={getY(1)} stroke="currentColor" className="text-slate-200 dark:text-dark-border/40" strokeWidth="1" />

          {/* Area under tension curve */}
          {hasReaderState && data.points.length > 0 && (
            <path d={tensionAreaPath} fill="url(#tension-area-grad)" />
          )}

          {/* engagement curve */}
          {hasReaderState && (
            <path d={engagementPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />
          )}

          {/* immersion curve */}
          {hasReaderState && (
            <path d={immersionPath} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />
          )}

          {/* tension curve (main) with glow */}
          <path d={tensionPath} fill="none" stroke="rgb(59 130 246)" style={{ stroke: 'url(#tension-stroke-grad)' }} strokeWidth="3" filter="url(#neon-glow)" strokeLinecap="round" />

          {/* data points */}
          {data.points.map((point, index) => {
            const x = getX(index)
            const y = getY(point.tension)
            const selected = selectedChapterId === point.chapterId
            const isHighRisk = highRiskSet.has(point.chapterId)
            const isHovered = hoveredPointId === point.chapterId
            
            return (
              <g key={point.chapterId} className="transition-all duration-300">
                {/* Large transparent catcher circle for easy mousehover */}
                <circle
                  cx={x}
                  cy={y}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPointId(point.chapterId)}
                  onMouseLeave={() => setHoveredPointId(null)}
                  onClick={() => onSelectChapter(point.chapterId)}
                />

                {/* Outer halo when active or selected */}
                {(selected || isHovered) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={selected ? 10 : 8}
                    fill="none"
                    stroke={selected ? "#fa4" : "#7240dd"}
                    strokeWidth="1.5"
                    className="animate-pulse-subtle"
                    opacity="0.6"
                  />
                )}

                {/* Main point circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={selected ? 7 : isHovered ? 6 : 5}
                  fill={selected ? "#eab308" : "#7240dd"}
                  className="cursor-pointer transition-all shadow-sm"
                  stroke={selected ? "#fff" : "none"}
                  strokeWidth="1"
                />

                {/* high-risk diamond marker */}
                {isHighRisk && (
                  <polygon
                    points={`${x},${y - 12} ${x + 4.5},${y - 7.5} ${x},${y - 3} ${x - 4.5},${y - 7.5}`}
                    fill="#ef4444"
                    className="animate-pulse-subtle shadow-sm"
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip details card */}
        {hoveredPoint && hoveredIndex !== -1 && (
          <div
            className="absolute z-20 pointer-events-none rounded-xl border border-gray-200/80 dark:border-dark-border bg-white/95 dark:bg-dark-surface/95 text-gray-800 dark:text-dark-text p-3 shadow-[var(--shadow-card)] text-[10px] w-48 backdrop-blur-md flex flex-col gap-1 transition-all duration-150 transform -translate-x-1/2 -translate-y-[115%]"
            style={{
              left: `${(getX(hoveredIndex) / width) * 100}%`,
              top: `${(getY(hoveredPoint.tension) / height) * 100}%`,
            }}
          >
            <div className="font-bold border-b border-gray-200/60 dark:border-white/10 pb-1 mb-1 text-primary-500 flex items-center justify-between">
              <span className="truncate max-w-[130px]">{hoveredPoint.label}</span>
              <span className="text-[8px] bg-primary-100 dark:bg-primary-950/40 px-1 rounded-sm">{hoveredPoint.dominantEmotion}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600 dark:text-dark-text-secondary">
              <div className="flex items-center gap-1">
                <Flame size={10} className="text-amber-500" />
                <span>张力: <span className="font-bold text-gray-800 dark:text-dark-text">{hoveredPoint.tension.toFixed(2)}</span></span>
              </div>
              <div className="flex items-center gap-1">
                <Activity size={10} className="text-blue-500" />
                <span>参与度: <span className="font-bold text-gray-800 dark:text-dark-text">{hoveredPoint.engagement.toFixed(2)}</span></span>
              </div>
              {hoveredPoint.readerState && (
                <>
                  <div className="flex items-center gap-1">
                    <Heart size={10} className="text-emerald-500" />
                    <span>沉浸: <span className="font-bold text-gray-800 dark:text-dark-text">{hoveredPoint.readerState.immersion.toFixed(2)}</span></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles size={10} className="text-purple-500" />
                    <span>猎奇: <span className="font-bold text-gray-800 dark:text-dark-text">{hoveredPoint.readerState.curiosity.toFixed(2)}</span></span>
                  </div>
                </>
              )}
            </div>
            <div className="text-[7.5px] text-gray-400 dark:text-dark-text-muted mt-1 uppercase tracking-wider text-center font-bold">点击节点定位编辑器</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-gray-500 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border/40 pt-2.5">
        <span className="flex items-center gap-1.5 cursor-help" title="核心情节的张力大小">
          <span className="inline-block h-1.5 w-4 rounded-full bg-gradient-to-r from-primary-500 to-indigo-500" />
          <span>核心张力</span>
          <span className="sr-only">tension</span>
        </span>
        {hasReaderState && (
          <>
            <span className="flex items-center gap-1.5 cursor-help" title="读者关注情节的强烈程度">
              <span className="inline-block h-0.5 w-4 rounded bg-blue-500 opacity-60 border-t border-dashed border-blue-500" />
              <span>读者参与度</span>
              <span className="sr-only">engagement</span>
            </span>
            <span className="flex items-center gap-1.5 cursor-help" title="读者的主观沉浸分数">
              <span className="inline-block h-0.5 w-4 rounded bg-emerald-500 opacity-60 border-t border-dashed border-emerald-500" />
              <span>沉浸分数</span>
              <span className="sr-only">immersion</span>
            </span>
          </>
        )}
        {highRiskSet.size > 0 && (
          <span className="flex items-center gap-1.5 cursor-help" title="张力起伏存在崩塌或枯燥风险">
            <span className="inline-block h-2 w-2 rotate-45 bg-red-500" />
            <span>节奏风险区</span>
            <span className="sr-only">risk</span>
          </span>
        )}
      </div>

      {/* Modern responsive list container */}
      <div className="mt-4 grid gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1" aria-label="Tension text fallback">
        {data.points.map((point) => {
          const selected = selectedChapterId === point.chapterId
          return (
            <button
              key={point.chapterId}
              type="button"
              className={`rounded-xl border p-2.5 text-left transition-all duration-200 ${
                selected
                  ? 'border-primary-500 bg-primary-600/5 dark:bg-primary-900/15 shadow-[0_2px_8px_rgba(114,64,221,0.06)] scale-[1.01] glow-primary'
                  : 'border-gray-200/60 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/40 hover:bg-gray-50 dark:hover:bg-dark-bg/70 text-gray-500 dark:text-dark-text-secondary hover:border-gray-300 dark:hover:border-dark-border2'
              }`}
              onClick={() => onSelectChapter(point.chapterId)}
            >
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-bold ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-dark-text'}`}>
                  {point.label}
                </span>
                <span className="text-[8px] bg-slate-100 dark:bg-dark-surface px-1.5 py-0.5 rounded font-black uppercase text-gray-500 dark:text-dark-text-secondary">
                  {point.dominantEmotion}
                </span>
              </div>
              <div className="mt-1 text-[9px] text-gray-500 dark:text-dark-text-secondary font-mono flex items-center justify-between">
                <span>张力: <strong className="font-extrabold text-gray-700 dark:text-dark-text">{point.tension.toFixed(2)}</strong></span>
                <span>参与度 (engagement): <strong className="font-extrabold text-gray-700 dark:text-dark-text">{point.engagement.toFixed(2)}</strong></span>
                {point.readerState && (
                  <>
                    <span>沉浸 (immersion): <strong className="font-extrabold text-gray-700 dark:text-dark-text">{point.readerState.immersion.toFixed(2)}</strong></span>
                    <span>猎奇 (curiosity): <strong className="font-extrabold text-gray-700 dark:text-dark-text">{point.readerState.curiosity.toFixed(2)}</strong></span>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

