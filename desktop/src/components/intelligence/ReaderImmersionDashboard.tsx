import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  analyzeReaderImmersion,
  type ImmersionResult,
} from '../../api/writing-craft'
import { SectionHeader } from './SectionHeader'
import { ProgressBar } from './ProgressBar'
import { IntelligenceBadge } from './IntelligenceBadge'

interface ReaderImmersionDashboardProps {
  chapters: Array<{ content: string; chapterIndex: number }>
  visible: boolean
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function riskColor(risk: number): string {
  if (risk > 0.6) return 'rgba(239, 68, 68, 0.7)'
  if (risk > 0.3) return 'rgba(245, 158, 11, 0.7)'
  return 'rgba(16, 185, 129, 0.7)'
}

function trajectoryBadge(t: ImmersionResult['trajectory']): { label: string; variant: 'good' | 'warning' | 'bad' | 'neutral' } {
  switch (t) {
    case 'rising':
      return { label: '上升 ↑', variant: 'good' }
    case 'declining':
      return { label: '下降 ↓', variant: 'bad' }
    case 'volatile':
      return { label: '波动 ↕', variant: 'warning' }
    default:
      return { label: '稳定 →', variant: 'neutral' }
  }
}

export const ReaderImmersionDashboard: React.FC<ReaderImmersionDashboardProps> = ({ chapters, visible }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImmersionResult | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!chapters.length) return

    setLoading(true)
    setError(null)
    try {
      const res = await analyzeReaderImmersion(chapters)
      if (res.success && res.data) {
        setResult(res.data)
      } else {
        setError(res.error ?? 'Analysis failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [chapters])

  useEffect(() => {
    if (!visible) return
    void handleAnalyze()
  }, [visible, handleAnalyze])

  const avgImmersionPct = useMemo(() => {
    if (!result) return 0
    return Math.round(clamp(result.averageImmersion, 0, 1) * 100)
  }, [result])

  const avgDropoutPct = useMemo(() => {
    if (!result) return 0
    return Math.round(clamp(result.averageDropoutRisk, 0, 1) * 100)
  }, [result])

  const traj = result ? trajectoryBadge(result.trajectory) : null

  const width = 720
  const height = 200
  const padding = { top: 12, right: 12, bottom: 26, left: 34 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const states = result?.chapterStates ?? []
  const xStep = states.length > 1 ? plotW / (states.length - 1) : plotW / 2

  const pathD = useMemo(() => {
    if (!states.length) return ''
    return states
      .map((s, i) => {
        const x = states.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2
        const y = padding.top + plotH - clamp(s.state.immersion, 0, 1) * plotH
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [states, xStep, plotH, plotW])

  if (!visible) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SectionHeader title="读者沉浸度" />
        <div className="flex items-center gap-2">
          {traj && (
            <IntelligenceBadge variant={traj.variant === 'good' ? 'success' : traj.variant === 'warning' ? 'warning' : traj.variant === 'bad' ? 'danger' : 'warning'}>
              {traj.label}
            </IntelligenceBadge>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading || chapters.length === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-cta text-white
                       disabled:opacity-40 disabled:cursor-not-allowed
                       hover:bg-primary-cta-hover transition-colors"
          >
            {loading ? '分析中...' : '重新分析'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-dark-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">正在分析沉浸度...</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-900/20 border border-red-800/40">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {result && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/20">
              <div className="text-xs text-dark-text-muted">平均沉浸度</div>
              <div className="text-sm font-semibold text-dark-text">{avgImmersionPct}%</div>
              <ProgressBar value={avgImmersionPct} />
            </div>
            <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/20">
              <div className="text-xs text-dark-text-muted">平均流失风险</div>
              <div className="text-sm font-semibold text-dark-text">{avgDropoutPct}%</div>
              <ProgressBar value={avgDropoutPct} />
            </div>
          </div>

          <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
            <div className="text-xs text-dark-text-muted mb-2">沉浸度曲线</div>
            <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
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

              <path d={pathD} fill="none" stroke="#10b981" strokeWidth={1.6} />

              {states.map((s, i) => {
                const x = states.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2
                const y = padding.top + plotH - clamp(s.state.immersion, 0, 1) * plotH
                return (
                  <circle key={i} cx={x} cy={y} r={3} fill="#10b981" />
                )
              })}

              {states.map((s, i) => {
                const x = states.length > 1 ? padding.left + i * xStep : padding.left + plotW / 2
                return (
                  <text key={i} x={x} y={height - 6} textAnchor="middle" fill="#888" fontSize={9}>
                    {s.chapterIndex + 1}
                  </text>
                )
              })}
            </svg>

            <div className="mt-3">
              <div className="text-xs text-dark-text-muted mb-1">Dropout Risk（每章）</div>
              <div className="flex items-center gap-1">
                {states.map((s) => (
                  <div
                    key={s.chapterIndex}
                    className="h-3 flex-1 rounded-sm"
                    title={`Chapter ${s.chapterIndex + 1}: ${Math.round(clamp(s.dropoutRisk, 0, 1) * 100)}%`}
                    style={{ backgroundColor: riskColor(clamp(s.dropoutRisk, 0, 1)) }}
                  />
                ))}
              </div>
            </div>
          </div>

          {result.highRiskChapters?.length ? (
            <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
              <div className="text-sm font-semibold text-dark-text">高风险章节</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.highRiskChapters.map((c) => (
                  <IntelligenceBadge key={c} variant="warning">第 {c + 1} 章</IntelligenceBadge>
                ))}
              </div>
            </div>
          ) : null}

          {result.suggestions?.length ? (
            <div className="text-xs text-dark-text-muted">
              建议：{result.suggestions.slice(0, 3).join('；')}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
