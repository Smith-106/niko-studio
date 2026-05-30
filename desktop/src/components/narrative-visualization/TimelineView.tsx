import { useState, useCallback } from 'react'
import type { NarrativeVisualizationTimelineData } from '../../api/narrative-visualization'
import { BookOpen, ZoomIn } from 'lucide-react'

const EVENT_TYPE_COLORS: Record<string, string> = {
  turning_point: '#7240dd', // Primary Purple
  conflict: '#f43f5e',      // Rose/Red
  warning: '#eab308',       // Amber/Yellow
}

interface TimelineViewProps {
  data: NarrativeVisualizationTimelineData
  selectedChapterId: string | null
  onSelectChapter: (chapterId: string) => void
  zoomScale?: number
  zoomOffset?: { x: number; y: number }
  onZoomChange?: (scale: number, offset: { x: number; y: number }) => void
  eventFilters?: string[]
}

export function TimelineView({
  data,
  selectedChapterId,
  onSelectChapter,
  zoomScale = 1.0,
  zoomOffset = { x: 0, y: 0 },
  onZoomChange,
  eventFilters,
}: TimelineViewProps) {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null)
  const [hoveredChapterId, setHoveredChapterId] = useState<string | null>(null)

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      if (!onZoomChange) return
      e.preventDefault()
      const nextScale = e.deltaY > 0
        ? Math.max(0.5, zoomScale * 0.9)
        : Math.min(3.0, zoomScale * 1.1)
      onZoomChange(nextScale, zoomOffset)
    },
    [onZoomChange, zoomScale, zoomOffset],
  )

  if (data.empty) {
    return (
      <section className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md p-5 shadow-[var(--shadow-card)]" aria-label="Timeline empty state">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="text-primary-500 w-4 h-4" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text">故事发展时间轴</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-text-secondary leading-relaxed">{data.summary}</p>
      </section>
    )
  }

  const width = 640
  const height = 120
  const baseY = 78
  const filteredEvents = eventFilters
    ? data.events.filter((evt) => eventFilters.includes(evt.type))
    : data.events
  const viewBox = `${zoomOffset.x} ${zoomOffset.y} ${width / zoomScale} ${height / zoomScale}`

  const hoveredEvent = hoveredEventId ? filteredEvents.find(e => e.id === hoveredEventId) : null
  const hoveredChapter = hoveredChapterId ? data.chapters.find(c => c.chapterId === hoveredChapterId) : null

  return (
    <section className="rounded-2xl border border-gray-200/80 dark:border-dark-border/80 bg-white/70 dark:bg-dark-surface/60 backdrop-blur-md p-5 shadow-[var(--shadow-card)] select-none">
      <div className="sr-only">
        <span>Timeline</span>
        <span>{filteredEvents.length} flagged events</span>
      </div>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="text-primary-500 animate-pulse-subtle w-5 h-5" />
          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-dark-text" aria-label="Timeline">故事发展时间轴</h3>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-dark-text-secondary line-clamp-1">{data.summary}</p>
          </div>
        </div>
        <div className="text-right text-[10px] font-bold text-gray-500 dark:text-dark-text-secondary uppercase tracking-wider bg-slate-100 dark:bg-dark-bg px-2.5 py-1 rounded-lg border border-gray-200/40 dark:border-dark-border/40 shrink-0 flex items-center gap-2">
          {onZoomChange && <ZoomIn size={12} className="text-primary-500 animate-pulse-subtle" />}
          <div>
            <div>章节数: <span className="text-primary-500 font-mono font-black">{`${data.chapters.length}章`}</span></div>
            <div className="mt-0.5">关注事件: <span className="text-amber-500 font-mono font-black">{`${filteredEvents.length}个`}</span></div>
          </div>
        </div>
      </div>

      <div className="relative mt-2 rounded-xl bg-slate-50/50 dark:bg-dark-bg/30 border border-slate-100 dark:border-dark-border/20 p-1">
        <svg
          viewBox={viewBox}
          className="h-36 w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`Timeline view with ${data.chapters.length} chapters and ${filteredEvents.length} flagged events`}
          onWheel={handleWheel}
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="timeline-track-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7240dd" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#818cf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Timeline Track Line */}
          <rect x="28" y={baseY - 1.5} width={width - 56} height="3" rx="1.5" fill="url(#timeline-track-grad)" />

          {/* Chapter Nodes */}
          {data.chapters.map((chapter, index) => {
            const x = 48 + index * ((width - 96) / Math.max(data.chapters.length - 1, 1))
            const selected = selectedChapterId === chapter.chapterId
            const isHovered = hoveredChapterId === chapter.chapterId
            
            return (
              <g key={chapter.chapterId}>
                {/* Invisible catcher circle */}
                <circle
                  cx={x}
                  cy={baseY}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredChapterId(chapter.chapterId)}
                  onMouseLeave={() => setHoveredChapterId(null)}
                  onClick={() => onSelectChapter(chapter.chapterId)}
                />

                {/* Outer halo when selected or hovered */}
                {(selected || isHovered) && (
                  <circle
                    cx={x}
                    cy={baseY}
                    r={selected ? 14 : 9}
                    fill="none"
                    stroke={selected ? "rgb(59 130 246)" : "#7240dd"}
                    style={selected ? { stroke: '#eab308', r: 11 } : {}}
                    strokeWidth="1.5"
                    className="animate-pulse-subtle"
                    opacity="0.6"
                  />
                )}

                {/* Main Node Dot */}
                <circle
                  cx={x}
                  cy={baseY}
                  r={selected ? 10 : isHovered ? 6 : 4.5}
                  fill={selected ? "rgb(59 130 246)" : "#7240dd"}
                  style={selected ? { fill: '#eab308', r: 7 } : {}}
                  className="transition-all duration-150 shadow-sm"
                  stroke={selected ? "#ffffff" : "none"}
                  strokeWidth="1"
                />

                {/* Chapter Number text */}
                <text
                  x={x}
                  y={baseY + 18}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="black"
                  fill="currentColor"
                  className="text-gray-500 dark:text-dark-text-secondary"
                >
                  {chapter.chapterNumber}
                </text>
              </g>
            )
          })}

          {/* Event Flags */}
          {filteredEvents.map((evt) => {
            const chapterIndex = data.chapters.findIndex((ch) => ch.chapterIndex === evt.chapterIndex)
            if (chapterIndex < 0) return null
            const x = 48 + chapterIndex * ((width - 96) / Math.max(data.chapters.length - 1, 1))
            const color = EVENT_TYPE_COLORS[evt.type] ?? '#94a3b8'
            const isHovered = hoveredEventId === evt.id
            
            return (
              <g key={evt.id}>
                {/* Vertical accent connector bar */}
                <line
                  x1={x}
                  y1={baseY - 5}
                  x2={x}
                  y2={baseY - 26}
                  stroke={color}
                  strokeWidth={isHovered ? 2.5 : 1.2}
                  opacity={isHovered ? 0.9 : 0.5}
                  className="transition-all duration-150"
                />

                {/* Glowing pin circle */}
                <circle
                  cx={x}
                  cy={baseY - 30}
                  r={isHovered ? 5.5 : 4}
                  fill={color}
                  className="cursor-pointer transition-all shadow"
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 1.5 : 1}
                  onMouseEnter={() => setHoveredEventId(evt.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                  onClick={() => onSelectChapter(data.chapters[chapterIndex].chapterId)}
                />
              </g>
            )
          })}
        </svg>

        {/* Floating Tooltip details card for Events */}
        {hoveredEvent && (() => {
          const chapterIndex = data.chapters.findIndex((ch) => ch.chapterIndex === hoveredEvent.chapterIndex)
          if (chapterIndex < 0) return null
          const x = 48 + chapterIndex * ((width - 96) / Math.max(data.chapters.length - 1, 1))
          
          return (
            <div
              className="pointer-events-none absolute z-20 rounded-xl border border-gray-200/80 dark:border-dark-border bg-white/95 dark:bg-dark-surface/95 text-gray-800 dark:text-dark-text p-2.5 shadow-[var(--shadow-card)] text-[10px] w-48 backdrop-blur-md flex flex-col gap-1 transition-all duration-150 transform -translate-x-1/2 -translate-y-[120%]"
              style={{
                left: `${(x / width) * 100}%`,
                top: `${((baseY - 32) / height) * 100}%`,
              }}
            >
              <div className="font-bold border-b border-gray-200/60 dark:border-white/10 pb-0.5 mb-0.5 text-primary-500 flex items-center justify-between">
                <span className="truncate max-w-[120px]">{hoveredEvent.label}</span>
                <span className="text-[7.5px] px-1 bg-red-100 dark:bg-red-950/40 rounded-sm font-bold" style={{ color: EVENT_TYPE_COLORS[hoveredEvent.type] }}>
                  {hoveredEvent.type === 'turning_point' ? '转折点' : hoveredEvent.type === 'conflict' ? '冲突' : '预警'}
                </span>
              </div>
              <p className="text-[8.5px] text-gray-500 dark:text-dark-text-secondary leading-relaxed line-clamp-2">
                {hoveredEvent.description}
              </p>
            </div>
          )
        })()}

        {/* Floating Tooltip details card for Chapters */}
        {hoveredChapter && (() => {
          const index = data.chapters.findIndex(c => c.chapterId === hoveredChapter.chapterId)
          const x = 48 + index * ((width - 96) / Math.max(data.chapters.length - 1, 1))
          
          return (
            <div
              className="pointer-events-none absolute z-20 rounded-xl border border-gray-200/80 dark:border-dark-border bg-white/95 dark:bg-dark-surface/95 text-gray-800 dark:text-dark-text p-2.5 shadow-[var(--shadow-card)] text-[10px] w-40 backdrop-blur-md flex flex-col gap-1 transition-all duration-150 transform -translate-x-1/2 -translate-y-[115%]"
              style={{
                left: `${(x / width) * 100}%`,
                top: `${(baseY / height) * 100}%`,
              }}
            >
              <div className="font-bold border-b border-gray-200/60 dark:border-white/10 pb-0.5 mb-0.5 text-primary-500 truncate">
                {hoveredChapter.label}
              </div>
              <div className="flex flex-col gap-0.5 text-gray-600 dark:text-dark-text-secondary">
                <div className="flex items-center justify-between">
                  <span>张力评分:</span>
                  <strong className="text-gray-800 dark:text-dark-text">{hoveredChapter.tension.toFixed(2)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>包含事件:</span>
                  <strong className="text-gray-800 dark:text-dark-text">{hoveredChapter.eventCount}个</strong>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[9px] font-bold text-gray-500 dark:text-dark-text-secondary border-t border-gray-100 dark:border-dark-border/40 pt-2.5">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#7240dd' }} />
          <span>核心剧情转折点</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#f43f5e' }} />
          <span>矛盾冲突点</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: '#eab308' }} />
          <span>伏笔/剧情预警</span>
        </span>
      </div>

      {/* Modern responsive list container */}
      <div className="mt-4 grid gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1" aria-label="Timeline text fallback">
        {data.chapters.map((chapter) => {
          const selected = selectedChapterId === chapter.chapterId
          return (
            <button
              key={chapter.chapterId}
              type="button"
              className={`rounded-xl border p-2.5 text-left transition-all duration-200 ${
                selected
                  ? 'border-primary-500 bg-primary-600/5 dark:bg-primary-900/15 shadow-[0_2px_8px_rgba(114,64,221,0.06)] scale-[1.01] glow-primary'
                  : 'border-gray-200/60 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/40 hover:bg-gray-50 dark:hover:bg-dark-bg/70 text-gray-500 dark:text-dark-text-secondary hover:border-gray-300 dark:hover:border-dark-border2'
              }`}
              onClick={() => onSelectChapter(chapter.chapterId)}
            >
              <div className="flex justify-between items-center">
                <span className={`text-[11px] font-bold ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-dark-text'}`}>
                  {chapter.label}
                </span>
                <span className="text-[8px] bg-slate-100 dark:bg-dark-surface px-1.5 py-0.5 rounded font-black uppercase text-gray-500 dark:text-dark-text-secondary">
                  {`${chapter.eventCount}个事件`}
                </span>
              </div>
              <div className="mt-1 text-[9px] text-gray-500 dark:text-dark-text-secondary font-mono flex items-center justify-between">
                <span>张力指数:<strong className="font-extrabold text-gray-700 dark:text-dark-text">{chapter.tension.toFixed(2)}</strong></span>
                <span>章节序号:<strong className="font-extrabold text-gray-700 dark:text-dark-text">{`第${chapter.chapterNumber}章`}</strong></span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

