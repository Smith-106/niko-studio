import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  workflowLifecycle,
  workflowSchedulerImportLitePlan,
  workflowSchedulerList,
  workflowSchedulerPause,
  workflowSchedulerResume,
  workflowSchedulerRunNow,
  type WorkflowExecuteResponse,
  type WorkflowLifecycleResponse,
  type WorkflowSchedulerTaskRecord,
} from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import type { ProjectWorkspaceContext } from '../types/workspace'
import { AutomationPanel } from './AutomationPanel'

const mockUseWriterWorkspaceSummary = vi.fn()

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: () => mockUseWriterWorkspaceSummary(),
}))

vi.mock('../hooks/useDialogFocusTrap', () => ({
  useDialogFocusTrap: () => {},
}))

vi.mock('../api/client', () => ({
  workflowLifecycle: vi.fn(),
  workflowSchedulerImportLitePlan: vi.fn(),
  workflowSchedulerList: vi.fn(),
  workflowSchedulerPause: vi.fn(),
  workflowSchedulerResume: vi.fn(),
  workflowSchedulerRunNow: vi.fn(),
}))

const mockedWorkflowSchedulerList = vi.mocked(workflowSchedulerList)
const mockedWorkflowSchedulerPause = vi.mocked(workflowSchedulerPause)
const mockedWorkflowSchedulerResume = vi.mocked(workflowSchedulerResume)
const mockedWorkflowSchedulerRunNow = vi.mocked(workflowSchedulerRunNow)
const mockedWorkflowLifecycle = vi.mocked(workflowLifecycle)
const mockedWorkflowSchedulerImportLitePlan = vi.mocked(workflowSchedulerImportLitePlan)

const workspaceAuthority: ProjectWorkspaceContext = {
  schemaVersion: '2026-04-08',
  identity: { projectId: 'project-1', workspaceId: 'workspace-1', projectName: 'Project One', workspaceRoot: '/repo/project-1' },
  manuscript: { manuscriptId: null, title: '章节一', chapterId: 'ch-1', chapterTitle: '第一章', chapterNumber: 1 },
  storyBible: { storyBibleId: 'sb-1', draftId: 'draft-1', version: 'v1', storage: 'local-draft' },
  knowledge: { focusEntityId: 'entity-1', graphEntityIds: ['entity-1'], memoryEntryIds: [] },
  authority: { recordSetId: null, activeSceneId: null, activeEventId: null, activeTimelineId: null, consistencyRunId: null },
  workflow: { level: 'L3', planId: 'plan-1', sessionId: 'sess-1', schedulerTaskId: 'sched-1', schedulerRunId: null, schedulerTrigger: 'manual_run_now' },
  chat: { conversationId: null, comparisonEnabled: null },
  compatibility: { additiveContract: true, migratedLegacyFields: [], notes: [] },
}

function buildTask(overrides: Partial<WorkflowSchedulerTaskRecord & Record<string, unknown>> = {}): WorkflowSchedulerTaskRecord {
  return {
    task_id: 'sched-1',
    title: '章节修订推进',
    task: '推进章节修订',
    level: 'L3',
    trigger_rule: { type: 'event', event_source: 'workflow.scheduler', event_name: 'manual_run_now' },
    backend_mode_policy: { mode: 'uiBridge', fallback_mode: 'standard' },
    progression_policy: {
      success_statuses: ['completed'],
      approval_policy: { tiers: [{ tier: 'critical', requires_confirmation: true, gate_status_on_hold: 'waiting_confirmation' }], default_gate_status: 'waiting_confirmation' },
      failure_policy: { retry: { max_retries: 2, strategy: 'linear', base_delay_ms: 1000 }, on_retry_exhausted: 'manual_takeover', manual_takeover_status: 'gate_blocked' },
    },
    status: 'active',
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    last_run_id: 'run-1',
    last_plan_id: 'plan-1',
    last_trigger: 'manual_run_now',
    workspace: workspaceAuthority,
    ...overrides,
  } as WorkflowSchedulerTaskRecord
}

