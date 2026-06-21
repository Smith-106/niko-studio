import React from 'react'
import type { OverlayMarker } from '../../types/reader'
import type { ConsensusReport } from '../../api/reader'

export interface DetailPanelProps {
  selectedItem: OverlayMarker | null
  consensusReport: ConsensusReport | null
  onClose: () => void
  onFeedback?: (feedbackId: string, action: 'helpful' | 'not_helpful') => void
}

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
  Plot: '情节',
  Character: '角色',
  Style: '风格',
  Pacing: '节奏',
  Suspense: '悬疑',
  Emotion: '情感',
  Worldview: '世界观',
  Continuity: '连贯性',
  'Plot Coherence': '情节连贯',
  'Character Consistency': '角色一致性',
  'Style Consistency': '风格一致性',
  'Pacing & Tension': '节奏与张力',
}

function ConsensusStrengthBar({ strength }: { strength: number }) {
  const percentage = Math.round(strength * 100)
  const barColor =
    percentage >= 80
      ? 'bg-green-500'
      : percentage >= 60
        ? 'bg-yellow-500'
        : percentage >= 40
          ? 'bg-orange-500'
          : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">共识强度</span>
        <span className="text-zinc-300 font-mono">{percentage}%</span>
      </div>
      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function DimensionSummaryCard({
  dimension,
  summary,
}: {
  dimension: string
  summary: { avgScore: number; consensus: number }
}) {
  const label = DIMENSION_LABELS[dimension] ?? dimension
  const scorePercentage = Math.round(summary.avgScore * 100)
  const consensusPercentage = Math.round(summary.consensus * 100)
  const scoreColor =
    scorePercentage >= 80
      ? 'text-green-400'
      : scorePercentage >= 60
        ? 'text-yellow-400'
        : 'text-red-400'

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 p-2 text-xs">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-zinc-300">{label}</span>
        <span className={`font-mono ${scoreColor}`}>{scorePercentage}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${scorePercentage}%` }}
          />
        </div>
        <span className="text-[10px] text-zinc-500">共识 {consensusPercentage}%</span>
      </div>
    </div>
  )
}

function SelectedItemView({
  item,
  report,
  onFeedback,
}: {
  item: OverlayMarker
  report: ConsensusReport | null
  onFeedback?: (feedbackId: string, action: 'helpful' | 'not_helpful') => void
}) {
  // Find matching consensus item for persona details
  const matchingConsensus = report?.items.find(
    (ci) =>
      ci.dimension === item.dimension &&
      ci.description === item.description
  )

  const dimensionLabel = DIMENSION_LABELS[item.dimension] ?? item.dimension
  const agreeingPersonas = matchingConsensus?.agreeingPersonas ?? []
  const disagreeingPersonas = matchingConsensus?.disagreeingPersonas ?? []
  const feedbackId = item.id ?? `${item.personaIds[0] ?? 'unknown'}-${item.dimension}-${item.position.chapterId ?? 'unknown'}`

  const [feedbackState, setFeedbackState] = React.useState<'none' | 'helpful' | 'not_helpful'>('none')

  const handleFeedback = (action: 'helpful' | 'not_helpful') => {
    setFeedbackState(action)
    onFeedback?.(feedbackId, action)
  }

  return (
    <div className="space-y-4">
      {/* Header with dimension and severity */}
      <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              item.type === 'consensus' ? SEVERITY_COLORS[item.severity].split(' ')[0] : 'bg-zinc-500'
            }`}
          />
          <h3 className="text-sm font-semibold text-zinc-200">{dimensionLabel}</h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${SEVERITY_COLORS[item.severity]}`}
        >
          {item.severity.toUpperCase()}
        </span>
      </div>

      {/* Description */}
      <div>
        <p className="text-xs text-zinc-400 mb-1">问题描述</p>
        <p className="text-sm text-zinc-200 leading-relaxed">{item.description}</p>
      </div>

      {/* Consensus strength bar */}
      <ConsensusStrengthBar strength={item.consensusStrength} />

      {/* Feedback buttons */}
      {onFeedback && (
        <div className="pt-1">
          <p className="text-xs text-zinc-500 mb-1.5">这个反馈对你有用吗？</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback('helpful')}
              disabled={feedbackState !== 'none'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                feedbackState === 'helpful'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : feedbackState === 'none'
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700'
                    : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/>
              </svg>
              有用
            </button>
            <button
              onClick={() => handleFeedback('not_helpful')}
              disabled={feedbackState !== 'none'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
                feedbackState === 'not_helpful'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : feedbackState === 'none'
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700'
                    : 'bg-zinc-800/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/>
              </svg>
              无用
            </button>
          </div>
        </div>
      )}

      {/* Persona lists */}
      <div className="space-y-3">
        {/* Agreeing personas */}
        {agreeingPersonas.length > 0 && (
          <div>
            <p className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              同意角色 ({agreeingPersonas.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {agreeingPersonas.map((personaId) => (
                <span
                  key={personaId}
                  className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px] border border-green-500/30"
                >
                  {personaId}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disagreeing personas */}
        {disagreeingPersonas.length > 0 && (
          <div>
            <p className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              反对角色 ({disagreeingPersonas.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {disagreeingPersonas.map((personaId) => (
                <span
                  key={personaId}
                  className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-[10px] border border-red-500/30"
                >
                  {personaId}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: show personaIds if no consensus match */}
        {agreeingPersonas.length === 0 &&
          disagreeingPersonas.length === 0 &&
          item.personaIds.length > 0 && (
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">涉及角色 ({item.personaIds.length})</p>
              <div className="flex flex-wrap gap-1">
                {item.personaIds.map((personaId) => (
                  <span
                    key={personaId}
                    className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded text-[10px]"
                  >
                    {personaId}
                  </span>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Location info */}
      {(item.position.chapterId || item.position.paragraphIndex !== undefined) && (
        <div className="pt-3 border-t border-zinc-700">
          <p className="text-xs text-zinc-400 mb-1">位置</p>
          <p className="text-xs text-zinc-300">
            {item.position.chapterId && <span>章节: {item.position.chapterId}</span>}
            {item.position.chapterId && item.position.paragraphIndex !== undefined && (
              <span className="text-zinc-500 mx-1">·</span>
            )}
            {item.position.paragraphIndex !== undefined && (
              <span>段落: {item.position.paragraphIndex + 1}</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function OverviewView({ report }: { report: ConsensusReport }) {
  const criticalCount = report.criticalIssues.length
  const dissentCount = report.dissentItems.length

  return (
    <div className="space-y-4">
      {/* Overall assessment */}
      <div className="rounded border border-zinc-700 bg-zinc-800/50 p-3">
        <h3 className="text-xs font-semibold text-zinc-400 mb-2">整体评估</h3>
        <p className="text-sm text-zinc-200 leading-relaxed">{report.overallAssessment}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-center">
          <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
          <p className="text-[10px] text-zinc-400">关键问题</p>
        </div>
        <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-center">
          <p className="text-2xl font-bold text-yellow-400">{dissentCount}</p>
          <p className="text-[10px] text-zinc-400">分歧项</p>
        </div>
      </div>

      {/* Dimension summaries */}
      {Object.keys(report.dimensionSummaries).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-400 mb-2">维度概览</h3>
          <div className="space-y-2">
            {Object.entries(report.dimensionSummaries).map(([dimension, summary]) => (
              <DimensionSummaryCard key={dimension} dimension={dimension} summary={summary} />
            ))}
          </div>
        </div>
      )}

      {/* Critical issues preview */}
      {criticalCount > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-red-400 mb-2">关键问题预览</h3>
          <div className="space-y-1.5">
            {report.criticalIssues.slice(0, 3).map((issue, i) => (
              <div
                key={i}
                className={`rounded border p-2 text-xs ${SEVERITY_BORDER[issue.severity]} bg-zinc-800/50`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-300">
                    {DIMENSION_LABELS[issue.dimension] ?? issue.dimension}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${SEVERITY_COLORS[issue.severity]}`}
                  >
                    {issue.severity}
                  </span>
                </div>
                <p className="text-zinc-400 text-[10px] line-clamp-2">{issue.description}</p>
              </div>
            ))}
            {criticalCount > 3 && (
              <p className="text-[10px] text-zinc-500 text-center">
                还有 {criticalCount - 3} 个关键问题...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DetailPanel({ selectedItem, consensusReport, onClose, onFeedback }: DetailPanelProps) {
  const hasContent = selectedItem !== null || consensusReport !== null

  return (
    <div
      className={`w-[360px] h-full bg-zinc-900 border-l border-zinc-700 flex flex-col transform transition-transform duration-300 ease-out ${
        hasContent ? 'translate-x-0' : 'translate-x-full'
      }`}
      role="region"
      aria-label="读者模拟详情面板"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-700 flex-shrink-0">
        <h2 className="text-sm font-semibold text-zinc-200">
          {selectedItem ? '标记详情' : '共识概览'}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white transition-colors p-1 rounded hover:bg-zinc-700"
          aria-label="关闭面板"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {!hasContent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-600"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">暂无数据</p>
            <p className="text-xs text-zinc-600 mt-1">点击标记查看详情</p>
          </div>
        ) : selectedItem && consensusReport ? (
          <SelectedItemView item={selectedItem} report={consensusReport} onFeedback={onFeedback} />
        ) : selectedItem ? (
          <SelectedItemView item={selectedItem} report={null} onFeedback={onFeedback} />
        ) : consensusReport ? (
          <OverviewView report={consensusReport} />
        ) : null}
      </div>
    </div>
  )
}
