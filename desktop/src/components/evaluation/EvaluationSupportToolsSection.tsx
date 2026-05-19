import { ChevronDown, ChevronRight } from 'lucide-react'

import { EvaluationWorkflowSection } from './EvaluationWorkflowSection'

export function EvaluationSupportToolsSection({
  title,
  hint,
  open,
  onToggle,
  qualityTitle,
  qualityRunLabel,
  qualityRunningLabel,
  qualityChecking,
  qualityCheckError,
  qualityCheckResult,
  qualityDecisionLabel,
  qualityTotalLabel,
  qualityLockLabel,
  qualityStyleLabel,
  qualityLogicLabel,
  qualityFeedbackLabel,
  onRunQualityCheck,
  isZh,
  content,
  multiPassTarget,
  multiPassMaxIter,
  multiPassRunning,
  multiPassResult,
  onMultiPassTargetChange,
  onMultiPassMaxIterChange,
  onRunMultiPass,
  consistencyTitle,
  consistencyRunLabel,
  consistencyRunningLabel,
  consistencyChecking,
  consistencyCheckError,
  consistencyCheckResult,
  consistencyRunIdLabel,
  consistencyScoreLabel,
  consistencyConflictsLabel,
  consistencySummaryLabel,
  hasMeaningfulScope,
  noScopeHint,
  onRunConsistency,
  moduleBreakdownTitle,
  workflowProps,
  checkpointDescription,
  checkpointPlaceholder,
  checkpointError,
  checkpoints,
  saveLabel,
  refreshLabel,
  restoreLabel,
  onCheckpointDescriptionChange,
  onCreateCheckpoint,
  onRefreshCheckpoints,
  onRestoreCheckpoint,
}: {
  title: string
  hint: string
  open: boolean
  onToggle: () => void
  qualityTitle: string
  qualityRunLabel: string
  qualityRunningLabel: string
  qualityChecking: boolean
  qualityCheckError: string | null
  qualityCheckResult: { decision: string; totalScore: number; lockScore: number; styleScore: number; logicScore: number; feedback: string } | null
  qualityDecisionLabel: string
  qualityTotalLabel: string
  qualityLockLabel: string
  qualityStyleLabel: string
  qualityLogicLabel: string
  qualityFeedbackLabel: string
  onRunQualityCheck: () => void
  isZh: boolean
  content: string
  multiPassTarget: number
  multiPassMaxIter: number
  multiPassRunning: boolean
  multiPassResult: { iterations: number; initialScore: number; finalScore: number; reason: string; sessionId?: string | null; revisionSession?: { id?: string | null; chapterId: string; state: string; iteration: number; comparisonSummary?: string | null } | null } | null
  onMultiPassTargetChange: (value: number) => void
  onMultiPassMaxIterChange: (value: number) => void
  onRunMultiPass: () => void
  consistencyTitle: string
  consistencyRunLabel: string
  consistencyRunningLabel: string
  consistencyChecking: boolean
  consistencyCheckError: string | null
  consistencyCheckResult: { runId: string; combined: { overallScore: number; totalConflicts: number; summary: string; moduleScores?: Record<string, number> } } | null
  consistencyRunIdLabel: string
  consistencyScoreLabel: string
  consistencyConflictsLabel: string
  consistencySummaryLabel: string
  hasMeaningfulScope: boolean
  noScopeHint: string
  onRunConsistency: () => void
  moduleBreakdownTitle: string
  workflowProps: React.ComponentProps<typeof EvaluationWorkflowSection>
  checkpointDescription: string
  checkpointPlaceholder: string
  checkpointError: string | null
  checkpoints: Array<{ id: string; description?: string | null; created_at: string }>
  saveLabel: string
  refreshLabel: string
  restoreLabel: string
  onCheckpointDescriptionChange: (value: string) => void
  onCreateCheckpoint: () => void
  onRefreshCheckpoints: () => void
  onRestoreCheckpoint: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
        aria-label={title}
      >
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">{title}</div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">{hint}</p>
        </div>
        {open ? (
          <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
        ) : (
          <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
        )}
      </button>
      {open && (
        <div className="mt-4 space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{qualityTitle}</span>
              <button
                onClick={onRunQualityCheck}
                disabled={qualityChecking}
                className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                aria-label={qualityRunLabel}
                title={qualityRunLabel}
              >
                {qualityChecking ? qualityRunningLabel : qualityRunLabel}
              </button>
            </div>
            {qualityCheckError && <p className="text-xs text-red-500">{qualityCheckError}</p>}
            {qualityCheckResult && (
              <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-700 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary">
                <div className="mb-1 font-medium text-gray-800 dark:text-dark-text">{qualityDecisionLabel}: {qualityCheckResult.decision}</div>
                <div>{qualityTotalLabel}: {qualityCheckResult.totalScore}</div>
                <div>{qualityLockLabel}: {qualityCheckResult.lockScore}</div>
                <div>{qualityStyleLabel}: {qualityCheckResult.styleScore}</div>
                <div>{qualityLogicLabel}: {qualityCheckResult.logicScore}</div>
                <div className="mt-1">{qualityFeedbackLabel}: {qualityCheckResult.feedback}</div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 dark:border-dark-border">
            <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-dark-text">{isZh ? '多轮修订' : 'Multi-Pass Revision'}</h4>
            {!content.trim() ? (
              <p className="text-xs text-gray-400 dark:text-dark-text-muted">
                {isZh ? '加载文档后即可使用多轮修订功能，自动迭代提升写作质量。' : 'Load a document to use multi-pass revision — automatically iterate to improve writing quality.'}
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-3">
                  <label className="text-xs text-gray-600 dark:text-dark-text-secondary">
                    {isZh ? '目标分数' : 'Target Score'}
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={multiPassTarget}
                      onChange={(e) => onMultiPassTargetChange(parseFloat(e.target.value) || 8)}
                      className="ml-1 w-16 rounded border bg-white px-1 py-0.5 text-xs dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                    />
                  </label>
                  <label className="text-xs text-gray-600 dark:text-dark-text-secondary">
                    {isZh ? '最大轮次' : 'Max Iterations'}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={multiPassMaxIter}
                      onChange={(e) => onMultiPassMaxIterChange(parseInt(e.target.value) || 5)}
                      className="ml-1 w-16 rounded border bg-white px-1 py-0.5 text-xs dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                    />
                  </label>
                  <button onClick={onRunMultiPass} disabled={multiPassRunning || !content.trim()} className="rounded bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700 disabled:opacity-50">
                    {multiPassRunning ? (isZh ? '修订中...' : 'Revising...') : (isZh ? '开始多轮修订' : 'Run Multi-Pass')}
                  </button>
                </div>
                {multiPassResult && (
                  <div className="rounded bg-gray-50 p-2 text-xs text-gray-600 dark:bg-dark-card dark:text-dark-text-secondary">
                    <div>{isZh ? '轮次' : 'Iterations'}: {multiPassResult.iterations}</div>
                    <div>{isZh ? '初始分数' : 'Initial Score'}: {multiPassResult.initialScore.toFixed(1)} → {isZh ? '最终分数' : 'Final Score'}: {multiPassResult.finalScore.toFixed(1)}</div>
                    <div>{isZh ? '结束原因' : 'Reason'}: {multiPassResult.reason}</div>
                    {multiPassResult.sessionId && (
                      <div>{isZh ? '会话 ID' : 'Session ID'}: {multiPassResult.sessionId}</div>
                    )}
                    {multiPassResult.revisionSession && (
                      <div>
                        {isZh ? '会话状态' : 'Session State'}: {multiPassResult.revisionSession.state} · {isZh ? '迭代' : 'Iteration'} {multiPassResult.revisionSession.iteration}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 dark:border-dark-border">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{consistencyTitle}</span>
              <button
                onClick={onRunConsistency}
                disabled={consistencyChecking || !hasMeaningfulScope}
                className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                aria-label={consistencyRunLabel}
                title={consistencyRunLabel}
              >
                {consistencyChecking ? consistencyRunningLabel : consistencyRunLabel}
              </button>
            </div>
            {!hasMeaningfulScope && <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{noScopeHint}</p>}
            {consistencyCheckError && <p className="text-xs text-red-500">{consistencyCheckError}</p>}
            {consistencyCheckResult && (
              <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-700 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary">
                <div className="mb-1 font-medium text-gray-800 dark:text-dark-text">{consistencyRunIdLabel}: {consistencyCheckResult.runId}</div>
                <div>{consistencyScoreLabel}: {consistencyCheckResult.combined.overallScore}</div>
                <div>{consistencyConflictsLabel}: {consistencyCheckResult.combined.totalConflicts}</div>
                <div className="mt-1">{consistencySummaryLabel}: {consistencyCheckResult.combined.summary}</div>
                {consistencyCheckResult.combined.moduleScores && (
                  <div className="mt-2 border-t border-gray-200 pt-2 dark:border-dark-border">
                    <div className="mb-1 font-medium text-gray-800 dark:text-dark-text">{moduleBreakdownTitle}</div>
                    {Object.entries(consistencyCheckResult.combined.moduleScores).map(([name, score]) => (
                      <div key={name} className="flex items-center gap-2 py-0.5">
                        <span className="flex-1">{name}</span>
                        <span className={`font-medium ${Number(score) >= 7 ? 'text-green-700 dark:text-green-400' : Number(score) >= 5 ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                          {Number(score).toFixed(1)}
                        </span>
                        <div className="h-1 w-16 rounded-full bg-gray-300 dark:bg-dark-border2">
                          <div className={`h-1 rounded-full ${Number(score) >= 7 ? 'bg-green-600 dark:bg-green-500' : Number(score) >= 5 ? 'bg-amber-700 dark:bg-amber-500' : 'bg-red-600 dark:bg-red-500'}`} style={{ width: `${Number(score) * 10}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <EvaluationWorkflowSection {...workflowProps} />

          <div className="border-t border-gray-200 pt-4 dark:border-dark-border">
            <div className="mb-3 flex gap-2">
              <input
                value={checkpointDescription}
                onChange={(e) => onCheckpointDescriptionChange(e.target.value)}
                placeholder={checkpointPlaceholder}
                aria-label={checkpointPlaceholder}
                className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
              />
              <button onClick={onCreateCheckpoint} className="rounded bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-700" aria-label={saveLabel} title={saveLabel}>{saveLabel}</button>
              <button onClick={onRefreshCheckpoints} className="rounded bg-gray-100 px-3 py-2 text-xs dark:bg-dark-border dark:text-dark-text" aria-label={refreshLabel} title={refreshLabel}>{refreshLabel}</button>
            </div>
            {checkpointError && <p className="mb-2 text-xs text-red-500">{checkpointError}</p>}
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {checkpoints.map((checkpoint) => (
                <div key={checkpoint.id} className="rounded border border-gray-200 p-2 dark:border-dark-border">
                  <div className="text-xs text-gray-700 dark:text-dark-text">{checkpoint.description || checkpoint.id}</div>
                  <div className="text-[11px] text-gray-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                  <button onClick={() => onRestoreCheckpoint(checkpoint.id)} className="mt-1 rounded bg-gray-100 px-2 py-1 text-xs dark:bg-dark-border dark:text-dark-text" aria-label={restoreLabel} title={restoreLabel}>{restoreLabel}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