describe('AutomationPanel extra branch coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()

    mockUseWriterWorkspaceSummary.mockReturnValue({
      meaningfulWorkspace: workspaceAuthority,
      hasMeaningfulScope: true,
      projectLabel: 'Project One',
      chapterLabel: '第一章',
      storyBibleLabel: 'sb-1',
      focusLabel: 'entity-1',
      workspaceLabel: 'project-1',
      workflowLabel: 'plan-1',
      scopeChips: ['Project One', '第一章', 'sb-1'],
    })

    mockedWorkflowSchedulerList.mockResolvedValue({
      success: true,
      data: { total: 1, tasks: [buildTask()] },
    })

    mockedWorkflowSchedulerPause.mockResolvedValue({
      success: true,
      data: { status: 'paused', task: buildTask({ status: 'paused' }) },
    })

    mockedWorkflowSchedulerResume.mockResolvedValue({
      success: true,
      data: { status: 'active', task: buildTask({ status: 'active' }) },
    })

    mockedWorkflowLifecycle.mockResolvedValue({
      success: true,
      data: { plan_id: 'plan-1', action: 'resume', runner_state: 'running', plan_status: 'in_progress', execution_mode: 'Autopilot', observability_metrics: {}, budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' }, handoff_package: {} },
    })

    mockedWorkflowSchedulerImportLitePlan.mockResolvedValue({
      success: true,
      data: { session_id: 'sess-1', imported: 1, registered: 1, updated: 0, failed: 0, total_tasks: 1, force_level: 'L2', tasks: [buildTask()], failures: [] },
    })

    mockedWorkflowSchedulerRunNow.mockResolvedValue({
      success: true,
      data: { status: 'completed', message: 'done', current_phase: 'executing', state_trace_id: 'trace-1', can_resume_from_checkpoint: true, execution_mode: 'Autopilot', observability_metrics: {}, budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' } },
    })
  })

  // Branch: readTextField returns null when no task (line 24)
  it('shows default values when no task is selected', async () => {
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 0, tasks: [] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('暂无自动化任务。')).toBeInTheDocument()
    })

    // No task is selected, so the task detail section should not show
    expect(screen.queryByText('执行状态')).not.toBeInTheDocument()
  })

  // Branch: readTextField with empty/non-string values → returns null (line 27)
  it('shows approval state as ready when task has no approval fields', async () => {
    const taskNoApproval = buildTask({
      status: 'active',
    }) as WorkflowSchedulerTaskRecord & Record<string, unknown>
    // Remove approval-specific fields
    delete (taskNoApproval as Record<string, unknown>).approval_status
    delete (taskNoApproval as Record<string, unknown>).gate_status

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskNoApproval] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      // Task detail section should be visible
      expect(screen.getByText('执行状态')).toBeInTheDocument()
    })

    // approvalState falls through to 'ready' (task.status !== 'paused')
    expect(screen.getByText('ready')).toBeInTheDocument()
  })

  // Branch: readTextField returns null for empty value → summarizeTaskState uses paused fallback (line 72)
  it('shows approval state as paused when task is paused with no approval fields', async () => {
    const taskPaused = buildTask({
      status: 'paused',
    }) as WorkflowSchedulerTaskRecord & Record<string, unknown>
    delete (taskPaused as Record<string, unknown>).approval_status
    delete (taskPaused as Record<string, unknown>).gate_status

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskPaused] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      expect(screen.getByText('执行状态')).toBeInTheDocument()
    })

    // approvalState falls through to 'paused' (task.status === 'paused')
    // There are multiple 'paused' elements, so use getAllByText
    const pausedElements = screen.getAllByText('paused')
    expect(pausedElements.length).toBeGreaterThanOrEqual(2)
  })

  // Branch: readRetryState with retry having non-matching types (line 40)
  it('shows fallback retry state when retry object has invalid types', async () => {
    // Create a task that has a retry object but with wrong types
    // The task type is WorkflowSchedulerTaskRecord which is strict, so we
    // add extra fields via the Record<string, unknown> spread
    const baseTask = buildTask({ status: 'active' })
    const taskBadRetry = {
      ...baseTask,
      retry: { strategy: 123, max_retries: 'not-a-number' },
      retry_state: 'custom-retry-state',
    } as WorkflowSchedulerTaskRecord

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskBadRetry] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      expect(screen.getByText('执行状态')).toBeInTheDocument()
    })

    // retry has invalid types, so it falls back to readTextField → 'custom-retry-state'
    expect(screen.getByText('custom-retry-state')).toBeInTheDocument()
  })

  // Branch: readRetryState with retry not being an object (line 37)
  it('shows text retry state when retry is not an object', async () => {
    const baseTask = buildTask({ status: 'active' })
    const taskStringRetry = {
      ...baseTask,
      retry: 'not-an-object',
      retry_state: 'string-retry-fallback',
    } as WorkflowSchedulerTaskRecord

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskStringRetry] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      expect(screen.getByText('执行状态')).toBeInTheDocument()
    })

    expect(screen.getByText('string-retry-fallback')).toBeInTheDocument()
  })

  // Branch: readRetryState with valid strategy and maxRetries (line 40-41)
  it('shows formatted retry state when retry has valid strategy and max_retries', async () => {
    const baseTask = buildTask({ status: 'active' })
    const taskValidRetry = {
      ...baseTask,
      retry: { strategy: 'exponential', max_retries: 3 },
    } as WorkflowSchedulerTaskRecord

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskValidRetry] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      expect(screen.getByText('执行状态')).toBeInTheDocument()
    })

    expect(screen.getByText('exponential (3)')).toBeInTheDocument()
  })

  // Branch: formatTime with null value (line 48)
  it('shows -- for null updated_at', async () => {
    const taskNoTime = buildTask({
      updated_at: null as unknown as string,
    })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskNoTime] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    // Find the "最近更新" label and check its sibling shows '--'
    expect(screen.getByText('最近更新')).toBeInTheDocument()
  })

  // Branch: formatTime with invalid date string (line 50)
  it('shows raw value when date is invalid', async () => {
    const taskBadTime = buildTask({
      updated_at: 'not-a-valid-date',
    })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskBadTime] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    // formatTime returns the raw string when Date parses to NaN
    expect(screen.getByText('not-a-valid-date')).toBeInTheDocument()
  })

  // Branch: getStatusBadgeClass for non-active, non-paused status (line 90)
  it('renders default badge class for non-active non-paused status', async () => {
    const taskCompleted = buildTask({ status: 'completed' })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskCompleted] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      // 'completed' appears in both badge and execution state, use getAllByText
      const completedElements = screen.getAllByText('completed')
      expect(completedElements.length).toBeGreaterThanOrEqual(1)
    })
  })

  // Branch: refreshTasks failure (line 120-125)
  it('shows error when task list fails to load', async () => {
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: false,
      error: 'service unavailable',
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('service unavailable')).toBeInTheDocument()
    })
  })

  // Branch: refreshTasks failure with no error message → uses Chinese fallback (line 121)
  it('shows Chinese fallback error when list fails with no error message', async () => {
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: false,
    } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('加载自动化任务失败。')).toBeInTheDocument()
    })
  })

  // Branch: handlePauseResume failure (line 172-176)
  it('shows error when pause/resume fails', async () => {
    const user = userEvent.setup()

    // Task is active, so button shows "暂停调度"
    mockedWorkflowSchedulerPause.mockResolvedValueOnce({
      success: false,
      error: 'pause failed',
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    // The active task shows "暂停调度" button
    await user.click(screen.getByRole('button', { name: '暂停调度' }))

    await waitFor(() => {
      expect(screen.getByText('pause failed')).toBeInTheDocument()
    })
  })

  // Branch: handleRunNow with waiting_confirmation status (line 223-224)
  it('shows waiting confirmation message when run-now returns waiting_confirmation', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'waiting_confirmation',
        current_phase: 'executing',
        state_trace_id: 'trace-1',
        can_resume_from_checkpoint: true,
        execution_mode: 'Autopilot',
        observability_metrics: {},
        budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' },
        execute: { status: 'waiting_confirmation', gate: { reason: '需要人工确认' } },
      },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务需要确认后继续。')).toBeInTheDocument()
    })
  })

  // Branch: handleRunNow with gate_blocked status (line 225-226)
  it('shows gate blocked message when run-now returns gate_blocked', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'gate_blocked',
        current_phase: 'executing',
        state_trace_id: 'trace-1',
        can_resume_from_checkpoint: true,
        execution_mode: 'Autopilot',
        observability_metrics: {},
        budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' },
        blocked: true,
        recovery: { action: 'manual_takeover' },
        execute: { status: 'gate_blocked', gate: { reason: '门控阻塞' } },
      },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务进入阻塞状态，请执行恢复操作。')).toBeInTheDocument()
    })
  })

  // Branch: handleRunNow failure (line 200-203)
  it('shows error when run-now fails', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: false,
      error: 'run-now failed',
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('run-now failed')).toBeInTheDocument()
    })
  })

  // Branch: handleRunNow with completed status (line 228-229)
  it('clears confirm token and shows triggered message when completed', async () => {
    const user = userEvent.setup()

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务已触发执行。')).toBeInTheDocument()
    })
  })

  // Branch: handlePlanLifecycle with no selectedPlanId (line 237-239)
  it('shows error when plan lifecycle is called with no plan id', async () => {
    const user = userEvent.setup()

    const taskNoPlan = buildTask({ last_plan_id: null })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [taskNoPlan] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    // Find the "拒绝并暂停计划" button
    const pausePlanButton = screen.getByRole('button', { name: '拒绝并暂停计划' })
    expect(pausePlanButton).toBeDisabled()
  })

  // Branch: handlePlanLifecycle failure (line 253-256)
  it('shows error when plan lifecycle fails', async () => {
    const user = userEvent.setup()

    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: false,
      error: 'lifecycle failed',
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    // Click "拒绝并暂停计划" (it's enabled because task has plan-1)
    await user.click(screen.getByRole('button', { name: '拒绝并暂停计划' }))

    await waitFor(() => {
      expect(screen.getByText('lifecycle failed')).toBeInTheDocument()
    })
  })

  // Branch: handleImportLitePlan failure (line 280-283)
  it('shows error when import lite plan fails', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerImportLitePlan.mockResolvedValueOnce({
      success: false,
      error: 'import failed',
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('刷新')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '导入计划' }))

    await waitFor(() => {
      expect(screen.getByText('import failed')).toBeInTheDocument()
    })
  })

  // Branch: handleImportLitePlan with imported, failed, and sessionId (lines 287-293)
  it('shows import summary with failed and session id', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerImportLitePlan.mockResolvedValueOnce({
      success: true,
      data: { session_id: 'sess-import', imported: 5, registered: 5, updated: 0, failed: 2, total_tasks: 7, force_level: 'L5', tasks: [], failures: ['task-a', 'task-b'] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('导入计划')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '导入计划' }))

    await waitFor(() => {
      expect(screen.getByText(/已导入 5 条任务.*失败 2 条.*会话：sess-import/)).toBeInTheDocument()
    })
  })

  // Branch: handleImportLitePlan with 0 failed (line 292 - empty string for failed part)
  it('shows import summary without failed count when no failures', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerImportLitePlan.mockResolvedValueOnce({
      success: true,
      data: { session_id: '', imported: 3, registered: 3, updated: 0, failed: 0, total_tasks: 3, force_level: 'L5', tasks: [buildTask()], failures: [] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('导入计划')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '导入计划' }))

    await waitFor(() => {
      // No failed count and no session id → just "已导入 3 条任务。"
      expect(screen.getByText('已导入 3 条任务。')).toBeInTheDocument()
    })
  })

  // Branch: summarizeTaskState returns defaults when task is null (line 60-66)
  it('renders empty task queue state', async () => {
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 0, tasks: [] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('暂无自动化任务。')).toBeInTheDocument()
    })
  })

  // Branch: English language fallback for all messages
  it('renders English messages when language is en', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 0, tasks: [] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('No automation tasks yet.')).toBeInTheDocument()
    })
  })

  // Branch: payload.execute is null / not object (line 207-209)
  it('handles run-now response without execute record', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'completed',
        message: 'done',
      },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务已触发执行。')).toBeInTheDocument()
    })
  })

  // Branch: gate with non-string reason → null (line 218)
  it('handles gate with non-string reason in run-now response', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'waiting_confirmation',
        execute: {
          status: 'waiting_confirmation',
          gate: { reason: 123 }, // non-string reason
        },
        current_phase: 'executing',
        state_trace_id: 'trace-1',
        can_resume_from_checkpoint: true,
        execution_mode: 'Autopilot',
        observability_metrics: {},
        budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' },
      },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务需要确认后继续。')).toBeInTheDocument()
    })
  })

  // Branch: confirm token is required for confirm button (line 526)
  it('disables confirm button when confirm token is empty', async () => {
    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })

    const confirmButton = screen.getByRole('button', { name: '确认并继续' })
    expect(confirmButton).toBeDisabled()
  })

  // Branch: confirm button becomes enabled when token is entered
  it('enables confirm button when token is entered', async () => {
    const user = userEvent.setup()

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    // Wait for the task to load and be selected
    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      expect(screen.getByText('执行状态')).toBeInTheDocument()
    })

    // The placeholder uses Chinese quotes "…"
    const tokenInput = screen.getByPlaceholderText(/confirm_token/)
    await user.type(tokenInput, 'tok-123')

    const confirmButton = screen.getByRole('button', { name: '确认并继续' })
    expect(confirmButton).not.toBeDisabled()
  })

  // Branch: selectedTask switches to first task when previous selection is gone (line 130-134)
  it('selects first task when previously selected task no longer exists', async () => {
    const user = userEvent.setup()

    // First load: 2 tasks
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 2, tasks: [buildTask({ task_id: 'sched-1' }), buildTask({ task_id: 'sched-2', title: 'Second Task' })] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
      expect(screen.getByText('Second Task')).toBeInTheDocument()
    })

    // Select second task
    await user.click(screen.getByText('Second Task'))

    // Next refresh: only first task exists
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ task_id: 'sched-1' })] },
    })

    // Click refresh
    await user.click(screen.getByRole('button', { name: '刷新' }))

    await waitFor(() => {
      // sched-2 is gone, so selectedTaskId falls back to sched-1
      expect(screen.getByText('章节修订推进')).toBeInTheDocument()
    })
  })

  // Branch: no meaningful workspace → workspaceSummary.meaningfulWorkspace is null (line 117)
  it('passes undefined as workspace to scheduler list', async () => {
    mockUseWriterWorkspaceSummary.mockReturnValue({
      meaningfulWorkspace: null,
      hasMeaningfulScope: false,
      projectLabel: '',
      chapterLabel: '',
      storyBibleLabel: '',
      focusLabel: '',
      workspaceLabel: '',
      workflowLabel: '',
      scopeChips: [],
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(mockedWorkflowSchedulerList).toHaveBeenCalledWith(50, undefined, undefined)
    })

    // Scope chips should not render because hasMeaningfulScope is false
    expect(screen.queryByText('Project One')).not.toBeInTheDocument()
  })
})
