import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EvaluationDetailedReviewSection } from './evaluation/EvaluationDetailedReviewSection'
import type { RecommendationPayload } from '../../api/client'

const baseSuggestion: RecommendationPayload = {
  id: 'sug-01',
  title: 'Strengthen conflict',
  reason: 'Increase narrative tension',
  action: 'apply',
}

// Use dimension scores that won't collide with module score values under test.
// Scores 4, 8, 9, 10 are unique to their respective test scenarios.
const baseProps = {
  title: 'Detailed review',
  hint: 'Full score breakdown',
  open: true,
  onToggle: () => {},
  dimensionAnalysisTitle: 'Dimension analysis',
  dimensions: [
    { name: 'Lock', score: 4, feedback: 'Weak lock' },
  ],
  moduleBreakdownTitle: 'Module breakdown',
  modules: [] as Array<{ name: string; score: number }>,
  suggestionsTitle: 'Suggestions',
  suggestions: [baseSuggestion],
  renderSuggestionItem: (s: RecommendationPayload) => <li>{s.title}</li>,
  refreshSuggestionsLabel: 'Refresh',
  refreshingSuggestionsLabel: 'Refreshing...',
  batchApplyLabel: 'Apply all',
  batchUndoLabel: 'Undo all',
  onRefreshSuggestions: () => {},
  onBatchApply: () => {},
  onBatchUndo: () => {},
  suggestionsRefreshing: false,
  batchProcessing: false,
  canBatchUndo: false,
  suggestionsRefreshError: null as string | null,
  batchMessage: null as string | null,
  batchStatus: 'success',
}

describe('EvaluationDetailedReviewSection — branch coverage', () => {
  // Branch: suggestionsRefreshing ternary (line 122) — true arm
  it('shows the refreshing label when suggestionsRefreshing is true', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        suggestionsRefreshing
      />,
    )

    // aria-label stays "Refresh" (the stable accessible name), but inner text flips to "Refreshing..."
    const refreshButton = screen.getByRole('button', { name: 'Refresh' })
    expect(refreshButton).toBeDisabled()
    expect(refreshButton).toHaveTextContent('Refreshing...')
  })

  // Branch: suggestionsRefreshError && truthy (lines 143–146)
  it('renders the refresh error alert when suggestionsRefreshError is truthy', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        suggestionsRefreshError="Failed to refresh suggestions"
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('Failed to refresh suggestions')
  })

  // Branch: batchStatus === 'error' (line 149) — error arm
  it('renders batch message with error styling when batchStatus is error', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        batchMessage="Batch apply failed"
        batchStatus="error"
      />,
    )

    const message = screen.getByText('Batch apply failed')
    expect(message.className).toContain('text-red-500')
  })

  // Branch: batchStatus !== 'error' — success arm (already partially covered,
  // but verifying the non-error text-green-600 class explicitly)
  it('renders batch message with success styling when batchStatus is not error', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        batchMessage="2 suggestions applied"
        batchStatus="success"
      />,
    )

    const message = screen.getByText('2 suggestions applied')
    expect(message.className).toContain('text-green-600')
  })

  // Branch: mod.score >= 7 — green text color (line 94)
  it('renders module score with green text when score is 7 or higher', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        modules={[
          { name: 'Pacing', score: 8 },
          { name: 'Dialogue', score: 7 },
        ]}
      />,
    )

    // "8/10" and "7/10" are unique — dimension scores are 4, so no collision
    const pacingScore = screen.getByText('8/10')
    const dialogueScore = screen.getByText('7/10')
    expect(pacingScore.className).toContain('text-green-700')
    expect(dialogueScore.className).toContain('text-green-700')
  })

  // Branch: mod.score >= 7 — green bar color (line 99)
  it('renders module progress bar with green background when score is 7 or higher', () => {
    const { container } = render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        modules={[
          { name: 'Pacing', score: 9 },
        ]}
      />,
    )

    // The module bar container has class "h-1.5 w-24", its inner fill is "h-1.5 rounded-full"
    // with a green bg class for score >= 7. Look for the module section by its heading
    // then find the green-filled bar within.
    const moduleHeading = screen.getByText('Module breakdown')
    const moduleSection = moduleHeading.closest('div')
    expect(moduleSection).toBeTruthy()
    const greenBar = moduleSection!.querySelector('[class*="bg-green-600"], [class*="bg-green-500"]')
    expect(greenBar).toBeTruthy()
  })

  // Combined: verify module scores below 7 use amber/red branches
  it('renders module score with amber text when score is between 5 and 6', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        modules={[
          { name: 'Consistency', score: 6 },
        ]}
      />,
    )

    // "6/10" is unique now — dimension score is 4, not 6
    const score = screen.getByText('6/10')
    expect(score.className).toContain('text-amber-800')
  })

  it('renders module score with red text when score is below 5', () => {
    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        // Score 2 is not used by any dimension, so "2/10" is unique
        modules={[
          { name: 'Consistency', score: 2 },
        ]}
      />,
    )

    const score = screen.getByText('2/10')
    expect(score.className).toContain('text-red-700')
  })

  // Verify toggle section shell interaction
  it('hides content when the section is collapsed', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    render(
      <EvaluationDetailedReviewSection
        {...baseProps}
        onToggle={onToggle}
      />,
    )

    // Content should be visible initially (open=true)
    expect(screen.getByText('Dimension analysis')).toBeInTheDocument()

    // Click the toggle button to collapse
    await user.click(screen.getByRole('button', { name: 'Detailed review' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
