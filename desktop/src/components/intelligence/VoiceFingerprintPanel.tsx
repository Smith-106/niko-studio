import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  analyzeVoiceConsistency,
  type VoiceFingerprint,
  type VoiceFingerprintResult,
} from '../../api/writing-craft'
import { SectionHeader } from './SectionHeader'
import { ProgressBar } from './ProgressBar'
import { IntelligenceBadge } from './IntelligenceBadge'

interface VoiceFingerprintPanelProps {
  text: string
  visible: boolean
}

function scoreToPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100)))
}

function severityColor(sev: 'low' | 'medium' | 'high'): string {
  switch (sev) {
    case 'high':
      return '#dc2626'
    case 'medium':
      return '#d97706'
    default:
      return '#94a3b8'
  }
}

const VoiceCard: React.FC<{ fp: VoiceFingerprint }> = ({ fp }) => {
  return (
    <div className="p-3 rounded-lg border border-dark-border bg-dark-surface-sunken/30">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-dark-text">{fp.character}</div>
        <div className="text-xs text-dark-text-muted">对话 {fp.dialogueCount} 句</div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <div>
          <div className="text-xs text-dark-text-muted mb-1">正式度</div>
          <ProgressBar value={scoreToPercent(fp.formalityLevel)} />
        </div>
        <div>
          <div className="text-xs text-dark-text-muted mb-1">情感表达倾向</div>
          <ProgressBar value={scoreToPercent(fp.emotionalExpressionTendency)} />
        </div>

        {fp.catchphrases?.length ? (
          <div>
            <div className="text-xs text-dark-text-muted mb-1">口头禅</div>
            <div className="flex flex-wrap gap-1">
              {fp.catchphrases.slice(0, 8).map((c) => (
                <IntelligenceBadge key={c} variant="success">{c}</IntelligenceBadge>
              ))}
            </div>
          </div>
        ) : null}

        {fp.rhetoricalHabits?.length ? (
          <div>
            <div className="text-xs text-dark-text-muted mb-1">修辞习惯</div>
            <div className="flex flex-wrap gap-1">
              {fp.rhetoricalHabits.slice(0, 8).map((h) => (
                <IntelligenceBadge key={h} variant="success">{h}</IntelligenceBadge>
              ))}
            </div>
          </div>
        ) : null}

        {fp.sampleDialogues?.length ? (
          <details>
            <summary className="text-xs text-dark-text-muted cursor-pointer">示例对话</summary>
            <div className="mt-1 text-xs leading-5 text-dark-text-muted whitespace-pre-wrap">
              {fp.sampleDialogues.slice(0, 3).join('\n\n')}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  )
}

export const VoiceFingerprintPanel: React.FC<VoiceFingerprintPanelProps> = ({ text, visible }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VoiceFingerprintResult | null>(null)

  const warnings = result?.warnings ?? []

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await analyzeVoiceConsistency(text)
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
  }, [text])

  useEffect(() => {
    if (!visible) return
    void handleAnalyze()
  }, [visible, handleAnalyze])

  const distinctnessPct = useMemo(() => {
    if (!result) return 0
    return Math.round(Math.max(0, Math.min(1, result.voiceDistinctness)) * 100)
  }, [result])

  if (!visible) return null

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="角色声音一致性" />
        <button
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
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
          <span className="text-sm">正在分析对话声音...</span>
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
          <div className="text-xs text-dark-text-muted">
            声音区分度：{distinctnessPct}%
          </div>
          <ProgressBar value={distinctnessPct} />

          {warnings.length > 0 && (
            <div className="rounded-lg border border-dark-border p-3 bg-dark-surface-sunken/20">
              <div className="text-sm font-semibold text-dark-text mb-2">不一致告警</div>
              <div className="flex flex-col gap-2">
                {warnings.slice(0, 8).map((w, idx) => (
                  <div key={idx} className="text-xs text-dark-text-muted">
                    <span className="font-semibold" style={{ color: severityColor(w.severity) }}>
                      {w.character} · {w.severity.toUpperCase()}
                    </span>
                    <span className="ml-2">{w.issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.fingerprints.map((fp) => (
              <VoiceCard key={fp.character} fp={fp} />
            ))}
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
