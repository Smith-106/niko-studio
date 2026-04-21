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
  identity: {
    projectId: 'project-1',
    workspaceId: 'workspace-1',
    projectName: 'Project One',
    workspaceRoot: '/repo/project-1',
  },
  manuscript: {
    manuscriptId: null,
    title: '章节一',
    chapterId: 'ch-1',
    chapterTitle: '第一章',
    chapterNumber: 1,
  },
  storyBible: {
    storyBibleId: 'sb-1',
    draftId: 'draft-1',
    version: 'v1',
    storage: 'local-draft',
  },
  knowledge: {
    focusEntityId: 'entity-1',
    graphEntityIds: ['entity-1'],
    memoryEntryIds: [],
  },
  workflow: {
    level: 'L3',
    planId: 'plan-1',
    sessionId: 'sess-1',
    schedulerTaskId: 'sched-1',
    schedulerRunId: null,
    schedulerTrigger: 'manual_run_now',
  },
  chat: {
    conversationId: null,
    comparisonEnabled: null,
  },
  compatibility: {
    additiveContract: true,
    migratedLegacyFields: [],
    notes: [],
  },
}

function buildLifecycleResponse(action: WorkflowLifecycleResponse['action']): WorkflowLifecycleResponse {
  return {
    plan_id: 'plan-1',
    action,
    runner_state: action === 'pause' ? 'paused' : 'running',
    plan_status: action === 'pause' ? 'paused' : 'in_progress',
    execution_mode: 'Autopilot',
    observability_metrics: {},
    budget_guardrail: {
      threshold_triggered: false,
      degraded: false,
      degrade_mode: 'none',
    },
    handoff_package: {},
  }
}

function buildExecuteResponse(
  status: 'completed' | 'waiting_confirmation' | 'gate_blocked',
  gateReason?: string,
): WorkflowExecuteResponse {
  const base = {
    current_phase: 'executing',
    state_trace_id: 'trace-1',
    can_resume_from_checkpoint: true,
    execution_mode: 'Autopilot',
    observability_metrics: {},
    budget_guardrail: {
      threshold_triggered: false,
      degraded: false,
      degrade_mode: 'none',
    },
  }

  if (status === 'waiting_confirmation') {
    return {
      ...base,
      status: 'waiting_confirmation',
      gate: {
        reason: gateReason ?? '等待人工确认',
      },
    } as WorkflowExecuteResponse
  }

  if (status === 'gate_blocked') {
    return {
      ...base,
      status: 'gate_blocked',
      blocked: true,
      recovery: {
        action: 'manual_takeover',
      },
      gate: {
        reason: gateReason ?? '门控阻塞，需人工恢复',
      },
    } as WorkflowExecuteResponse
  }

  return {
    ...base,
    status: 'completed',
    message: 'done',
  } as WorkflowExecuteResponse
}

function buildTask(overrides: Partial<WorkflowSchedulerTaskRecord> = {}): WorkflowSchedulerTaskRecord {
  return {
    task_id: 'sched-1',
    title: '章节修订推进',
    task: '推进章节修订',
    level: 'L3',
    trigger_rule: {
      type: 'event',
      event_source: 'workflow.scheduler',
      event_name: 'manual_run_now',
    },
    backend_mode_policy: {
      mode: 'uiBridge',
      fallback_mode: 'standard',
    },
    progression_policy: {
      success_statuses: ['completed'],
      approval_policy: {
        tiers: [
          {
            tier: 'critical',
            requires_confirmation: true,
            gate_status_on_hold: 'waiting_confirmation',
          },
        ],
        default_gate_status: 'waiting_confirmation',
      },
      failure_policy: {
        retry: {
          max_retries: 2,
          strategy: 'linear',
          base_delay_ms: 1000,
        },
        on_retry_exhausted: 'manual_takeover',
        manual_takeover_status: 'gate_blocked',
      },
    },
    status: 'active',
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    last_run_id: 'run-1',
    last_plan_id: 'plan-1',
    last_trigger: 'manual_run_now',
    workspace: workspaceAuthority,
    ...overrides,
  }
}

