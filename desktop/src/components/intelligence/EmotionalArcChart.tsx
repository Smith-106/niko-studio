import React, { useMemo, useState } from 'react'
import type { EmotionalArcPoint, EmotionalArcResult } from '../../api/writing-craft'

interface EmotionalArcChartProps {
  result: EmotionalArcResult
}

type CurveKey = 'emotionalIntensity' | 'emotionScore' | 'showTellRatio'

const CURVE_LABEL: Record<CurveKey, string> = {
  emotionalIntensity: '情感强度',
  emotionScore: '情绪评分',
  showTellRatio: 'Show 比例',
}

const CURVE_COLOR: Record<CurveKey, string> = {
  emotionalIntensity: '#ec4899',
  emotionScore: '#f59e0b',
  showTellRatio: '#94a3b8',
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function normalize01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return clamp(v, 0, 1)
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
}

function getY(point: EmotionalArcPoint, key: CurveKey): number {
  const raw = (point as unknown as Record<string, unknown>)[key]
  if (typeof raw !== 'number') return 0
  return normalize01(raw)
}

export const EmotionalArcChart: React.FC<EmotionalArcChartProps> = ({ result }) => {
  const [visible, setVisible] = useState<Record<CurveKey, boolean>>({
    emotionalIntensity: true,
    emotionScore: true,
    showTellRatio: false,
  })

  const width = 720
  const height = 220
  const padding = { top: 14, right: 14, bottom: 26, left: 34 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const timeline = result.timeline ?? []

  const deserts = result.tensionDeserts ?? []

  const hover = useState<{ idx: number; x: number; y: number } | null>(null)
  const [hoverPoint, setHoverPoint] = hover

  const xStep = timeline.length > 1 ? plotW / (timeline.length - 1) : plotW / 2

  const curves = useMemo(() => {
    const keys: CurveKey[] = ['emotionalIntensity', 'emotionScore', 'showTellRatio']

    return keys.map((key) => {
      const points = timeline.map((p, i) => {
        const x = timeline.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2
        const y01 = getY(p, key)
        const y = padding.top + plotH - y01 * plotH
        return { x, y, value: y01 }
      })

      return {
        key,
        pathD: buildPath(points),
        points,
      }
    })
  }, [timeline, xStep, plotH, plotW])

  if (timeline.length === 0) {
    return (
      <div className="text-sm text-dark-text-muted py-4 text-center">
        暂无情感弧线数据
      </div>
    )
  }

  const toggle = (key: CurveKey) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const bestMatch = result.curveMatches?.[0] ?? null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-3 flex-wrap">
          {(['emotionalIntensity', 'emotionScore', 'showTellRatio'] as CurveKey[]).map((k) => (
            <label key={k} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={visible[k]}
                onChange={() => toggle(k)}
                className="w-3 h-3"
              />
              <span style={{ color: CURVE_COLOR[k] }}>{CURVE_LABEL[k]}</span>
            </label>
          ))}
        </div>

        {bestMatch && (
          <div className="text-xs text-dark-text-muted">
            最佳曲线匹配：{bestMatch.label}（{Math.round(bestMatch.similarity * 100)}%）
          </div>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* grid */}
        {Array.from({ length: 5 }, (_, i) => {
          const y = padding.top + (plotH / 4) * i
          const val = 1 - (1 / 4) * i
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#333" strokeWidth={0.5} />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fill="#888" fontSize={9}>
                {val.toFixed(2)}
              </text>
            </g>
          )
        })}

        {/* tension deserts */}
        {deserts.map((d, i) => {
          const start = clamp(d.startChapter, 0, timeline.length - 1)
          const end = clamp(d.endChapter, 0, timeline.length - 1)
          if (end <= start) return null

          const x1 = padding.left + start * xStep
          const x2 = padding.left + end * xStep

          const alpha = d.severity === 'high' ? 0.18 : d.severity === 'medium' ? 0.12 : 0.08

          return (
            <rect
              key={i}
              x={x1}
              y={padding.top}
              width={Math.max(0, x2 - x1)}
              height={plotH}
              fill={`rgba(239, 68, 68, ${alpha})`}
            />
          )
        })}

        {/* x labels */}
        {timeline.map((p, i) => {
          const x = timeline.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2
          return (
            <text key={i} x={x} y={height - 6} textAnchor="middle" fill="#888" fontSize={9}>
              {p.chapterIndex + 1}
            </text>
          )
        })}

        {/* curves */}
        {curves
          .filter((c) => visible[c.key])
          .map((c) => (
            <g key={c.key}>
              <path d={c.pathD} fill="none" stroke={CURVE_COLOR[c.key]} strokeWidth={1.6} />
              {c.points.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={3}
                  fill={CURVE_COLOR[c.key]}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverPoint({ idx, x: pt.x, y: pt.y })}
                  onMouseLeave={() => setHoverPoint(null)}
                />
              ))}
            </g>
          ))}

        {hoverPoint && (
          <g>
            <rect
              x={hoverPoint.x - 60}
              y={padding.top - 18}
              width={120}
              height={16}
              fill="#1e1e2e"
              rx={4}
            />
            <text
              x={hoverPoint.x}
              y={padding.top - 7}
              textAnchor="middle"
              fill="#cdd6f4"
              fontSize={10}
            >
              章节 {timeline[hoverPoint.idx]?.chapterIndex + 1}
            </text>
          </g>
        )}
      </svg>

      {result.suggestions?.length ? (
        <div className="text-xs text-dark-text-muted">
          建议：{result.suggestions.slice(0, 2).join('；')}
        </div>
      ) : null}
    </div>
  )
}
