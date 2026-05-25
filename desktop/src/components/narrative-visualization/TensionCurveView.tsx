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
        {/* engagement curve */}
        {hasReaderState && (
          <path d={engagementPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.7" />
        )}

        {/* immersion curve */}
        {hasReaderState && (
          <path d={immersionPath} fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.7" />
        )}

        {/* tension curve (main) */}
        <path d={tensionPath} fill="none" stroke="rgb(59 130 246)" strokeWidth="3" />

        {/* data points */}
        {data.points.map((point, index) => {
          const x = getX(index)
          const y = getY(point.tension)
          const selected = selectedChapterId === point.chapterId
          const isHighRisk = highRiskSet.has(point.chapterId)
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
              {/* high-risk diamond marker */}
              {isHighRisk && (
                <polygon
                  points={`${x},${y - 10} ${x + 5},${y - 5} ${x},${y} ${x - 5},${y - 5}`}
                  fill="#ef4444"
                  stroke="#ef4444"
                  strokeWidth="1"
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-dark-text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: 'rgb(59 130 246)' }} />
          tension
        </span>
        {hasReaderState && (
          <>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: '#3b82f6' }} />
              engagement
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: '#22c55e' }} />
              immersion
            </span>
          </>
        )}
        {highRiskSet.size > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rotate-45" style={{ backgroundColor: '#ef4444' }} />
            risk
          </span>
        )}
      </div>

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
              {point.readerState && (
                <> · immersion {point.readerState.immersion.toFixed(2)} · curiosity {point.readerState.curiosity.toFixed(2)}</>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
