import { afterEach, describe, expect, it, vi } from 'vitest';

const routeMock = vi.fn();
const planMock = vi.fn();
const executeMock = vi.fn();
const quickRollbackMock = vi.fn();
const lifecycleMock = vi.fn();
const createCheckpointMock = vi.fn();
const restoreCheckpointMock = vi.fn();
const listCheckpointsMock = vi.fn();
const getCheckpointMock = vi.fn();
const checkpointsMock = new Map<string, Record<string, unknown>>();

vi.mock('../../workflow/workflow-engine.js', () => ({
  WorkflowEngine: vi.fn().mockImplementation(() => ({
    route: routeMock,
    plan: planMock,
    execute: executeMock,
    quickRollback: quickRollbackMock,
    lifecycle: lifecycleMock,
    createCheckpoint: createCheckpointMock,
    restoreCheckpoint: restoreCheckpointMock,
    listCheckpoints: listCheckpointsMock,
    getCheckpoint: getCheckpointMock,
    checkpoints: checkpointsMock,
  })),
}));

describe('mcp workflow service', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    checkpointsMock.clear();
  });

  it('delegates route/plan/execute to WorkflowEngine with adapted arguments', async () => {
    routeMock.mockResolvedValueOnce({ level: 'L2' });
    planMock.mockResolvedValueOnce({ plan_id: 'plan-1' });
    executeMock.mockResolvedValueOnce({ status: 'completed', plan_id: 'plan-1' });

    const { workflowRoute, workflowPlan, workflowExecute } = await import('../../mcp/services/workflow.js');

    const route = await workflowRoute('写一段场景');
    const plan = await workflowPlan({
      task: '写一段场景',
      level: 'L2',
      recommendations: [{ title: '保留冲突' }],
    });
    const execute = await workflowExecute({
      planId: 'plan-1',
      stepId: 'step-1',
      recommendations: [{ title: '保留冲突' }],
      confirmToken: 'token-1',
    });

    expect(routeMock).toHaveBeenCalledWith('写一段场景');
    expect(planMock).toHaveBeenCalledWith('写一段场景', 'L2', [{ title: '保留冲突' }]);
    expect(executeMock).toHaveBeenCalledWith('plan-1', 'step-1', [{ title: '保留冲突' }], 'token-1');
    expect(route).toEqual({ level: 'L2' });
    expect(plan).toEqual({ plan_id: 'plan-1' });
    expect(execute).toEqual({ status: 'completed', plan_id: 'plan-1' });
  });

  it('delegates lifecycle and checkpoint helpers to WorkflowEngine', async () => {
    quickRollbackMock.mockResolvedValueOnce({ restored: true });
    lifecycleMock.mockResolvedValueOnce({ runner_state: 'paused' });
    createCheckpointMock.mockResolvedValueOnce({ checkpoint_id: 'cp-1' });
    restoreCheckpointMock.mockResolvedValueOnce({ status: 'restored' });
    listCheckpointsMock.mockResolvedValueOnce([{ id: 'cp-1' }]);
    getCheckpointMock.mockImplementation((checkpointId: string) => {
      if (checkpointId !== 'cp-1') return null;
      return {
        id: 'cp-1',
        description: 'snapshot',
        commit_hash: null,
        created_at: '2026-04-20T00:00:00.000Z',
        plan_id: null,
        step_id: null,
        replay_payload: {},
      };
    });
    checkpointsMock.set('cp-1', {
      id: 'cp-1',
      description: 'snapshot',
      created_at: '2026-04-20T00:00:00.000Z',
      replay_payload: {},
      plan_id: null,
      step_id: null,
    });

    const {
      workflowQuickRollback,
      workflowLifecycle,
      checkpointCreate,
      checkpointRestore,
      checkpointList,
    } = await import('../../mcp/services/workflow.js');

    await workflowQuickRollback({ planId: 'plan-1', checkpointId: 'cp-1', reason: 'rollback' });
    await workflowLifecycle('plan-1', 'pause');
    await checkpointCreate('snapshot', false);
    await checkpointRestore('cp-1', 'confirm-token');
    const checkpoints = await checkpointList(5);

    expect(quickRollbackMock).toHaveBeenCalledWith('plan-1', 'cp-1', 'rollback');
    expect(lifecycleMock).toHaveBeenCalledWith('plan-1', 'pause');
    expect(createCheckpointMock).toHaveBeenCalledWith('snapshot', false);
    expect(restoreCheckpointMock).toHaveBeenCalledWith('cp-1', 'confirm-token');
    expect(listCheckpointsMock).toHaveBeenCalledWith(5);
    expect(checkpoints).toEqual([{ id: 'cp-1' }]);
  });

  it('registers/lists/pauses/resumes and runs scheduler tasks', async () => {
    planMock.mockResolvedValueOnce({ plan_id: 'plan-scheduler-1' });
    executeMock.mockResolvedValueOnce({ status: 'completed', step_name: 'analyze' });

    const {
      workflowSchedulerRegister,
      workflowSchedulerList,
      workflowSchedulerPause,
      workflowSchedulerResume,
      workflowSchedulerRunNow,
    } = await import('../../mcp/services/workflow.js');

    const definition = {
      task_id: 'sched-1',
      title: 'Nightly delivery',
      task: '推进项目到完成',
      level: 'L3',
      schedule_rule: { cadence: 'cron', cron: '0 2 * * *', timezone: 'Asia/Shanghai' },
      trigger_rule: { type: 'manual_run_now', run_now: true },
      backend_mode_policy: { mode: 'inherit', fallback_mode: 'standard' },
      progression_policy: {
        success_statuses: ['completed'],
        approval_policy: {
          tiers: [
            { tier: 'critical', requires_confirmation: true, gate_status_on_hold: 'waiting_confirmation' },
          ],
          default_gate_status: 'waiting_confirmation',
        },
        failure_policy: {
          retry: { max_retries: 2, strategy: 'fixed', base_delay_ms: 1000 },
          on_retry_exhausted: 'manual_takeover',
          manual_takeover_status: 'gate_blocked',
        },
      },
    };

    const registerResult = await workflowSchedulerRegister({
      definition,
      workspace: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'project-1',
          workspaceRoot: '/tmp/workspace-1',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: null,
          chapterTitle: null,
          chapterNumber: null,
        },
        storyBible: {
          storyBibleId: null,
          draftId: null,
          version: null,
          storage: 'workspace',
        },
        knowledge: {
          focusEntityId: null,
          graphEntityIds: [],
          memoryEntryIds: [],
        },
        workflow: {
          sessionId: 'workflow-session-1',
          planId: null,
          level: null,
        },
        chat: {
          conversationId: 'workflow-session-1',
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    });

    expect(registerResult['status']).toBe('registered');

    const listResult = await workflowSchedulerList({ limit: 10 });
    expect(Array.isArray(listResult['tasks'])).toBe(true);
    expect((listResult['tasks'] as Array<Record<string, unknown>>).some((item) => item['task_id'] === 'sched-1')).toBe(true);

    const pauseResult = await workflowSchedulerPause({ taskId: 'sched-1' });
    expect(pauseResult['status']).toBe('paused');

    const pausedRun = await workflowSchedulerRunNow({ taskId: 'sched-1' });
    expect(pausedRun['error']).toContain('paused');

    const resumeResult = await workflowSchedulerResume({ taskId: 'sched-1' });
    expect(resumeResult['status']).toBe('active');

    const runResult = await workflowSchedulerRunNow({ taskId: 'sched-1' });
    expect(runResult['status']).toBe('completed');
    expect(runResult['trigger']).toBe('manual_run_now');
    expect(runResult['plan_id']).toBe('plan-scheduler-1');

    expect(planMock).toHaveBeenCalledWith('推进项目到完成', 'L3', []);
    expect(executeMock).toHaveBeenCalledWith('plan-scheduler-1', undefined, undefined, undefined);
  });
});
