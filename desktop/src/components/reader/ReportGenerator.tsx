import { useState, useCallback } from 'react'
import { FileText, Download, RefreshCw, AlertTriangle, CheckCircle, XCircle, Users } from 'lucide-react'
import type { ConsensusReport, ConsensusItem } from '../../../../src-ts/reader/ConsensusEngine'

// ============================================================
// Types
// ============================================================

export interface ReportGeneratorProps {
  novelId: string
  onReportGenerated?: (report: ConsensusReport) => void
}

interface ReportState {
  status: 'idle' | 'loading' | 'success' | 'error'
  report: ConsensusReport | null
  error: string | null
}

// ============================================================
// Constants
// ============================================================

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-500',
}

const DIMENSION_LABELS: Record<string, string> = {
  'Plot Coherence': '情节连贯',
  'Character Consistency': '角色一致性',
  'Style Consistency': '风格一致性',
  'Pacing & Tension': '节奏与张力',
  Plot: '情节',
  Character: '角色',
  Style: '风格',
  Pacing: '节奏',
}

// ============================================================
// Sub-components
// ============================================================

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${SEVERITY_COLORS[severity] ?? 'bg-zinc-500 text-white'}`}>
      {severity.toUpperCase()}
    </span>
  )
}

function ConsensusBar({ strength }: { strength: number }) {
  const pct = Math.round(strength * 100)
  const barColor =
    pct >= 80
      ? 'bg-green-500'
      : pct >= 60
        ? 'bg-yellow-500'
        : pct >= 40
          ? 'bg-orange-500'
          : 'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-400 font-mono w-10 text-right">{pct}%</span>
    </div>
  )
}

function DimensionCard({
  dimension,
  summary,
}: {
  dimension: string
  summary: { avgScore: number; consensus: number }
}) {
  const label = DIMENSION_LABELS[dimension] ?? dimension
  const scorePct = Math.round(summary.avgScore * 100)
  const consensusPct = Math.round(summary.consensus * 100)
  const scoreColor =
    scorePct >= 80
      ? 'text-green-400'
      : scorePct >= 60
        ? 'text-yellow-400'
        : 'text-red-400'

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className={`text-lg font-mono ${scoreColor}`}>{scorePct}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>平均分</span>
          <div className="flex-1 mx-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${scorePct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>共识度</span>
          <div className="flex-1 mx-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${consensusPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ConsensusIssueItem({ item }: { item: ConsensusItem }) {
  const dimensionLabel = DIMENSION_LABELS[item.dimension] ?? item.dimension

  return (
    <div className={`rounded border p-3 ${SEVERITY_BORDER[item.severity]} bg-zinc-800/50`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-zinc-400 shrink-0 mt-0.5" />
          <span className="text-xs font-medium text-zinc-300">{dimensionLabel}</span>
        </div>
        <SeverityBadge severity={item.severity} />
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-2">{item.description}</p>
      <div className="space-y-1.5">
        <ConsensusBar strength={item.consensusStrength} />
        <div className="flex items-center gap-1.5 flex-wrap">
          <Users size={12} className="text-zinc-500" />
          {item.agreeingPersonas.slice(0, 4).map((id) => (
            <span key={id} className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px]">
              {id}
            </span>
          ))}
          {item.agreeingPersonas.length > 4 && (
            <span className="text-[10px] text-zinc-500">+{item.agreeingPersonas.length - 4}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function DissentItem({ item }: { item: ConsensusItem }) {
  const dimensionLabel = DIMENSION_LABELS[item.dimension] ?? item.dimension

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <XCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
          <span className="text-xs font-medium text-zinc-300">{dimensionLabel}</span>
        </div>
        <span className="text-[10px] text-zinc-500">分歧</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-2">{item.description}</p>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-zinc-500 mb-1">同意 ({item.agreeingPersonas.length})</p>
          <div className="flex flex-wrap gap-1">
            {item.agreeingPersonas.slice(0, 3).map((id) => (
              <span key={id} className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded">
                {id}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-zinc-500 mb-1">反对 ({item.disagreeingPersonas.length})</p>
          <div className="flex flex-wrap gap-1">
            {item.disagreeingPersonas.slice(0, 3).map((id) => (
              <span key={id} className="px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded">
                {id}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecommendationItem({ text, priority }: { text: string; priority: 'high' | 'medium' | 'low' }) {
  const priorityColor =
    priority === 'high'
      ? 'text-red-400'
      : priority === 'medium'
        ? 'text-yellow-400'
        : 'text-blue-400'

  return (
    <div className="flex items-start gap-2 py-1.5">
      <CheckCircle size={14} className={`${priorityColor} shrink-0 mt-0.5`} />
      <p className="text-xs text-zinc-300 leading-relaxed">{text}</p>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function ReportGenerator({ novelId, onReportGenerated }: ReportGeneratorProps) {
  const [state, setState] = useState<ReportState>({
    status: 'idle',
    report: null,
    error: null,
  })

  const generateReport = useCallback(async () => {
    setState({ status: 'loading', report: null, error: null })

    try {
      // Call /reader/analyze endpoint
      const response = await fetch('/reader/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novelId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error ?? `HTTP ${response.status}`)
      }

      const data = await response.json()

      // The endpoint returns readerReactions, editorialAnalysis, etc.
      // We need to build a ConsensusReport from this
      // For now, we'll use a placeholder structure
      // In a real implementation, this would call the ConsensusEngine

      // Build consensus report from the response
      const report: ConsensusReport = {
        items: [],
        overallAssessment: data.editorialAnalysis?.pacingAssessment ?? '分析完成',
        criticalIssues: [],
        dissentItems: [],
        dimensionSummaries: {},
      }

      // Extract dimension summaries from dimensionScores if available
      if (data.dimensionScores && Array.isArray(data.dimensionScores)) {
        for (const personaScore of data.dimensionScores) {
          for (const ds of personaScore.scores ?? []) {
            const dimName = ds.dimension
            if (!report.dimensionSummaries[dimName]) {
              report.dimensionSummaries[dimName] = { avgScore: 0, consensus: 0 }
            }
            // Accumulate scores (simplified)
            report.dimensionSummaries[dimName].avgScore = ds.score
          }
        }
      }

      // Build items from reader reactions
      if (data.readerReactions && Array.isArray(data.readerReactions)) {
        for (const reaction of data.readerReactions) {
          for (const highlight of reaction.highlights ?? []) {
            report.items.push({
              description: highlight.comment ?? highlight.text?.substring(0, 80) ?? '未描述',
              dimension: highlight.dimension,
              agreeingPersonas: [reaction.personaId],
              disagreeingPersonas: [],
              severity: highlight.reaction === 'negative' ? 'high' : 'medium',
              consensusStrength: 0.7,
              location: {
                chapter: highlight.position?.chapter,
                paragraph: highlight.position?.paragraph,
              },
            })
          }
        }

        // Categorize into critical and dissent
        report.criticalIssues = report.items.filter(
          (item) => item.severity === 'critical' || item.severity === 'high'
        )
        report.dissentItems = report.items.filter(
          (item) => item.disagreeingPersonas.length > 0 && item.consensusStrength < 0.6
        )
      }

      setState({ status: 'success', report, error: null })
      onReportGenerated?.(report)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ status: 'error', report: null, error: message })
    }
  }, [novelId, onReportGenerated])

  const exportReport = useCallback(() => {
    const report = state.report
    if (!report) return
    const lines: string[] = []

    // Title
    lines.push('# 读者模拟报告')
    lines.push('')
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`)
    lines.push(`小说 ID: ${novelId}`)
    lines.push('')

    // Executive Summary
    lines.push('## 执行摘要')
    lines.push('')
    lines.push(report.overallAssessment)
    lines.push('')
    lines.push(`- 关键问题: ${report.criticalIssues.length}`)
    lines.push(`- 分歧项: ${report.dissentItems.length}`)
    lines.push('')

    // Dimension Analysis
    if (Object.keys(report.dimensionSummaries).length > 0) {
      lines.push('## 维度分析')
      lines.push('')
      for (const [dim, summary] of Object.entries(report.dimensionSummaries)) {
        const label = DIMENSION_LABELS[dim] ?? dim
        lines.push(`### ${label}`)
        lines.push(`- 平均分: ${Math.round(summary.avgScore * 100)}`)
        lines.push(`- 共识度: ${Math.round(summary.consensus * 100)}%`)
        lines.push('')
      }
    }

    // Consensus Issues
    if (report.criticalIssues.length > 0) {
      lines.push('## 共识问题')
      lines.push('')
      for (const issue of report.criticalIssues) {
        const label = DIMENSION_LABELS[issue.dimension] ?? issue.dimension
        lines.push(`### [${issue.severity.toUpperCase()}] ${label}`)
        lines.push('')
        lines.push(issue.description)
        lines.push('')
        lines.push(`- 共识强度: ${Math.round(issue.consensusStrength * 100)}%`)
        lines.push(`- 同意角色: ${issue.agreeingPersonas.join(', ') || '无'}`)
        lines.push('')
      }
    }

    // Dissent Points
    if (report.dissentItems.length > 0) {
      lines.push('## 分歧点')
      lines.push('')
      for (const item of report.dissentItems) {
        const label = DIMENSION_LABELS[item.dimension] ?? item.dimension
        lines.push(`### ${label}`)
        lines.push('')
        lines.push(item.description)
        lines.push('')
        lines.push(`- 同意: ${item.agreeingPersonas.join(', ') || '无'}`)
        lines.push(`- 反对: ${item.disagreeingPersonas.join(', ') || '无'}`)
        lines.push('')
      }
    }

    // Recommendations
    lines.push('## 建议')
    lines.push('')
    const recommendations: Array<{ text: string; priority: 'high' | 'medium' | 'low' }> = []

    // Generate recommendations from critical issues
    for (const issue of report.criticalIssues.slice(0, 5)) {
      recommendations.push({
        text: `处理 ${DIMENSION_LABELS[issue.dimension] ?? issue.dimension} 问题: ${issue.description.substring(0, 50)}...`,
        priority: issue.severity === 'critical' ? 'high' : 'medium',
      })
    }

    // Add general recommendations
    if (report.criticalIssues.length === 0) {
      recommendations.push({ text: '稿件整体质量良好，建议进行细节打磨', priority: 'low' })
    }

    for (const rec of recommendations) {
      lines.push(`- [${rec.priority.toUpperCase()}] ${rec.text}`)
    }

    const markdown = lines.join('\n')

    // Copy to clipboard
    navigator.clipboard.writeText(markdown).then(
      () => {
        // Could show a toast notification here
        console.log('Report exported to clipboard')
      },
      (err) => {
        console.error('Failed to copy report:', err)
      }
    )
  }, [state.report, novelId])

  // ============================================================
  // Render
  // ============================================================

  if (state.status === 'idle') {
    return (
      <div className="p-4 rounded border border-zinc-700 bg-zinc-800/50">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText size={32} className="text-zinc-500 mb-3" />
          <p className="text-sm text-zinc-400 mb-4">点击生成读者模拟报告</p>
          <button
            onClick={generateReport}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium
              hover:bg-blue-500 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            生成报告
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="p-4 rounded border border-zinc-700 bg-zinc-800/50">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <RefreshCw size={32} className="text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-zinc-400">正在生成报告...</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 rounded border border-red-500/30 bg-red-500/10">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <XCircle size={32} className="text-red-400 mb-3" />
          <p className="text-sm text-red-300 mb-2">生成失败</p>
          <p className="text-xs text-red-400 mb-4">{state.error}</p>
          <button
            onClick={generateReport}
            className="px-4 py-2 rounded bg-red-600 text-white text-sm font-medium
              hover:bg-red-500 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            重试
          </button>
        </div>
      </div>
    )
  }

  // At this point, status is 'success' and report is non-null
  const report = state.report!

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">读者模拟报告</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={generateReport}
            className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs
              hover:bg-zinc-600 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            重新生成
          </button>
          <button
            onClick={exportReport}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs
              hover:bg-blue-500 transition-colors flex items-center gap-1.5"
          >
            <Download size={14} />
            导出报告
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="rounded border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="text-xs font-semibold text-zinc-400 mb-2">执行摘要</h3>
        <p className="text-sm text-zinc-200 leading-relaxed mb-3">{report.overallAssessment}</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-center">
            <p className="text-xl font-bold text-red-400">{report.criticalIssues.length}</p>
            <p className="text-[10px] text-zinc-400">关键问题</p>
          </div>
          <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-center">
            <p className="text-xl font-bold text-yellow-400">{report.dissentItems.length}</p>
            <p className="text-[10px] text-zinc-400">分歧项</p>
          </div>
          <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2 text-center">
            <p className="text-xl font-bold text-blue-400">{report.items.length}</p>
            <p className="text-[10px] text-zinc-400">总问题数</p>
          </div>
        </div>
      </div>

      {/* Dimension Analysis */}
      {Object.keys(report.dimensionSummaries).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 mb-2">维度分析</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(report.dimensionSummaries).map(([dimension, summary]) => (
              <DimensionCard key={dimension} dimension={dimension} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Consensus Issues */}
      {report.criticalIssues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-400 mb-2">
            共识问题 ({report.criticalIssues.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {report.criticalIssues.map((item, i) => (
              <ConsensusIssueItem key={`${item.dimension}-${i}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Dissent Points */}
      {report.dissentItems.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-orange-400 mb-2">
            分歧点 ({report.dissentItems.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {report.dissentItems.map((item, i) => (
              <DissentItem key={`${item.dimension}-${i}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-400 mb-2">建议</h3>
        <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
          {report.criticalIssues.length > 0 ? (
            <>
              {report.criticalIssues.slice(0, 5).map((issue, i) => (
                <RecommendationItem
                  key={i}
                  text={`处理 ${DIMENSION_LABELS[issue.dimension] ?? issue.dimension} 问题: ${issue.description.substring(0, 50)}...`}
                  priority={issue.severity === 'critical' ? 'high' : 'medium'}
                />
              ))}
              {report.criticalIssues.length > 5 && (
                <p className="text-[10px] text-zinc-500 pt-1.5">
                  还有 {report.criticalIssues.length - 5} 个问题需要处理...
                </p>
              )}
            </>
          ) : (
            <RecommendationItem text="稿件整体质量良好，建议进行细节打磨" priority="low" />
          )}
        </div>
      </div>
    </div>
  )
}
