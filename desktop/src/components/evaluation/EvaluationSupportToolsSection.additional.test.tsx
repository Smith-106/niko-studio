import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { EvaluationSupportToolsSection } from './EvaluationSupportToolsSection'

function buildProps(overrides: Partial<React.ComponentProps<typeof EvaluationSupportToolsSection>> = {}) {
  return {
    title: 'More tools',
    hint: 'Test hint',
    open: true,
    onToggle: () => {},
    qualityTitle: 'Quality Check',
    qualityRunLabel: 'Run Quality Check',
    qualityRunningLabel: 'Running',
    qualityChecking: false,
    qualityCheckError: null,
    qualityCheckResult: null,
    qualityDecisionLabel: 'Decision',
    qualityTotalLabel: 'Total',
    qualityLockLabel: 'Lock',
    qualityStyleLabel: 'Style',
    qualityLogicLabel: 'Logic',
    qualityFeedbackLabel: 'Feedback',
    onRunQualityCheck: () => {},
    isZh: false,
    content: 'Draft',
    multiPassTarget: 8,
    multiPassMaxIter: 5,
    multiPassRunning: false,
    multiPassResult: null,
    onMultiPassTargetChange: () => {},
    onMultiPassMaxIterChange: () => {},
    onRunMultiPass: () => {},
    consistencyTitle: 'Consistency',
    consistencyRunLabel: 'Run Consistency',
    consistencyRunningLabel: 'Checking',
    consistencyChecking: false,
    consistencyCheckError: null,
    consistencyCheckResult: null,
    consistencyRunIdLabel: 'Run ID',
    consistencyScoreLabel: 'Score',
    consistencyConflictsLabel: 'Conflicts',
    consistencySummaryLabel: 'Summary',
    hasMeaningfulScope: true,
    noScopeHint: 'No scope',
    onRunConsistency: () => {},
    moduleBreakdownTitle: 'Modules',
    workflowProps: {
      isZh: false,
      writerWorkflowTitle: 'Workflow',
      writerWorkflowHint: 'Hint',
      writerAdvancedTitle: 'Advanced',
      writerAdvancedHint: 'Advanced hint',
      scopeChips: [],
      hasMeaningfulScope: true,
      presets: [],
      showAdvancedWorkflow: false,
      onToggleAdvancedWorkflow: () => {},
      workflowTask: '',
      workflowLevel: '',
      workflowPlanId: '',
      workflowStepId: '',
      workflowLifecycleAction: 'status',
      workflowConfirmToken: '',
      workflowWaitingConfirmation: false,
      workflowGateReason: null,
      workflowResult: null,
      workflowStates: {
        route: { status: 'idle' },
        plan: { status: 'idle' },
        execute: { status: 'idle' },
        lifecycle: { status: 'idle' },
      },
      setWorkflowTask: () => {},
      setWorkflowLevel: () => {},
      setWorkflowPlanId: () => {},
      setWorkflowStepId: () => {},
      setWorkflowLifecycleAction: () => {},
      setWorkflowConfirmToken: () => {},
      onWorkflowRoute: () => {},
      onWorkflowPlan: () => {},
      onWorkflowExecute: () => {},
      onWorkflowLifecycle: () => {},
      onWorkflowConfirmAndContinue: () => {},
      onRetryWorkflowAction: () => {},
      labels: {
        taskPlaceholder: 'Task',
        levelPlaceholder: 'Level',
        planIdPlaceholder: 'Plan ID',
        stepIdPlaceholder: 'Step ID',
        lifecycleActionLabel: 'Lifecycle',
        lifecycleStatus: 'Status',
        lifecycleStart: 'Start',
        lifecyclePause: 'Pause',
        lifecycleResume: 'Resume',
        lifecycleStop: 'Stop',
        route: 'Route',
        plan: 'Plan',
        execute: 'Execute',
        lifecycle: 'Lifecycle',
        waitingConfirmation: 'Waiting',
        gateReason: 'Reason',
        confirmTokenPlaceholder: 'Token',
        confirmAndContinue: 'Continue',
        retry: 'Retry',
      },
    },
    checkpointDescription: '',
    checkpointPlaceholder: 'Checkpoint',
    checkpointError: null,
    checkpoints: [],
    saveLabel: 'Save',
    refreshLabel: 'Refresh',
    restoreLabel: 'Restore',
    onCheckpointDescriptionChange: () => {},
    onCreateCheckpoint: () => {},
    onRefreshCheckpoints: () => {},
    onRestoreCheckpoint: () => {},
    ...overrides,
  }
}

