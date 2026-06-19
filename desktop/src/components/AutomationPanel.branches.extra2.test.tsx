import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  workflowLifecycle,
  workflowSchedulerImportLitePlan,
  workflowSchedulerList,
  workflowSchedulerPause,
  workflowSchedulerResume,
  workflowSchedulerRunNow,
  type WorkflowSchedulerTaskRecord,
} from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import type { ProjectWorkspaceContext } from '../types/workspace'
import { AutomationPanel, readRetryState, readTextField } from './AutomationPanel'

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

const emptySummary = {
  meaningfulWorkspace: null,
  hasMeaningfulScope: false,
  projectLabel: '',
  chapterLabel: '',
  storyBibleLabel: '',
  focusLabel: '',
  workspaceLabel: '',
  workflowLabel: '',
  scopeChips: [],
}

describe('AutomationPanel extra2 branch coverage', () => {
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

  // Lines 24, 35: direct unit tests for exported helper null-guards
  it('readTextField returns null for null task', () => {
    expect(readTextField(null, ['blocked_reason'])).toBeNull()
  })

  it('readRetryState returns null for null task', () => {
    expect(readRetryState(null)).toBeNull()
  })

  // Lines 169, 179 (zh): resume a paused task (meaningfulWorkspace truthy)
  it('shows Chinese resumed message when resuming a paused task', async () => {
    const user = userEvent.setup()
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'paused' })] },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '恢复调度' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '恢复调度' }))

    await waitFor(() => {
      expect(screen.getByText('已恢复调度任务。')).toBeInTheDocument()
    })
  })

  // Lines 170, 180 (zh): pause an active task (success path)
  it('shows Chinese paused message when pausing an active task', async () => {
    const user = userEvent.setup()

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '暂停调度' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '暂停调度' }))

    await waitFor(() => {
      expect(screen.getByText('已暂停调度任务。')).toBeInTheDocument()
    })
  })

  // Lines 169, 170, 179, 180 (en): pause/resume success messages in English
  it('shows English paused and resumed messages', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause schedule' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Pause schedule' }))

    await waitFor(() => {
      expect(screen.getByText('Scheduler task paused.')).toBeInTheDocument()
    })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'paused' })] },
    })

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Resume schedule' })).toBeInTheDocument()
    })

    mockedWorkflowSchedulerResume.mockResolvedValueOnce({
      success: true,
      data: { status: 'active', task: buildTask({ status: 'active' }) },
    })

    await user.click(screen.getByRole('button', { name: 'Resume schedule' }))

    await waitFor(() => {
      expect(screen.getByText('Scheduler task resumed.')).toBeInTheDocument()
    })
  })

  // Lines 169, 170, 250: pause/resume/plan-lifecycle with meaningfulWorkspace null
  it('calls scheduler APIs with undefined workspace when meaningfulWorkspace is null', async () => {
    const user = userEvent.setup()
    mockUseWriterWorkspaceSummary.mockReturnValue(emptySummary)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '暂停调度' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '暂停调度' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerPause).toHaveBeenCalledWith('sched-1', undefined, undefined)
    })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'paused' })] },
    })

    await user.click(screen.getByRole('button', { name: '刷新' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '恢复调度' })).toBeInTheDocument()
    })

    mockedWorkflowSchedulerResume.mockResolvedValueOnce({
      success: true,
      data: { status: 'active', task: buildTask({ status: 'active' }) },
    })

    await user.click(screen.getByRole('button', { name: '恢复调度' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerResume).toHaveBeenCalledWith('sched-1', undefined, undefined)
    })

    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'active' })] },
    })

    await user.click(screen.getByRole('button', { name: '刷新' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '拒绝并暂停计划' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '拒绝并暂停计划' }))

    await waitFor(() => {
      expect(mockedWorkflowLifecycle).toHaveBeenCalledWith('plan-1', 'pause', undefined, undefined)
    })
  })

  // Line 173: pause/resume failure with no error message (?? fallback) in zh
  it('shows Chinese fallback error when pause fails without error', async () => {
    const user = userEvent.setup()
    mockedWorkflowSchedulerPause.mockResolvedValueOnce({ success: false } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '暂停调度' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '暂停调度' }))

    await waitFor(() => {
      expect(screen.getByText('更新任务状态失败。')).toBeInTheDocument()
    })
  })

  // Line 173: pause/resume failure with no error message (?? fallback) in en
  it('shows English fallback error when pause fails without error', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerPause.mockResolvedValueOnce({ success: false } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Pause schedule' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Pause schedule' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to update task status.')).toBeInTheDocument()
    })
  })

  // Lines 206, 212: run-now success with no data -> 206 (?? null branch), 212 (executeRecord null -> completed)
  it('handles run-now success with no response data', async () => {
    const user = userEvent.setup()
    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({ success: true } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '立即执行 / 重试' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务已触发执行。')).toBeInTheDocument()
    })
  })

  // Line 212: run-now response derives status from executeRecord.status
  it('derives run status from execute record when top-level status is missing', async () => {
    const user = userEvent.setup()
    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: { execute: { status: 'running' } },
    } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '立即执行 / 重试' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务已触发执行。')).toBeInTheDocument()
    })
  })

  // Line 226 (en): gate_blocked message in English
  it('shows English gate-blocked message', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: { execute: { status: 'gate_blocked', gate: { reason: 'blocked' } } },
    } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Run now / Retry' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Run now / Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Task is gate-blocked. Run a recovery action.')).toBeInTheDocument()
    })
  })

  // Lines 254, 260, 261 (zh): plan lifecycle failure fallback and success messages
  it('shows Chinese lifecycle fallback error and success messages', async () => {
    const user = userEvent.setup()

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '拒绝并暂停计划' })).toBeInTheDocument()
    })

    // Failure with no error -> 254 zh fallback
    mockedWorkflowLifecycle.mockResolvedValueOnce({ success: false } as never)
    await user.click(screen.getByRole('button', { name: '拒绝并暂停计划' }))
    await waitFor(() => {
      expect(screen.getByText('生命周期操作失败。')).toBeInTheDocument()
    })

    // Pause plan success -> 260 zh
    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: true,
      data: { plan_id: 'plan-1', action: 'pause', runner_state: 'paused', plan_status: 'paused', execution_mode: 'Autopilot', observability_metrics: {}, budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' }, handoff_package: {} },
    })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'active' })] },
    })
    await user.click(screen.getByRole('button', { name: '拒绝并暂停计划' }))
    await waitFor(() => {
      expect(screen.getByText('计划已暂停。')).toBeInTheDocument()
    })

    // Resume plan success -> 261 zh
    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: true,
      data: { plan_id: 'plan-1', action: 'resume', runner_state: 'running', plan_status: 'in_progress', execution_mode: 'Autopilot', observability_metrics: {}, budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' }, handoff_package: {} },
    })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'active' })] },
    })
    await user.click(screen.getByRole('button', { name: '恢复计划' }))
    await waitFor(() => {
      expect(screen.getByText('计划已恢复。')).toBeInTheDocument()
    })
  })

  // Lines 254, 260, 261 (en): plan lifecycle messages in English
  it('shows English lifecycle fallback error and success messages', async () => {
    const user = userEvent.setup()
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reject & Pause plan' })).toBeInTheDocument()
    })

    mockedWorkflowLifecycle.mockResolvedValueOnce({ success: false } as never)
    await user.click(screen.getByRole('button', { name: 'Reject & Pause plan' }))
    await waitFor(() => {
      expect(screen.getByText('Lifecycle action failed.')).toBeInTheDocument()
    })

    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: true,
      data: { plan_id: 'plan-1', action: 'pause', runner_state: 'paused', plan_status: 'paused', execution_mode: 'Autopilot', observability_metrics: {}, budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' }, handoff_package: {} },
    })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'active' })] },
    })
    await user.click(screen.getByRole('button', { name: 'Reject & Pause plan' }))
    await waitFor(() => {
      expect(screen.getByText('Plan paused.')).toBeInTheDocument()
    })

    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: true,
      data: { plan_id: 'plan-1', action: 'resume', runner_state: 'running', plan_status: 'in_progress', execution_mode: 'Autopilot', observability_metrics: {}, budget_guardrail: { threshold_triggered: false, degraded: false, degrade_mode: 'none' }, handoff_package: {} },
    })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: { total: 1, tasks: [buildTask({ status: 'active' })] },
    })
    await user.click(screen.getByRole('button', { name: 'Resume plan' }))
    await waitFor(() => {
      expect(screen.getByText('Plan resumed.')).toBeInTheDocument()
    })
  })

  // Line 286: import lite plan success with no data
  it('handles import lite plan success with no response data', async () => {
    const user = userEvent.setup()
    mockedWorkflowSchedulerImportLitePlan.mockResolvedValueOnce({ success: true } as never)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '导入计划' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '导入计划' }))

    await waitFor(() => {
      expect(screen.getByText('已导入 0 条任务。')).toBeInTheDocument()
    })
  })
})
