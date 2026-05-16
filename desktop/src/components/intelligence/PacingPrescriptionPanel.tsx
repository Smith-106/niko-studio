import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  navigatePacing,
  type PacingNavigatorResult,
  type PacingPrescription,
} from '../../api/writing-craft'
import { SectionHeader } from './SectionHeader'
import { IntelligenceBadge } from './IntelligenceBadge'
import { ProgressBar } from './ProgressBar'

interface PacingPrescriptionPanelProps {
  chapters: Array<{ content: string; chapterIndex: number }>
  visible: boolean
}

function priorityRank(p: PacingPrescription['priority']): number {
  switch (p) {
    case 'high':
      return 0
    case 'medium':
      return 1
    case 'low':
      return 2
    default:
      return 3
  }
}

export const PacingPrescriptionPanel: React.FC<PacingPrescriptionPanelProps> = ({ chapters, visible }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PacingNavigatorResult | null>(null)

  const handleAnalyze = useCallback(async () => {
    if (!chapters.length) return

    setLoading(true)
    setError(null)
    try {
      const res = await navigatePacing(chapters)
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

  const sorted = useMemo(() => {
    const list = result?.prescriptions ?? []
    return [...list].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
  }, [result])

  const pacingPct = useMemo(() => {
    if (!result) return 0
    return Math.max(0, Math.min(100, Math.round(result.pacingScore * 10)))
  }, [result])

  if (!visible) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SectionHeader title="节奏处方" />
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

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-dark-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">正在生成节奏处方...</span>
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
          <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
            <div className="text-xs text-dark-text-muted">节奏评分</div>
            <div className="text-sm font-semibold text-dark-text">{result.pacingScore.toFixed(1)} / 10</div>
            <ProgressBar value={pacingPct} />
          </div>

          <div className="flex flex-col gap-2">
            {sorted.length === 0 ? (
              <div className="text-sm text-dark-text-muted py-4 text-center">暂无处方建议</div>
            ) : (
              sorted.map((p, idx) => (
                <div key={idx} className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <IntelligenceBadge variant={p.priority === 'high' ? 'danger' : p.priority === 'medium' ? 'warning' : 'success'}>
                        {p.label}
                      </IntelligenceBadge>
                      <span className="text-xs text-dark-text-muted">第 {p.chapterIndex + 1} 章</span>
                    </div>
                    <IntelligenceBadge variant={p.priority === 'high' ? 'danger' : p.priority === 'medium' ? 'warning' : 'success'}>
                      {p.priority.toUpperCase()}
                    </IntelligenceBadge>
                  </div>
                  <div className="mt-2 text-sm text-dark-text-muted">{p.reason}</div>
                </div>
              ))
            )}
          </div>

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
