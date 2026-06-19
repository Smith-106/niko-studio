import { useState } from 'react'
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
  authority: {
    recordSetId: null,
    activeSceneId: null,
    activeEventId: null,
    activeTimelineId: null,
    consistencyRunId: null,
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
        force_level: 'L2',
        tasks: [buildTask()],
        failures: [],
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

  it('refreshes the scheduler list from the top-level refresh button', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()
    expect(mockedWorkflowSchedulerList).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerList).toHaveBeenCalledTimes(2)
      expect(mockedWorkflowSchedulerList).toHaveBeenLastCalledWith(50, undefined, workspaceAuthority)
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

  it('falls back to execute.status when the run-now payload omits the top-level status', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        trigger: 'manual_run_now',
        run_id: 'run-fallback',
        plan_id: 'plan-1',
        task: buildTask(),
        execute: buildExecuteResponse('waiting_confirmation', 'Need explicit approval'),
      },
    } as Awaited<ReturnType<typeof workflowSchedulerRunNow>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run now / Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Task is waiting for confirmation.')).toBeInTheDocument()
      expect(screen.getByText('Need explicit approval')).toBeInTheDocument()
      expect(screen.getByText('waiting_confirmation')).toBeInTheDocument()
    })
  })

  it('treats non-object execute payloads as completed when top-level status is present', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'completed',
        trigger: 'manual_run_now',
        run_id: 'run-top-level-status',
        plan_id: 'plan-1',
        task: buildTask(),
        execute: 'invalid-execute-record',
      },
    } as Awaited<ReturnType<typeof workflowSchedulerRunNow>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run now / Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Task execution triggered.')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
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

  it('includes failed-count and session details in the english import success message', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerImportLitePlan.mockResolvedValueOnce({
      success: true,
      data: {
        session_id: 'sess-failed',
        imported: 2,
        registered: 2,
        updated: 0,
        failed: 1,
        total_tasks: 3,
        force_level: 'L5',
        tasks: [buildTask()],
        failures: [{ task_id: 'task-2' }],
      },
    } as Awaited<ReturnType<typeof workflowSchedulerImportLitePlan>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import plan' }))

    await waitFor(() => {
      expect(screen.getByText('Imported 2 task(s), 1 failed (session: sess-failed).')).toBeInTheDocument()
    })
  })

  it('rejects and pauses the active plan from the manual intervention actions', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: true,
      data: buildLifecycleResponse('pause'),
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reject & Pause plan' }))

    await waitFor(() => {
      expect(mockedWorkflowLifecycle).toHaveBeenCalledWith('plan-1', 'pause', undefined, workspaceAuthority)
      expect(screen.getByText('Plan paused.')).toBeInTheDocument()
    })
  })


  it('shows loading progress followed by the empty queue state', async () => {
    let resolveList: ((value: { success: boolean; data: { total: number; tasks: WorkflowSchedulerTaskRecord[] } }) => void) | null = null

    mockedWorkflowSchedulerList.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveList = resolve
      }) as ReturnType<typeof workflowSchedulerList>,
    )

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()

    await act(async () => {
      resolveList?.({
        success: true,
        data: {
          total: 0,
          tasks: [],
        },
      })
    })

    expect(await screen.findByText('暂无自动化任务。')).toBeInTheDocument()
  })

  it('falls back to the default load error when the scheduler list request fails', async () => {
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: false,
      error: undefined,
    } as Awaited<ReturnType<typeof workflowSchedulerList>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('加载自动化任务失败。')).toBeInTheDocument()
    expect(screen.queryByText('章节修订推进')).not.toBeInTheDocument()
  })

  it('renders english state summaries, fallback retry fields, and top-level controls', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onOpenSettings = vi.fn()

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockUseWriterWorkspaceSummary.mockReturnValue({
      meaningfulWorkspace: workspaceAuthority,
      hasMeaningfulScope: false,
      projectLabel: 'Project One',
      chapterLabel: 'Chapter 1',
      storyBibleLabel: 'sb-1',
      focusLabel: 'entity-1',
      workspaceLabel: 'project-1',
      workflowLabel: 'plan-1',
      scopeChips: [],
    })
    mockedWorkflowSchedulerList.mockResolvedValue({
      success: true,
      data: {
        total: 2,
        tasks: [
          buildTask({
            status: 'paused',
            updated_at: 'not-a-date',
            last_plan_id: null,
            retry: {
              strategy: 'linear',
              max_retries: 3,
            } as never,
            approval_status: 'awaiting_review' as never,
            blocked_reason: 'Needs manual review' as never,
            next_action: 'Resume after review' as never,
          }),
          buildTask({
            task_id: 'sched-2',
            title: 'Background sync',
            task: 'Sync notes',
            status: 'blocked' as never,
            last_plan_id: 'plan-2',
            updated_at: null,
            gate_status: 'blocked' as never,
            retry_status: 'backoff-pending' as never,
            pending_reason: 'Waiting on token' as never,
            recommended_action: 'Open settings' as never,
          }),
        ],
      },
    })

    render(<AutomationPanel onClose={onClose} onOpenSettings={onOpenSettings} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()
    expect(screen.getByText('Run status')).toBeInTheDocument()
    expect(screen.getByText('awaiting_review')).toBeInTheDocument()
    expect(screen.getByText('linear (3)')).toBeInTheDocument()
    expect(screen.getByText('Needs manual review')).toBeInTheDocument()
    expect(screen.getByText('Resume after review')).toBeInTheDocument()
    expect(screen.getByText('not-a-date')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume schedule' }))

    await waitFor(() => {
      expect(mockedWorkflowSchedulerResume).toHaveBeenCalledWith('sched-1', undefined, workspaceAuthority)
      expect(screen.getByText('Scheduler task resumed.')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Background sync'))

    expect(await screen.findByText('backoff-pending')).toBeInTheDocument()
    expect(screen.getByText('Waiting on token')).toBeInTheDocument()
    expect(screen.getByText('Open settings')).toBeInTheDocument()
    expect(screen.getByText('plan-2')).toBeInTheDocument()

    const blockedBadge = screen.getAllByText('blocked').find((node) => node.className.includes('bg-gray-100'))
    expect(blockedBadge).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('surfaces gate-blocked, pause, lifecycle, import, and run-now failure states', async () => {
    const user = userEvent.setup()

    mockedWorkflowSchedulerRunNow
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'gate_blocked',
          trigger: 'manual_run_now',
          run_id: 'run-blocked',
          plan_id: 'plan-1',
          task: buildTask(),
          execute: buildExecuteResponse('gate_blocked', '门控阻塞，需人工恢复'),
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: undefined,
      } as Awaited<ReturnType<typeof workflowSchedulerRunNow>>)

    mockedWorkflowSchedulerPause.mockResolvedValueOnce({
      success: false,
      error: undefined,
    } as Awaited<ReturnType<typeof workflowSchedulerPause>>)
    mockedWorkflowLifecycle.mockResolvedValueOnce({
      success: false,
      error: undefined,
    } as Awaited<ReturnType<typeof workflowLifecycle>>)
    mockedWorkflowSchedulerImportLitePlan.mockResolvedValueOnce({
      success: false,
      error: undefined,
    } as Awaited<ReturnType<typeof workflowSchedulerImportLitePlan>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await screen.findByText('章节修订推进')

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('任务进入阻塞状态，请执行恢复操作。')).toBeInTheDocument()
      expect(screen.getAllByText('门控阻塞，需人工恢复').length).toBeGreaterThan(0)
    })

    await user.click(screen.getByRole('button', { name: '暂停调度' }))

    await waitFor(() => {
      expect(screen.getByText('更新任务状态失败。')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '恢复计划' }))

    await waitFor(() => {
      expect(screen.getByText('生命周期操作失败。')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '导入计划' }))

    await waitFor(() => {
      expect(screen.getByText('导入 lite-plan 任务失败。')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '立即执行 / 重试' }))

    await waitFor(() => {
      expect(screen.getByText('执行 run-now 失败。')).toBeInTheDocument()
    })
  })

  it('passes undefined workspace and renders the english empty state when the payload omits tasks', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockUseWriterWorkspaceSummary.mockReturnValue({
      meaningfulWorkspace: null,
      hasMeaningfulScope: false,
      projectLabel: 'Project One',
      chapterLabel: 'Chapter 1',
      storyBibleLabel: 'sb-1',
      focusLabel: 'entity-1',
      workspaceLabel: 'project-1',
      workflowLabel: 'plan-1',
      scopeChips: [],
    })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: {},
    } as Awaited<ReturnType<typeof workflowSchedulerList>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('No automation tasks yet.')).toBeInTheDocument()
    expect(mockedWorkflowSchedulerList).toHaveBeenCalledWith(50, undefined, undefined)
    expect(screen.queryByText('Execution state')).not.toBeInTheDocument()
  })

  it('renders sparse english metadata fallbacks for tasks with missing optional fields', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: {
        total: 1,
        tasks: [
          buildTask({
            status: 'blocked' as never,
            last_trigger: null as never,
            updated_at: null,
            last_plan_id: null,
            retry: null as never,
          }),
        ],
      },
    })

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()
    expect(screen.getByText('ready')).toBeInTheDocument()
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(4)
  })

  it('shows the processing label while resuming a paused scheduler task', async () => {
    const user = userEvent.setup()
    let resolveResume: ((value: Awaited<ReturnType<typeof workflowSchedulerResume>>) => void) | null = null

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: true,
      data: {
        total: 1,
        tasks: [buildTask({ status: 'paused' })],
      },
    })
    mockedWorkflowSchedulerResume.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveResume = resolve
      }) as ReturnType<typeof workflowSchedulerResume>,
    )

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resume schedule' }))

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeInTheDocument()

    await act(async () => {
      resolveResume?.({
        success: true,
        data: {
          status: 'active',
          task: buildTask({ status: 'active' }),
        },
      } as Awaited<ReturnType<typeof workflowSchedulerResume>>)
    })

    await waitFor(() => {
      expect(screen.getByText('Scheduler task resumed.')).toBeInTheDocument()
    })
  })

  it('shows the confirming label while confirmation submission is pending', async () => {
    const user = userEvent.setup()
    let resolveConfirm: ((value: Awaited<ReturnType<typeof workflowSchedulerRunNow>>) => void) | null = null

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerRunNow
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'waiting_confirmation',
          trigger: 'manual_run_now',
          run_id: 'run-waiting',
          plan_id: 'plan-1',
          task: buildTask(),
          execute: buildExecuteResponse('waiting_confirmation', 'Need explicit approval'),
        },
      } as Awaited<ReturnType<typeof workflowSchedulerRunNow>>)
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveConfirm = resolve
        }) as ReturnType<typeof workflowSchedulerRunNow>,
      )

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run now / Retry' }))
    await user.type(
      screen.getByPlaceholderText('Enter confirm_token then click Confirm & Continue'),
      'confirm-token',
    )
    await user.click(screen.getByRole('button', { name: 'Confirm & Continue' }))

    expect(screen.getByRole('button', { name: 'Confirming...' })).toBeInTheDocument()

    await act(async () => {
      resolveConfirm?.({
        success: true,
        data: {
          status: 'completed',
          trigger: 'manual_run_now',
          run_id: 'run-confirmed',
          plan_id: 'plan-1',
          task: buildTask(),
          execute: buildExecuteResponse('completed'),
        },
      } as Awaited<ReturnType<typeof workflowSchedulerRunNow>>)
    })

    await waitFor(() => {
      expect(screen.getByText('Task execution triggered.')).toBeInTheDocument()
    })
  })

  it('uses english defaults for run-now, load, and import fallback copy', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockUseWriterWorkspaceSummary.mockReturnValue({
      meaningfulWorkspace: null,
      hasMeaningfulScope: false,
      projectLabel: 'Project One',
      chapterLabel: 'Chapter 1',
      storyBibleLabel: 'sb-1',
      focusLabel: 'entity-1',
      workspaceLabel: 'project-1',
      workflowLabel: 'plan-1',
      scopeChips: [],
    })
    mockedWorkflowSchedulerRunNow.mockResolvedValueOnce({
      success: false,
      error: undefined,
    } as Awaited<ReturnType<typeof workflowSchedulerRunNow>>)
    mockedWorkflowSchedulerImportLitePlan
      .mockResolvedValueOnce({
        success: true,
        data: {},
      } as Awaited<ReturnType<typeof workflowSchedulerImportLitePlan>>)
      .mockResolvedValueOnce({
        success: false,
        error: undefined,
      } as Awaited<ReturnType<typeof workflowSchedulerImportLitePlan>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Automation tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Run now / Retry' }))
    await waitFor(() => {
      expect(mockedWorkflowSchedulerRunNow).toHaveBeenCalledWith(
        'sched-1',
        undefined,
        undefined,
        undefined,
        undefined,
      )
      expect(screen.getByText('Failed to run task now.')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Import plan' }))
    await waitFor(() => {
      expect(mockedWorkflowSchedulerImportLitePlan).toHaveBeenNthCalledWith(
        1,
        undefined,
        'L5',
        true,
        undefined,
        undefined,
      )
      expect(screen.getByText('Imported 0 task(s).')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Import plan' }))
    await waitFor(() => {
      expect(screen.getByText('Failed to import lite-plan tasks.')).toBeInTheDocument()
    })
  })

  it('uses the english default load error copy when the scheduler request fails', async () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockedWorkflowSchedulerList.mockResolvedValueOnce({
      success: false,
      error: undefined,
    } as Awaited<ReturnType<typeof workflowSchedulerList>>)

    render(<AutomationPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(await screen.findByText('Failed to load automation tasks.')).toBeInTheDocument()
  })

  it('restores focus to the opener when the automation panel closes', async () => {
    const user = userEvent.setup()

    function AutomationPanelHarness() {
      const [open, setOpen] = useState(false)

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>open automation</button>
          {open ? <AutomationPanel onClose={() => setOpen(false)} onOpenSettings={() => {}} /> : null}
        </>
      )
    }

    render(<AutomationPanelHarness />)

    const openButton = screen.getByRole('button', { name: 'open automation' })
    await user.click(openButton)

    const refreshButton = await screen.findByRole('button', { name: '刷新' })
    await waitFor(() => {
      expect(refreshButton).toHaveFocus()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '自动化面板' })).not.toBeInTheDocument()
      expect(openButton).toHaveFocus()
    })
  })
})
