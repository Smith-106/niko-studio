import type { ReactNode } from 'react'

import type { RecommendationPayload } from '../../api/client'
import { ToggleSectionShell } from './ToggleSectionShell'

export function EvaluationDetailedReviewSection({
  title,
  hint,
  open,
  onToggle,
  dimensionAnalysisTitle,
  dimensions,
  moduleBreakdownTitle,
  modules,
  suggestionsTitle,
  suggestions,
  renderSuggestionItem,
  refreshSuggestionsLabel,
  refreshingSuggestionsLabel,
  batchApplyLabel,
  batchUndoLabel,
  onRefreshSuggestions,
  onBatchApply,
  onBatchUndo,
  suggestionsRefreshing,
  batchProcessing,
  canBatchUndo,
  suggestionsRefreshError,
  batchMessage,
  batchStatus,
}: {
  title: string
  hint: string
  open: boolean
  onToggle: () => void
  dimensionAnalysisTitle: string
  dimensions: Array<{ name: string; score: number; feedback: string }>
  moduleBreakdownTitle: string
  modules: Array<{ name: string; score: number }>
  suggestionsTitle: string
  suggestions: RecommendationPayload[]
  renderSuggestionItem: (suggestion: RecommendationPayload) => ReactNode
  refreshSuggestionsLabel: string
  refreshingSuggestionsLabel: string
  batchApplyLabel: string
  batchUndoLabel: string
  onRefreshSuggestions: () => void
  onBatchApply: () => void
  onBatchUndo: () => void
  suggestionsRefreshing: boolean
  batchProcessing: boolean
  canBatchUndo: boolean
  suggestionsRefreshError: string | null
  batchMessage: string | null
  batchStatus: string
}) {
  return (
    <ToggleSectionShell title={title} hint={hint} open={open} onToggle={onToggle}>
      <div className="space-y-4">
        <div>
          <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-dark-text">
            {dimensionAnalysisTitle}
          </h3>
          <div className="space-y-3">
            {dimensions.map((dim, index) => (
              <div key={index} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-dark-border dark:bg-dark-surface">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{dim.name}</span>
                  <span className={`text-sm font-medium ${dim.score >= 7 ? 'text-green-700 dark:text-green-400' : dim.score >= 5 ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                    {dim.score}/10
                  </span>
                </div>
                <div className="mb-2 h-2 w-full rounded-full bg-gray-300 dark:bg-dark-border2">
                  <div
                    className={`h-2 rounded-full ${dim.score >= 7 ? 'bg-green-600 dark:bg-green-500' : dim.score >= 5 ? 'bg-amber-700 dark:bg-amber-500' : 'bg-red-600 dark:bg-red-500'}`}
                    style={{ width: `${dim.score * 10}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{dim.feedback}</p>
              </div>
            ))}
          </div>
        </div>

        {modules.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-dark-text">
              {moduleBreakdownTitle}
            </h3>
            <div className="space-y-2">
              {modules.map((mod) => (
                <div key={mod.name} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 dark:border-dark-border dark:bg-dark-surface">
                  <span className="flex-1 text-sm font-medium text-gray-700 dark:text-dark-text">{mod.name}</span>
                  <span className={`text-sm font-medium ${mod.score >= 7 ? 'text-green-700 dark:text-green-400' : mod.score >= 5 ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                    {mod.score}/10
                  </span>
                  <div className="h-1.5 w-24 rounded-full bg-gray-300 dark:bg-dark-border2">
                    <div
                      className={`h-1.5 rounded-full ${mod.score >= 7 ? 'bg-green-600 dark:bg-green-500' : mod.score >= 5 ? 'bg-amber-700 dark:bg-amber-500' : 'bg-red-600 dark:bg-red-500'}`}
                      style={{ width: `${mod.score * 10}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-dark-text">
              {suggestionsTitle}
            </h3>
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={onRefreshSuggestions}
                disabled={suggestionsRefreshing}
                className="rounded bg-gray-100 px-2 py-1 text-xs disabled:opacity-50 dark:bg-dark-border dark:text-dark-text"
                aria-label={refreshSuggestionsLabel}
                title={refreshSuggestionsLabel}
              >
                {suggestionsRefreshing ? refreshingSuggestionsLabel : refreshSuggestionsLabel}
              </button>
              <button
                onClick={onBatchApply}
                disabled={batchProcessing}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                aria-label={batchApplyLabel}
                title={batchApplyLabel}
              >
                {batchApplyLabel}
              </button>
              <button
                onClick={onBatchUndo}
                disabled={batchProcessing || !canBatchUndo}
                className="rounded bg-gray-100 px-2 py-1 text-xs disabled:opacity-50 dark:bg-dark-border dark:text-dark-text"
                aria-label={batchUndoLabel}
                title={batchUndoLabel}
              >
                {batchUndoLabel}
              </button>
            </div>
            {suggestionsRefreshError && (
              <p className="mb-3 text-xs text-red-500" role="alert">
                {suggestionsRefreshError}
              </p>
            )}
            {batchMessage && (
              <p className={`mb-3 text-xs ${batchStatus === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {batchMessage}
              </p>
            )}
            <ul className="space-y-2">
              {suggestions.map((suggestion) => renderSuggestionItem(suggestion))}
            </ul>
          </div>
        )}
      </div>
    </ToggleSectionShell>
  )
}
