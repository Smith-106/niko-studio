import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn())
const normalizeRecommendationsMock = vi.hoisted(() => vi.fn())
const resolveWorkflowEndpointMock = vi.hoisted(() => vi.fn())
const resolveWorkflowSchedulerEndpointMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

vi.mock('../workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

vi.mock('./contracts', () => ({
  normalizeRecommendations: normalizeRecommendationsMock,
}))

vi.mock('./endpoints', () => ({
  resolveWorkflowEndpoint: resolveWorkflowEndpointMock,
  resolveWorkflowSchedulerEndpoint: resolveWorkflowSchedulerEndpointMock,
}))

import {
  createPlan,
  executePlan,
  getPlanStatus,
  routeWorkflow,
  uiCreatePlan,
  uiExecutePlan,
  uiRouteWorkflow,
  uiWorkflowLifecycle,
  uiWorkflowSchedulerImportLitePlan,
  uiWorkflowSchedulerList,
  uiWorkflowSchedulerPause,
  uiWorkflowSchedulerRegister,
  uiWorkflowSchedulerResume,
  uiWorkflowSchedulerRunNow,
  workflowLifecycle,
  workflowSchedulerImportLitePlan,
  workflowSchedulerList,
  workflowSchedulerPause,
  workflowSchedulerRegister,
  workflowSchedulerResume,
  workflowSchedulerRunNow,
} from './plans'

describe('workflow plans api bridge', () => {
  const workspace = { identity: { workspaceId: 'ws-1' } } as any

  beforeEach(() => {
    vi.clearAllMocks()
    callApiMock.mockResolvedValue({ success: true, data: {} })
    appendWorkspacePayloadMock.mockImplementation((payload, currentWorkspace) => ({
      ...payload,
      workspace: currentWorkspace,
    }))
    normalizeRecommendationsMock.mockImplementation((value) => {
      if (!Array.isArray(value)) {
        return []
      }
      return value.map((item, index) => ({
        id: `rec-${index + 1}`,
        title: typeof item === 'string' ? item : item.title ?? `Recommendation ${index + 1}`,
        reason: typeof item === 'string' ? item : item.reason ?? '',
        action: 'apply',
      }))
    })
    resolveWorkflowEndpointMock.mockImplementation((path, mode) => `workflow:${mode ?? 'default'}:${path}`)
    resolveWorkflowSchedulerEndpointMock.mockImplementation((path, mode) => `scheduler:${mode ?? 'default'}:${path}`)
  })

  it('routes workflow and ui-route requests through the expected endpoints', async () => {
    await routeWorkflow('draft chapter', 'L3', workspace)
    await uiRouteWorkflow('revise chapter', 'L2', workspace)

    expect(resolveWorkflowEndpointMock).toHaveBeenNthCalledWith(1, '/route')
    expect(resolveWorkflowEndpointMock).toHaveBeenNthCalledWith(2, '/route', 'uiBridge')
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(1, {
      task: 'draft chapter',
      level: 'L3',
    }, workspace)
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(2, {
      task: 'revise chapter',
      level: 'L2',
    }, workspace)
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'workflow:default:/route', 'POST', {
      task: 'draft chapter',
      level: 'L3',
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'workflow:uiBridge:/route', 'POST', {
      task: 'revise chapter',
      level: 'L2',
      workspace,
    })
  })

  it('normalizes plan recommendations and omits the field when the normalized list is empty', async () => {
    normalizeRecommendationsMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: 'rec-2', title: 'Keep conflict', reason: '', action: 'apply' }])

    await createPlan('task-a', 'L1', ['raw-rec'], 'standard', workspace)
    await uiCreatePlan('task-b', 'L2', ['raw-rec'], workspace)

    expect(resolveWorkflowEndpointMock).toHaveBeenNthCalledWith(1, '/plan', 'standard')
    expect(resolveWorkflowEndpointMock).toHaveBeenNthCalledWith(2, '/plan', 'uiBridge')
    expect(normalizeRecommendationsMock).toHaveBeenNthCalledWith(1, ['raw-rec'])
    expect(normalizeRecommendationsMock).toHaveBeenNthCalledWith(2, ['raw-rec'])
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(1, {
      task: 'task-a',
      level: 'L1',
      recommendations: undefined,
    }, workspace)
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(2, {
      task: 'task-b',
      level: 'L2',
      recommendations: [{ id: 'rec-2', title: 'Keep conflict', reason: '', action: 'apply' }],
    }, workspace)
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'workflow:standard:/plan', 'POST', {
      task: 'task-a',
      level: 'L1',
      recommendations: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'workflow:uiBridge:/plan', 'POST', {
      task: 'task-b',
      level: 'L2',
      recommendations: [{ id: 'rec-2', title: 'Keep conflict', reason: '', action: 'apply' }],
      workspace,
    })
  })

  it('normalizes execute payloads and trims confirm tokens', async () => {
    normalizeRecommendationsMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ id: 'rec-3', title: 'Tighten pacing', reason: '', action: 'apply' }])

    await executePlan('plan-1', 'step-1', ['raw-rec'], 'standard', '   ', workspace)
    await uiExecutePlan('plan-2', undefined, ['raw-rec'], ' confirm-token ', workspace)

    expect(resolveWorkflowEndpointMock).toHaveBeenNthCalledWith(1, '/execute', 'standard')
    expect(resolveWorkflowEndpointMock).toHaveBeenNthCalledWith(2, '/execute', 'uiBridge')
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(1, {
      plan_id: 'plan-1',
      step_id: 'step-1',
      confirm_token: undefined,
      recommendations: undefined,
    }, workspace)
    expect(appendWorkspacePayloadMock).toHaveBeenNthCalledWith(2, {
      plan_id: 'plan-2',
      step_id: undefined,
      confirm_token: ' confirm-token ',
      recommendations: [{ id: 'rec-3', title: 'Tighten pacing', reason: '', action: 'apply' }],
    }, workspace)
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'workflow:standard:/execute', 'POST', {
      plan_id: 'plan-1',
      step_id: 'step-1',
      confirm_token: undefined,
      recommendations: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'workflow:uiBridge:/execute', 'POST', {
      plan_id: 'plan-2',
      step_id: undefined,
      confirm_token: ' confirm-token ',
      recommendations: [{ id: 'rec-3', title: 'Tighten pacing', reason: '', action: 'apply' }],
      workspace,
    })
  })

  it('routes lifecycle and scheduler control requests through plan and ui-bridge variants', async () => {
    const schedulerTask = {
      task_id: 'sched-1',
      title: 'Nightly run',
      task: 'review release evidence',
      trigger_rule: { type: 'manual_run_now', run_now: true },
      backend_mode_policy: { mode: 'inherit' },
      progression_policy: {
        success_statuses: ['completed'],
        approval_policy: { tiers: [], default_gate_status: 'waiting_confirmation' },
        failure_policy: {
          retry: { max_retries: 1, strategy: 'fixed', base_delay_ms: 1000 },
          on_retry_exhausted: 'manual_takeover',
          manual_takeover_status: 'gate_blocked',
        },
      },
    } as any

    await workflowLifecycle('plan-1', 'pause', 'standard', workspace)
    await uiWorkflowLifecycle('plan-2', 'status', workspace)
    await getPlanStatus('plan-3')
    await workflowSchedulerRegister(schedulerTask, true, 'standard', workspace)
    await uiWorkflowSchedulerRegister(schedulerTask, false, workspace)
    await workflowSchedulerList(10, 'standard', workspace)
    await uiWorkflowSchedulerList(undefined, workspace)
    await workflowSchedulerPause('sched-1', 'standard', workspace)
    await uiWorkflowSchedulerPause('sched-2', workspace)
    await workflowSchedulerResume('sched-3', 'standard', workspace)
    await uiWorkflowSchedulerResume('sched-4', workspace)

    expect(callApiMock).toHaveBeenNthCalledWith(1, 'workflow:standard:/lifecycle', 'POST', {
      plan_id: 'plan-1',
      action: 'pause',
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'workflow:uiBridge:/lifecycle', 'POST', {
      plan_id: 'plan-2',
      action: 'status',
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(3, 'workflow:default:/lifecycle', 'POST', {
      plan_id: 'plan-3',
      action: 'status',
      workspace: undefined,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, 'scheduler:standard:/scheduler/register', 'POST', {
      task: schedulerTask,
      enabled: true,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(5, 'scheduler:uiBridge:/scheduler/register', 'POST', {
      task: schedulerTask,
      enabled: false,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(6, 'scheduler:standard:/scheduler/list', 'POST', {
      limit: 10,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(7, 'scheduler:uiBridge:/scheduler/list', 'POST', {
      limit: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(8, 'scheduler:standard:/scheduler/pause', 'POST', {
      task_id: 'sched-1',
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(9, 'scheduler:uiBridge:/scheduler/pause', 'POST', {
      task_id: 'sched-2',
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(10, 'scheduler:standard:/scheduler/resume', 'POST', {
      task_id: 'sched-3',
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(11, 'scheduler:uiBridge:/scheduler/resume', 'POST', {
      task_id: 'sched-4',
      workspace,
    })
  })

  it('normalizes run-now and import-lite-plan payloads for both standard and ui-bridge flows', async () => {
    normalizeRecommendationsMock
      .mockReturnValueOnce([{ id: 'rec-4', title: 'Preserve conflict', reason: '', action: 'apply' }])
      .mockReturnValueOnce([])

    await workflowSchedulerRunNow('sched-1', ['raw-rec'], 'standard', '   ', workspace)
    await uiWorkflowSchedulerRunNow('sched-2', ['raw-rec'], 'confirm-yes', workspace)
    await workflowSchedulerImportLitePlan('   ', '   ', true, 'standard', workspace)
    await uiWorkflowSchedulerImportLitePlan('session-1', 'L3', false, workspace)

    expect(callApiMock).toHaveBeenNthCalledWith(1, 'scheduler:standard:/scheduler/run-now', 'POST', {
      task_id: 'sched-1',
      confirm_token: undefined,
      recommendations: [{ id: 'rec-4', title: 'Preserve conflict', reason: '', action: 'apply' }],
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'scheduler:uiBridge:/scheduler/run-now', 'POST', {
      task_id: 'sched-2',
      confirm_token: 'confirm-yes',
      recommendations: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(3, 'scheduler:standard:/scheduler/import-lite-plan', 'POST', {
      session_id: undefined,
      force_level: undefined,
      enabled: true,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, 'scheduler:uiBridge:/scheduler/import-lite-plan', 'POST', {
      session_id: 'session-1',
      force_level: 'L3',
      enabled: false,
      workspace,
    })
  })

  it('covers complementary optional payload branches across plan and scheduler helpers', async () => {
    await createPlan('task-c', 'L4', ['raw-rec'], 'standard', workspace)
    await uiCreatePlan('task-d', 'L5', undefined, workspace)
    await executePlan('plan-3', undefined, ['raw-rec'], 'standard', 'confirm-me', workspace)
    await uiExecutePlan('plan-4', 'step-4', undefined, '   ', workspace)
    await workflowSchedulerRunNow('sched-5', undefined, 'standard', 'confirm-now', workspace)
    await uiWorkflowSchedulerRunNow('sched-6', ['raw-rec'], '   ', workspace)
    await workflowSchedulerImportLitePlan('session-2', 'L2', true, 'standard', workspace)
    await uiWorkflowSchedulerImportLitePlan('   ', '   ', false, workspace)

    expect(callApiMock).toHaveBeenNthCalledWith(1, 'workflow:standard:/plan', 'POST', {
      task: 'task-c',
      level: 'L4',
      recommendations: [{ id: 'rec-1', title: 'raw-rec', reason: 'raw-rec', action: 'apply' }],
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'workflow:uiBridge:/plan', 'POST', {
      task: 'task-d',
      level: 'L5',
      recommendations: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(3, 'workflow:standard:/execute', 'POST', {
      plan_id: 'plan-3',
      step_id: undefined,
      confirm_token: 'confirm-me',
      recommendations: [{ id: 'rec-1', title: 'raw-rec', reason: 'raw-rec', action: 'apply' }],
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, 'workflow:uiBridge:/execute', 'POST', {
      plan_id: 'plan-4',
      step_id: 'step-4',
      confirm_token: undefined,
      recommendations: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(5, 'scheduler:standard:/scheduler/run-now', 'POST', {
      task_id: 'sched-5',
      confirm_token: 'confirm-now',
      recommendations: undefined,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(6, 'scheduler:uiBridge:/scheduler/run-now', 'POST', {
      task_id: 'sched-6',
      confirm_token: undefined,
      recommendations: [{ id: 'rec-1', title: 'raw-rec', reason: 'raw-rec', action: 'apply' }],
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(7, 'scheduler:standard:/scheduler/import-lite-plan', 'POST', {
      session_id: 'session-2',
      force_level: 'L2',
      enabled: true,
      workspace,
    })
    expect(callApiMock).toHaveBeenNthCalledWith(8, 'scheduler:uiBridge:/scheduler/import-lite-plan', 'POST', {
      session_id: undefined,
      force_level: undefined,
      enabled: false,
      workspace,
    })
  })
})
