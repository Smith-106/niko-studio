import type { NarrativeVisualizationTimelineData } from '../../api/narrative-visualization'

interface TimelineViewProps {
  data: NarrativeVisualizationTimelineData
  selectedChapterId: string | null
  onSelectChapter: (chapterId: string) => void
}

export function TimelineView({
  data,
  selectedChapterId,
  onSelectChapter,
}: TimelineViewProps) {
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

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Timeline view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-dark-text-primary">Timeline</h3>
          <p className="mt-1 text-sm text-dark-text-muted">{data.summary}</p>
        </div>
        <div className="text-right text-xs text-dark-text-muted">
          <div>{data.chapters.length} chapters</div>
          <div>{data.events.length} flagged events</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-32 w-full"
        role="img"
        aria-label={`Timeline view with ${data.chapters.length} chapters and ${data.events.length} flagged events`}
      >
        <line x1="32" y1={baseY} x2={width - 32} y2={baseY} stroke="currentColor" opacity="0.25" />
        {data.chapters.map((chapter, index) => {
          const x = 48 + index * ((width - 96) / Math.max(data.chapters.length - 1, 1))
          const selected = selectedChapterId === chapter.chapterId
          return (
            <g key={chapter.chapterId}>
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
