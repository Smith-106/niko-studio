import type { NarrativeVisualizationTensionData } from '../../api/narrative-visualization'

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
  if (data.empty) {
    return (
      <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Tension empty state">
        <h3 className="text-sm font-semibold text-dark-text-primary">Tension Curve</h3>
        <p className="mt-2 text-sm text-dark-text-muted">{data.summary}</p>
      </section>
    )
  }

  const width = 640
  const height = 180
  const chartHeight = 110
  const chartTop = 28

  const path = data.points
    .map((point, index) => {
      const x = 40 + index * ((width - 80) / Math.max(data.points.length - 1, 1))
      const y = chartTop + chartHeight - point.tension * chartHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <section className="rounded-2xl border border-dark-border bg-dark-card/80 p-4" aria-label="Tension curve view">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-dark-text-primary">Tension Curve</h3>
          <p className="mt-1 text-sm text-dark-text-muted">{data.summary}</p>
        </div>
        <div className="text-right text-xs text-dark-text-muted">
          <div>arc score {data.overallArcScore}</div>
          <div>{data.deserts.length} low-tension deserts</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-44 w-full"
        role="img"
        aria-label={`Tension curve with ${data.points.length} plotted chapters`}
      >
        <path d={path} fill="none" stroke="rgb(59 130 246)" strokeWidth="3" />
        {data.points.map((point, index) => {
          const x = 40 + index * ((width - 80) / Math.max(data.points.length - 1, 1))
          const y = chartTop + chartHeight - point.tension * chartHeight
          const selected = selectedChapterId === point.chapterId
          return (
            <g key={point.chapterId}>
              <circle
                cx={x}
                cy={y}
                r={selected ? 7 : 5}
                fill={selected ? 'rgb(250 204 21)' : 'rgb(59 130 246)'}
                onClick={() => onSelectChapter(point.chapterId)}
                style={{ cursor: 'pointer' }}
              />
            </g>
          )
        })}
      </svg>

      <div className="mt-4 grid gap-2 text-xs text-dark-text-muted" aria-label="Tension text fallback">
        {data.points.map((point) => (
          <button
            key={point.chapterId}
            type="button"
            className={`rounded-xl border px-3 py-2 text-left ${
              selectedChapterId === point.chapterId
                ? 'border-primary-500 bg-primary-500/10 text-dark-text-primary'
                : 'border-dark-border bg-dark-bg text-dark-text-muted'
            }`}
            onClick={() => onSelectChapter(point.chapterId)}
          >
            <div className="font-medium text-dark-text-primary">{point.label}</div>
            <div className="mt-1">
              tension {point.tension.toFixed(2)} · engagement {point.engagement.toFixed(2)} · emotion {point.dominantEmotion}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
