import { useCallback } from 'react'
import type { NarrativeVisualizationTimelineData } from '../../api/narrative-visualization'

const EVENT_TYPE_COLORS: Record<string, string> = {
  turning_point: 'rgb(59 130 246)',
  conflict: 'rgb(239 68 68)',
  warning: 'rgb(245 158 11)',
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
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      if (!onZoomChange) return
      e.preventDefault()
      const nextScale = e.deltaY > 0
        ? Math.max(0.3, zoomScale * 0.9)
        : Math.min(5.0, zoomScale * 1.1)
      onZoomChange(nextScale, zoomOffset)
    },
    [onZoomChange, zoomScale, zoomOffset],
  )

  if (data.empty) {
    return (
      <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Timeline empty state">
        <h3 className="text-sm font-semibold text-dark-text-primary">Timeline</h3>
        <p className="mt-2 text-sm text-dark-text-muted">{data.summary}</p>
      </section>
    )
  }

  const width = 640
  const height = 120
  const baseY = 72
  const filteredEvents = eventFilters
    ? data.events.filter((evt) => eventFilters.includes(evt.type))
    : data.events
  const viewBox = `${zoomOffset.x} ${zoomOffset.y} ${width / zoomScale} ${height / zoomScale}`

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Timeline view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-dark-text-primary">Timeline</h3>
          <p className="mt-1 text-sm text-dark-text-muted">{data.summary}</p>
        </div>
        <div className="text-right text-xs text-dark-text-muted">
          <div>{data.chapters.length} chapters</div>
          <div>{filteredEvents.length} flagged events</div>
        </div>
      </div>

      <svg
        viewBox={viewBox}
        className="mt-4 h-32 w-full"
        role="img"
        aria-label={`Timeline view with ${data.chapters.length} chapters and ${filteredEvents.length} flagged events`}
        onWheel={handleWheel}
      >
        <line x1="32" y1={baseY} x2={width - 32} y2={baseY} stroke="currentColor" opacity="0.25" />
        {data.chapters.map((chapter, index) => {
          const x = 48 + index * ((width - 96) / Math.max(data.chapters.length - 1, 1))
          const selected = selectedChapterId === chapter.chapterId
          return (
            <g key={chapter.chapterId}>
              {selected && (
                <circle
                  cx={x}
                  cy={baseY}
                  r={14}
                  fill="none"
                  stroke="rgb(59 130 246)"
                  strokeWidth={2}
                  opacity={0.6}
                />
              )}
              <circle
                cx={x}
                cy={baseY}
                r={selected ? 10 : 8}
                fill={selected ? 'rgb(59 130 246)' : 'rgb(148 163 184)'}
                onClick={() => onSelectChapter(chapter.chapterId)}
                style={{ cursor: 'pointer' }}
              />
              <text x={x} y={baseY + 24} textAnchor="middle" fontSize="10" fill="currentColor">
                {chapter.chapterNumber}
              </text>
            </g>
          )
        })}
        {filteredEvents.map((evt) => {
          const chapterIndex = data.chapters.findIndex((ch) => ch.chapterIndex === evt.chapterIndex)
          if (chapterIndex < 0) return null
          const x = 48 + chapterIndex * ((width - 96) / Math.max(data.chapters.length - 1, 1))
          const color = EVENT_TYPE_COLORS[evt.type] ?? 'rgb(148 163 184)'
          return (
            <g key={evt.id}>
              <line x1={x} y1={baseY - 12} x2={x} y2={baseY - 28} stroke={color} strokeWidth={1.5} />
              <circle
                cx={x}
                cy={baseY - 32}
                r={4}
                fill={color}
                onClick={() => onSelectChapter(data.chapters[chapterIndex].chapterId)}
                style={{ cursor: 'pointer' }}
              />
              <title>{evt.label}: {evt.description}</title>
            </g>
          )
        })}
      </svg>

      <div className="mt-4 grid gap-2 text-xs text-dark-text-muted" aria-label="Timeline text fallback">
        {data.chapters.map((chapter) => (
          <button
            key={chapter.chapterId}
            type="button"
            className={`rounded-xl border px-3 py-2 text-left ${
              selectedChapterId === chapter.chapterId
                ? 'border-primary-500 bg-primary-500/10 text-dark-text-primary'
                : 'border-dark-border bg-dark-bg text-dark-text-muted'
            }`}
            onClick={() => onSelectChapter(chapter.chapterId)}
          >
            <div className="font-medium text-dark-text-primary">{chapter.label}</div>
            <div className="mt-1">tension {chapter.tension.toFixed(2)} · events {chapter.eventCount}</div>
          </button>
        ))}
      </div>
    </section>
  )
}
