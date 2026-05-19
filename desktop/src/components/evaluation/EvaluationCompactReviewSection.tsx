import type { ReactNode } from 'react'

import type { RecommendationPayload } from '../../api/client'

export function EvaluationCompactReviewSection({
  compactSummaryTitle,
  compactSummaryHint,
  primaryFeedback,
  suggestionsTitle,
  previewSuggestions,
  remainingSuggestionCount,
  moreSuggestionsHint,
  renderPreviewSuggestionItem,
}: {
  compactSummaryTitle: string
  compactSummaryHint: string
  primaryFeedback: string
  suggestionsTitle: string
  previewSuggestions: RecommendationPayload[]
  remainingSuggestionCount: number
  moreSuggestionsHint: (count: number) => string
  renderPreviewSuggestionItem: (suggestion: RecommendationPayload) => ReactNode
}) {
  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-dark-border dark:bg-dark-bg/70">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
          {compactSummaryTitle}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
          {compactSummaryHint}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-dark-text">
          {primaryFeedback}
        </p>
      </div>

      {previewSuggestions.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
          <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-dark-text">
            {suggestionsTitle}
          </h3>
          <ul className="space-y-2">
            {previewSuggestions.map((suggestion) => renderPreviewSuggestionItem(suggestion))}
          </ul>
          {remainingSuggestionCount > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
              {moreSuggestionsHint(remainingSuggestionCount)}
            </p>
          )}
        </div>
      )}
    </>
  )
}