describe('EvaluationSupportToolsSection additional coverage', () => {
  it('renders the empty-state guidance in English when no content is loaded', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ content: '   ' })} />)

    expect(screen.getByText(/Load a document to use multi-pass revision/i)).toBeInTheDocument()
  })

  it('renders the running English label and falls back to checkpoint id text', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          multiPassRunning: true,
          checkpoints: [
            {
              id: 'checkpoint-fallback-id',
              created_at: '2026-06-08T00:00:00Z',
            },
          ],
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Revising...' })).toBeInTheDocument()
    expect(screen.getByText('checkpoint-fallback-id')).toBeInTheDocument()
  })

  // --- Branch coverage: collapsed state ---

  it('renders ChevronRight when open=false and does not render content area', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ open: false })} />)

    const toggle = screen.getByRole('button', { name: 'More tools' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // Content area (quality check etc.) is hidden
    expect(screen.queryByText('Quality Check')).not.toBeInTheDocument()
  })

  it('renders ChevronDown when open=true', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ open: true })} />)

    const toggle = screen.getByRole('button', { name: 'More tools' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Quality Check')).toBeInTheDocument()
  })

  it('calls onToggle when the header button is clicked', () => {
    const onToggle = vi.fn()
    render(<EvaluationSupportToolsSection {...buildProps({ open: true, onToggle })} />)

    screen.getByRole('button', { name: 'More tools' }).click()
    expect(onToggle).toHaveBeenCalledOnce()
  })

  // --- Branch coverage: qualityCheckError ---

  it('renders quality check error message when qualityCheckError is provided', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ qualityCheckError: 'Quality check failed: timeout' })}
      />,
    )

    expect(screen.getByText('Quality check failed: timeout')).toBeInTheDocument()
  })

  // --- Branch coverage: qualityCheckResult ---

  it('renders quality check result with all score fields', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          qualityCheckResult: {
            decision: 'pass',
            totalScore: 8.5,
            lockScore: 9,
            styleScore: 7,
            logicScore: 8,
            feedback: 'Well written overall',
          },
        })}
      />,
    )

    expect(screen.getByText('Decision: pass')).toBeInTheDocument()
    expect(screen.getByText('Total: 8.5')).toBeInTheDocument()
    expect(screen.getByText('Lock: 9')).toBeInTheDocument()
    expect(screen.getByText('Style: 7')).toBeInTheDocument()
    expect(screen.getByText('Logic: 8')).toBeInTheDocument()
    expect(screen.getByText('Feedback: Well written overall')).toBeInTheDocument()
  })

  // --- Branch coverage: empty content placeholder (isZh=false) ---

  it('renders empty-content placeholder in English when content is whitespace', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ content: '   ', isZh: false })} />)

    expect(screen.getByText(/Load a document to use multi-pass revision/i)).toBeInTheDocument()
  })

  // --- Branch coverage: empty content placeholder (isZh=true) ---

  it('renders empty-content placeholder in Chinese when isZh and content is empty', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ content: '  ', isZh: true })} />)

    expect(screen.getByText(/加载文档后即可使用多轮修订功能/i)).toBeInTheDocument()
  })

  // --- Branch coverage: content.trim() truthy - multi-pass section visible (isZh) ---

  it('renders multi-pass section in Chinese when isZh and content is present', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ content: 'Draft', isZh: true })} />)

    expect(screen.getByText('多轮修订')).toBeInTheDocument()
    expect(screen.getByText('目标分数')).toBeInTheDocument()
    expect(screen.getByText('最大轮次')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始多轮修订' })).toBeInTheDocument()
  })

  // --- Branch coverage: NaN fallback for target score input ---

  it('falls back to 8 when target score input receives NaN', () => {
    const onMultiPassTargetChange = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onMultiPassTargetChange })}
      />,
    )

    const input = screen.getByLabelText('Target Score')
    // fireEvent.change with non-numeric value makes parseFloat return NaN
    fireEvent.change(input, { target: { value: 'abc', type: 'number' } })
    expect(onMultiPassTargetChange).toHaveBeenCalledWith(8)
  })

  // --- Branch coverage: NaN fallback for max iterations input ---

  it('falls back to 5 when max iterations input receives NaN', () => {
    const onMultiPassMaxIterChange = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onMultiPassMaxIterChange })}
      />,
    )

    const input = screen.getByLabelText('Max Iterations')
    fireEvent.change(input, { target: { value: 'abc', type: 'number' } })
    expect(onMultiPassMaxIterChange).toHaveBeenCalledWith(5)
  })

  // --- Branch coverage: multi-pass button disabled when running ---

  it('disables multi-pass button when multiPassRunning is true', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ multiPassRunning: true })} />)

    const btn = screen.getByRole('button', { name: 'Revising...' })
    expect(btn).toBeDisabled()
  })

  // --- Branch coverage: multi-pass button disabled when content is empty ---

  it('disables multi-pass button when content is empty', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ content: '   ' })} />)

    // Empty content means the multi-pass section is not rendered at all (placeholder shown instead)
    // So the button should not exist — verify placeholder is shown
    expect(screen.queryByRole('button', { name: /Run Multi-Pass/i })).not.toBeInTheDocument()
  })

  // --- Branch coverage: multiPassResult without sessionId ---

  it('renders multi-pass result without sessionId', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          multiPassResult: {
            iterations: 3,
            initialScore: 5.0,
            finalScore: 7.5,
            reason: 'max_iterations',
            sessionId: null,
            revisionSession: null,
          },
        })}
      />,
    )

    expect(screen.getByText('Iterations: 3')).toBeInTheDocument()
    expect(screen.getByText(/Final Score: 7.5/)).toBeInTheDocument()
    expect(screen.queryByText(/Session ID/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Session State/)).not.toBeInTheDocument()
  })

  // --- Branch coverage: multiPassResult with sessionId present ---

  it('renders multi-pass result with sessionId', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          multiPassResult: {
            iterations: 2,
            initialScore: 6.0,
            finalScore: 8.0,
            reason: 'target_reached',
            sessionId: 'session-xyz',
            revisionSession: null,
          },
        })}
      />,
    )

    expect(screen.getByText(/Session ID: session-xyz/)).toBeInTheDocument()
  })

  // --- Branch coverage: multiPassResult.revisionSession ---

  it('renders multi-pass result with revisionSession', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          multiPassResult: {
            iterations: 2,
            initialScore: 6.0,
            finalScore: 8.0,
            reason: 'target_reached',
            sessionId: null,
            revisionSession: {
              id: 'rev-42',
              chapterId: 'ch-3',
              state: 'REVISED',
              iteration: 2,
              comparisonSummary: null,
            },
          },
        })}
      />,
    )

    expect(screen.getByText(/Session State: REVISED/)).toBeInTheDocument()
    expect(screen.getByText(/Iteration 2/)).toBeInTheDocument()
  })

  // --- Branch coverage: consistency disabled when !hasMeaningfulScope ---

  it('disables consistency button and shows no-scope hint when hasMeaningfulScope is false', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ hasMeaningfulScope: false })}
      />,
    )

    const btn = screen.getByRole('button', { name: 'Run Consistency' })
    expect(btn).toBeDisabled()
    expect(screen.getByText('No scope')).toBeInTheDocument()
  })

  // --- Branch coverage: consistency disabled when consistencyChecking ---

  it('shows checking text and disables consistency button when consistencyChecking is true', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ consistencyChecking: true })}
      />,
    )

    // aria-label stays as "Run Consistency" but displayed text changes
    const btn = screen.getByRole('button', { name: 'Run Consistency' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Checking')
  })

  // --- Branch coverage: consistencyCheckError ---

  it('renders consistency check error message', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ consistencyCheckError: 'Consistency check crashed' })}
      />,
    )

    expect(screen.getByText('Consistency check crashed')).toBeInTheDocument()
  })

  // --- Branch coverage: consistencyCheckResult ---

  it('renders consistency check result with basic fields', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          consistencyCheckResult: {
            runId: 'run-abc',
            combined: {
              overallScore: 7.2,
              totalConflicts: 3,
              summary: 'Mostly consistent',
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Run ID: run-abc')).toBeInTheDocument()
    expect(screen.getByText('Score: 7.2')).toBeInTheDocument()
    expect(screen.getByText('Conflicts: 3')).toBeInTheDocument()
    expect(screen.getByText('Summary: Mostly consistent')).toBeInTheDocument()
  })

  // --- Branch coverage: moduleScores with all three score tiers ---

  it('renders module scores with green/amber/red tiers', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          consistencyCheckResult: {
            runId: 'run-1',
            combined: {
              overallScore: 6.5,
              totalConflicts: 1,
              summary: 'Good',
              moduleScores: {
                Characters: 8.5,
                Worldbuilding: 5.5,
                PlotHoles: 3.2,
              },
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Characters')).toBeInTheDocument()
    expect(screen.getByText('Worldbuilding')).toBeInTheDocument()
    expect(screen.getByText('PlotHoles')).toBeInTheDocument()
    expect(screen.getByText('8.5')).toBeInTheDocument()
    expect(screen.getByText('5.5')).toBeInTheDocument()
    expect(screen.getByText('3.2')).toBeInTheDocument()
  })

  // --- Branch coverage: moduleScores missing (no module breakdown) ---

  it('skips module breakdown when moduleScores is absent', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          consistencyCheckResult: {
            runId: 'run-2',
            combined: {
              overallScore: 9,
              totalConflicts: 0,
              summary: 'Perfect',
            },
          },
        })}
      />,
    )

    expect(screen.getByText('Score: 9')).toBeInTheDocument()
    expect(screen.queryByText('Modules')).not.toBeInTheDocument()
  })

  // --- Branch coverage: checkpointError ---

  it('renders checkpoint error message when checkpointError is provided', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ checkpointError: 'Failed to create checkpoint' })}
      />,
    )

    expect(screen.getByText('Failed to create checkpoint')).toBeInTheDocument()
  })

  // --- Branch coverage: checkpoint.description || checkpoint.id fallback ---

  it('shows checkpoint id as fallback when description is null', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          checkpoints: [
            { id: 'cp-no-desc', description: null, created_at: '2026-01-01' },
          ],
        })}
      />,
    )

    expect(screen.getByText('cp-no-desc')).toBeInTheDocument()
  })

  it('shows checkpoint description when provided instead of id', () => {
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          checkpoints: [
            { id: 'cp-with-desc', description: 'After chapter 3 rewrite', created_at: '2026-01-02' },
          ],
        })}
      />,
    )

    expect(screen.getByText('After chapter 3 rewrite')).toBeInTheDocument()
    expect(screen.queryByText('cp-with-desc')).not.toBeInTheDocument()
  })

  // --- Branch coverage: checkpoint interactions ---

  it('calls onRestoreCheckpoint when restore button is clicked', () => {
    const onRestoreCheckpoint = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({
          onRestoreCheckpoint,
          checkpoints: [
            { id: 'cp-restore', description: 'checkpoint', created_at: '2026-01-01' },
          ],
        })}
      />,
    )

    screen.getByRole('button', { name: 'Restore' }).click()
    expect(onRestoreCheckpoint).toHaveBeenCalledWith('cp-restore')
  })

  it('calls onRefreshCheckpoints when refresh button is clicked', () => {
    const onRefreshCheckpoints = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onRefreshCheckpoints })}
      />,
    )

    screen.getByRole('button', { name: 'Refresh' }).click()
    expect(onRefreshCheckpoints).toHaveBeenCalledOnce()
  })

  it('calls onCreateCheckpoint when save button is clicked', () => {
    const onCreateCheckpoint = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onCreateCheckpoint })}
      />,
    )

    screen.getByRole('button', { name: 'Save' }).click()
    expect(onCreateCheckpoint).toHaveBeenCalledOnce()
  })

  it('calls onCheckpointDescriptionChange when typing in checkpoint input', () => {
    const onCheckpointDescriptionChange = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onCheckpointDescriptionChange })}
      />,
    )

    const input = screen.getByLabelText('Checkpoint')
    fireEvent.change(input, { target: { value: 'my new checkpoint' } })
    expect(onCheckpointDescriptionChange).toHaveBeenCalledWith('my new checkpoint')
  })

  // --- Branch coverage: quality checking state ---

  it('shows running text and disables button when qualityChecking is true', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ qualityChecking: true })} />)

    // aria-label stays as "Run Quality Check" but displayed text changes
    const btn = screen.getByRole('button', { name: 'Run Quality Check' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Running')
  })

  it('shows run label when qualityChecking is false', () => {
    render(<EvaluationSupportToolsSection {...buildProps({ qualityChecking: false })} />)

    expect(screen.getByRole('button', { name: 'Run Quality Check' })).toBeInTheDocument()
  })

  it('calls onRunQualityCheck when quality check button is clicked', () => {
    const onRunQualityCheck = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onRunQualityCheck })}
      />,
    )

    screen.getByRole('button', { name: 'Run Quality Check' }).click()
    expect(onRunQualityCheck).toHaveBeenCalledOnce()
  })

  it('calls onRunConsistency when consistency button is clicked', () => {
    const onRunConsistency = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onRunConsistency })}
      />,
    )

    screen.getByRole('button', { name: 'Run Consistency' }).click()
    expect(onRunConsistency).toHaveBeenCalledOnce()
  })

  it('calls onRunMultiPass when multi-pass button is clicked', () => {
    const onRunMultiPass = vi.fn()
    render(
      <EvaluationSupportToolsSection
        {...buildProps({ onRunMultiPass })}
      />,
    )

    screen.getByRole('button', { name: 'Run Multi-Pass' }).click()
    expect(onRunMultiPass).toHaveBeenCalledOnce()
  })
})
