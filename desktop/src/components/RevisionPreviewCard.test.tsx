import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RevisionPreviewCard } from './RevisionPreviewCard'

const defaultProps = {
  previewTitle: 'Revision Preview',
  originalLabel: 'Original',
  candidateLabel: 'Candidate',
  sourceText: 'Original text content.',
  candidateText: 'Modified text content with improvements.',
  primaryActionLabel: 'Apply',
  secondaryActionLabel: 'Insert Below',
  undoActionLabel: 'Undo',
  onPrimaryAction: vi.fn(),
  onSecondaryAction: vi.fn(),
  onUndoAction: vi.fn(),
}

describe('RevisionPreviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders original and candidate text sections', () => {
    render(<RevisionPreviewCard {...defaultProps} />)

    expect(screen.getByText('Revision Preview')).toBeInTheDocument()
    expect(screen.getByText('Original')).toBeInTheDocument()
    expect(screen.getByText('Candidate')).toBeInTheDocument()
    expect(screen.getByText('Original text content.')).toBeInTheDocument()
    expect(screen.getByText('Modified text content with improvements.')).toBeInTheDocument()
  })

  it('renders action buttons and triggers callbacks', async () => {
    const user = userEvent.setup()
    render(<RevisionPreviewCard {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(defaultProps.onPrimaryAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Insert Below' }))
    expect(defaultProps.onSecondaryAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(defaultProps.onUndoAction).toHaveBeenCalledTimes(1)
  })

  it('omits secondary action when not provided', () => {
    render(
      <RevisionPreviewCard
        {...defaultProps}
        secondaryActionLabel={undefined}
        onSecondaryAction={undefined}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Insert Below' })).not.toBeInTheDocument()
  })

  it('toggles diff view when clicking the diff button', async () => {
    const user = userEvent.setup()
    render(<RevisionPreviewCard {...defaultProps} />)

    // Diff view should be hidden initially
    expect(screen.queryByText('Diff')).not.toBeInTheDocument()

    // Click to show diff
    await user.click(screen.getByRole('button', { name: 'Show diff' }))
    expect(screen.getByText('Diff')).toBeInTheDocument()

    // Click to hide diff
    await user.click(screen.getByRole('button', { name: 'Hide diff' }))
    expect(screen.queryByText('Diff')).not.toBeInTheDocument()
  })

  it('diff view shows removed and added lines', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText="Line one.\nLine two.\nLine three."
        candidateText="Line one.\nModified line two.\nLine three."
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show diff' }))

    const diffContainer = screen.getByText('Diff').closest('.rounded-lg')!
    expect(diffContainer).toBeInTheDocument()

    // Should show the removed original line and added modified line
    const diffContent = diffContainer.querySelector('pre')!
    expect(diffContent.textContent).toContain('Line two.')
    expect(diffContent.textContent).toContain('Modified line two.')
  })

  it('renders the no-differences state when the texts match', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText="Unchanged line"
        candidateText="Unchanged line"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show diff' }))

    expect(screen.getByText('No differences detected')).toBeInTheDocument()
  })

  it('falls back to the simple diff strategy for large inputs', async () => {
    const user = userEvent.setup()
    const sourceLines = Array.from({ length: 501 }, (_, index) =>
      index === 250 ? 'middle original' : `shared line ${index}`,
    )
    const candidateLines = Array.from({ length: 501 }, (_, index) =>
      index === 250 ? 'middle revised' : `shared line ${index}`,
    )

    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText={sourceLines.join('\n')}
        candidateText={candidateLines.join('\n')}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Show diff' }))

    const diffContainer = screen.getByText('Diff').closest('.rounded-lg')!
    const diffContent = diffContainer.querySelector('pre')!
    expect(diffContent.textContent).toContain('shared line 0')
    expect(diffContent.textContent).toContain('middle original')
    expect(diffContent.textContent).toContain('middle revised')
  })

  it('shows confirmation dialog when confirmRollback is enabled', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        confirmRollback={true}
      />,
    )

    // Click undo - should show dialog, not call onUndoAction
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(defaultProps.onUndoAction).not.toHaveBeenCalled()

    // Confirmation dialog should be visible
    expect(screen.getByText('Confirm Rollback')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to undo/)).toBeInTheDocument()
  })

  it('confirming rollback dialog triggers onUndoAction', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        confirmRollback={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    // Confirm the rollback - the confirm button in the dialog has the same label
    // but it is inside the alertdialog, so use getAllByRole and pick the last one
    const undoButtons = screen.getAllByRole('button', { name: 'Undo' })
    // The last button is the confirm button in the dialog (dialog renders on top)
    await user.click(undoButtons[undoButtons.length - 1])
    expect(defaultProps.onUndoAction).toHaveBeenCalledTimes(1)

    // Dialog should be gone
    expect(screen.queryByText('Confirm Rollback')).not.toBeInTheDocument()
  })

  it('cancelling rollback dialog does not trigger onUndoAction', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        confirmRollback={true}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    // Cancel the rollback
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(defaultProps.onUndoAction).not.toHaveBeenCalled()

    // Dialog should be gone
    expect(screen.queryByText('Confirm Rollback')).not.toBeInTheDocument()
  })

  it('shows integrity warnings when source and candidate are identical', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText="Same text."
        candidateText="Same text."
      />,
    )

    // Click undo - should detect integrity issue
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(defaultProps.onUndoAction).not.toHaveBeenCalled()

    // Should show integrity warnings
    expect(screen.getByText('Integrity warnings:')).toBeInTheDocument()
    expect(screen.getByText('Source and candidate texts are identical (no changes)')).toBeInTheDocument()
  })

  it('shows integrity warnings when texts are empty', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText=""
        candidateText=""
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(defaultProps.onUndoAction).not.toHaveBeenCalled()

    expect(screen.getByText('Integrity warnings:')).toBeInTheDocument()
    expect(screen.getByText('Source text is empty')).toBeInTheDocument()
    expect(screen.getByText('Candidate text is empty')).toBeInTheDocument()
  })

  it('shows an integrity warning when the candidate is much longer than the source', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText="short text"
        candidateText={'expanded '.repeat(30).trim()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText('Integrity warnings:')).toBeInTheDocument()
    expect(screen.getByText(/Candidate is .*x longer than source/)).toBeInTheDocument()
  })

  it('shows an integrity warning when the candidate is severely truncated', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText={'This is a much longer source passage that should trigger truncation detection. '.repeat(2)}
        candidateText="tiny"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText('Integrity warnings:')).toBeInTheDocument()
    expect(screen.getByText(/Candidate is .* shorter than source/)).toBeInTheDocument()
  })

  it('calls onIntegrityCheck before rollback and blocks if it returns false', async () => {
    const integrityCheck = vi.fn().mockReturnValue(false)
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        onIntegrityCheck={integrityCheck}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(integrityCheck).toHaveBeenCalledTimes(1)
    expect(defaultProps.onUndoAction).not.toHaveBeenCalled()
    expect(screen.getByText('Confirm Rollback')).toBeInTheDocument()
  })

  it('calls onIntegrityCheck and proceeds if it returns true with clean data', async () => {
    const integrityCheck = vi.fn().mockReturnValue(true)
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        onIntegrityCheck={integrityCheck}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(integrityCheck).toHaveBeenCalledTimes(1)
    expect(defaultProps.onUndoAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Confirm Rollback')).not.toBeInTheDocument()
  })

  it('allows rollback to proceed after confirming despite integrity warnings', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        sourceText=""
        candidateText=""
      />,
    )

    // Trigger integrity warning
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Confirm Rollback')).toBeInTheDocument()

    // Confirm anyway - the confirm button is the last "Undo" button
    const undoButtons = screen.getAllByRole('button', { name: 'Undo' })
    await user.click(undoButtons[undoButtons.length - 1])
    expect(defaultProps.onUndoAction).toHaveBeenCalledTimes(1)
  })

  it('applies custom CSS class names', () => {
    const { container } = render(
      <RevisionPreviewCard
        {...defaultProps}
        className="custom-card"
        sourceTextClassName="custom-source"
        candidateTextClassName="custom-candidate"
        actionsClassName="custom-actions"
      />,
    )

    // The outermost div should have the custom class
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv.className).toContain('custom-card')

    const originalSection = screen.getByText('Original').closest('.rounded-xl')!
    expect(originalSection.querySelector('p')!.className).toContain('custom-source')

    const candidateSection = screen.getByText('Candidate').closest('.rounded-xl')!
    expect(candidateSection.querySelector('p')!.className).toContain('custom-candidate')

    const actionsContainer = screen.getByRole('button', { name: 'Apply' }).closest('div')!
    expect(actionsContainer.className).toContain('custom-actions')
  })

  it('proceeds directly without dialog when confirmRollback is false and integrity is clean', async () => {
    const user = userEvent.setup()
    render(
      <RevisionPreviewCard
        {...defaultProps}
        confirmRollback={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(defaultProps.onUndoAction).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Confirm Rollback')).not.toBeInTheDocument()
  })
})