describe('AutomationPanel reliability regressions', () => {
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
      data: {
        total: 1,
        tasks: [buildTask()],
      },
    })

    mockedWorkflowSchedulerPause.mockResolvedValue({
      success: true,
      data: {
        status: 'paused',
        task: buildTask({ status: 'paused' }),
      },
    })

    mockedWorkflowSchedulerResume.mockResolvedValue({
      success: true,
      data: {
        status: 'active',
        task: buildTask({ status: 'active' }),
      },
    })

    mockedWorkflowLifecycle.mockResolvedValue({
      success: true,
      data: buildLifecycleResponse('resume'),
    })

    mockedWorkflowSchedulerImportLitePlan.mockResolvedValue({
      success: true,
      data: {
        session_id: 'sess-1',
        imported: 1,
        registered: 1,
        updated: 0,
        failed: 0,
        total_tasks: 1,
      },
    })
  })

  it('threads workspace authority through scheduler and lifecycle actions', async () => {
    const user = userEvent.setup()

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('章节修订推进')).toBeInTheDocument()
    expect(mockedWorkflowSchedulerList).toHaveBeenCalledWith(50, undefined, workspaceAuthority)

    await user.click(screen.getByRole('button', { name: '暂停调度' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerPause).toHaveBeenCalledWith('sched-1', undefined, workspaceAuthority)
      expect(screen.getByText('已暂停调度任务。')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '恢复计划' }))

    await waitFor(() => {
      expect(mockedWorkflowLifecycle).toHaveBeenCalledWith('plan-1', 'resume', undefined, workspaceAuthority)
      expect(screen.getByText('计划已恢复。')).toBeInTheDocument()
    })
  })

  it('handles waiting-confirmation transition and confirm-token recovery', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'waiting_confirmation',
          trigger: 'manual_run_now',
          run_id: 'run-2',
          plan_id: 'plan-1',
          task: buildTask(),
          execute: buildExecuteResponse('waiting_confirmation', '等待人工确认'),
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'completed',
          trigger: 'manual_run_now',
          run_id: 'run-3',
          plan_id: 'plan-1',
          task: buildTask(),
          execute: buildExecuteResponse('completed'),
        },
      })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await screen.findByText('章节修订推进')
    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerRunNow).toHaveBeenNthCalledWith(
        1,
        'sched-1',
        undefined,
        undefined,
        undefined,
        workspaceAuthority,
      )
      expect(screen.getByText('任务需要确认后继续。')).toBeInTheDocument()
      expect(screen.getByText('等待人工确认')).toBeInTheDocument()
    })

    const confirmInput = screen.getByPlaceholderText('输入 confirm_token 后点击“确认并继续”') as HTMLInputElement
    await user.type(confirmInput, 'confirm-token')
    await user.click(screen.getByRole('button', { name: '确认并继续' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerRunNow).toHaveBeenNthCalledWith(
        2,
        'sched-1',
        undefined,
        undefined,
        'confirm-token',
        workspaceAuthority,
      )
      expect(screen.getByText('任务已触发执行。')).toBeInTheDocument()
      expect(confirmInput).toHaveValue('')
    })
  })

  it('imports lite-plan tasks with L5 policy and refreshes scheduler list', async () => {
    const user = userEvent.setup()

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await screen.findByText('章节修订推进')
    await user.click(screen.getByRole('button', { name: '导入计划' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerImportLitePlan).toHaveBeenCalledWith(
        undefined,
        'L5',
        true,
        undefined,
        workspaceAuthority,
      )
      expect(screen.getByText('已导入 1 条任务（会话：sess-1）。')).toBeInTheDocument()
      expect(mockedWorkflowSchedulerList).toHaveBeenCalledTimes(2)
      expect(mockedWorkflowSchedulerList).toHaveBeenLastCalledWith(50, undefined, workspaceAuthority)
    })
  })

  it('supports gate-blocked recovery and panel-level interaction wiring', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onOpenSettings = vi.fn()

    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'gate_blocked',
        trigger: 'manual_run_now',
        run_id: 'run-4',
        plan_id: 'plan-1',
        task: buildTask(),
        execute: buildExecuteResponse('gate_blocked', '门控阻塞，需人工恢复'),
      },
    })

    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: true,
      data: buildLifecycleResponse('pause'),
    })

    render(<AutomationPanel onClose={onClose} onOpenSettings={onOpenSettings} />)

    await screen.findByText('章节修订推进')
    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务进入阻塞状态，请执行恢复操作。')).toBeInTheDocument()
      expect(screen.getByText('门控阻塞，需人工恢复')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '拒绝并暂停计划' }))

    await waitFor(() => {
      expect(mockedWorkflowLifecycle).toHaveBeenCalledWith('plan-1', 'pause', undefined, workspaceAuthority)
      expect(screen.getByText('计划已暂停。')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '设置' }))
    await user.click(screen.getByRole('button', { name: '关闭' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
