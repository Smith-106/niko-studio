import { afterEach, describe, expect, it, vi } from 'vitest';

const routeMock = vi.fn();
const planMock = vi.fn();
const executeMock = vi.fn();
const quickRollbackMock = vi.fn();
const lifecycleMock = vi.fn();
const createCheckpointMock = vi.fn();
const restoreCheckpointMock = vi.fn();
const bindPlanSessionMock = vi.fn();
const listCheckpointsMock = vi.fn();
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
    bindPlanSession: bindPlanSessionMock,
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
      traceContext: {
        requestId: 'req-1',
        route: '^/workflow/plan$',
        method: 'POST',
        startAtMs: 123,
      },
    });
    const execute = await workflowExecute({
      planId: 'plan-1',
      stepId: 'step-1',
      recommendations: [{ title: '保留冲突' }],
      confirmToken: 'token-1',
    });

    expect(routeMock).toHaveBeenCalledWith('写一段场景');
    expect(planMock).toHaveBeenCalledWith(
      '写一段场景',
      'L2',
      [{ title: '保留冲突' }],
      {
        trace_context: {
          requestId: 'req-1',
          route: '^/workflow/plan$',
          method: 'POST',
          startAtMs: 123,
        },
      },
    );
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

    const taskId = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const definition = {
      task_id: taskId,
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
    expect((listResult['tasks'] as Array<Record<string, unknown>>).some((item) => item['task_id'] === taskId)).toBe(true);

    const pauseResult = await workflowSchedulerPause({ taskId });
    expect(pauseResult['status']).toBe('paused');

    const pausedRun = await workflowSchedulerRunNow({ taskId });
    expect(pausedRun['error']).toContain('paused');

    const resumeResult = await workflowSchedulerResume({ taskId });
    expect(resumeResult['status']).toBe('active');

    const runResult = await workflowSchedulerRunNow({ taskId });
    expect(runResult['status']).toBe('completed');
    expect(runResult['trigger']).toBe('manual_run_now');
    expect(runResult['plan_id']).toBe('plan-scheduler-1');

    expect(planMock).toHaveBeenCalledWith('推进项目到完成', 'L3', [], undefined);
    expect(executeMock).toHaveBeenCalledWith('plan-scheduler-1', undefined, undefined, undefined);
  });

  it('supports runtime provider override for workflow engine construction', async () => {
    const providerPlanMock = vi.fn().mockResolvedValue({ plan_id: 'plan-provider' });
    const providerRouteMock = vi.fn().mockResolvedValue({ level: 'L2' });
    const providerExecuteMock = vi.fn().mockResolvedValue({ status: 'completed' });
    const providerQuickRollbackMock = vi.fn().mockResolvedValue({ restored: true });
    const providerLifecycleMock = vi.fn().mockResolvedValue({ runner_state: 'running' });
    const providerCreateCheckpointMock = vi.fn().mockResolvedValue({ checkpoint_id: 'cp-provider' });
    const providerRestoreCheckpointMock = vi.fn().mockResolvedValue({ status: 'restored' });
    const providerListCheckpointsMock = vi.fn().mockResolvedValue([]);
    const providerBindPlanSessionMock = vi.fn().mockReturnValue('session-1');

    const {
      setWorkflowEngineRuntimeProvider,
      resetWorkflowEngineRuntimeProvider,
      workflowPlan,
    } = await import('../../mcp/services/workflow.js');

    const provider = vi.fn().mockReturnValue({
      route: providerRouteMock,
      plan: providerPlanMock,
      execute: providerExecuteMock,
      quickRollback: providerQuickRollbackMock,
      lifecycle: providerLifecycleMock,
      createCheckpoint: providerCreateCheckpointMock,
      restoreCheckpoint: providerRestoreCheckpointMock,
      listCheckpoints: providerListCheckpointsMock,
      bindPlanSession: providerBindPlanSessionMock,
    });

    setWorkflowEngineRuntimeProvider(provider);

    await workflowPlan({ task: 'provider-plan-task' });

    expect(provider).toHaveBeenCalledWith({
      workspace: expect.any(String),
      sessionNamespace: 'mcp-workflow',
    });
    expect(providerPlanMock).toHaveBeenCalledWith('provider-plan-task', undefined, [], undefined);

    resetWorkflowEngineRuntimeProvider();
  });

  it('forwards trace context into engine execution context payload for planning', async () => {
    planMock.mockResolvedValueOnce({ plan_id: 'plan-trace-context' });

    const { workflowPlan } = await import('../../mcp/services/workflow.js');

    const workspace = {
      schemaVersion: '2026-04-08',
      identity: {
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        projectName: 'Atlas Project',
        workspaceRoot: '/tmp/atlas-project',
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
        sessionId: 'workflow-session-trace',
        planId: null,
        level: 'L2',
      },
      chat: {
        conversationId: 'conversation-trace',
        comparisonEnabled: false,
      },
      compatibility: {
        additiveContract: true,
        migratedLegacyFields: [],
        notes: [],
      },
    };

    await workflowPlan({
      task: 'trace planning path',
      level: 'L2',
      workspace,
      traceContext: {
        requestId: 'req-trace-plan-1',
        route: '^/workflow/plan$',
        method: 'POST',
        startAtMs: 100,
      },
    });

    expect(planMock).toHaveBeenCalledWith(
      'trace planning path',
      'L2',
      [],
      {
        trace_context: {
          requestId: 'req-trace-plan-1',
          route: '^/workflow/plan$',
          method: 'POST',
          startAtMs: 100,
        },
      },
    );
  });

  it('rebuilds cached engine when composition-root provider changes after first use', async () => {
    routeMock.mockResolvedValueOnce({ level: 'L2-default' });

    const { workflowRoute } = await import('../../mcp/services/workflow.js');
    const {
      setWorkflowEngineRuntimeProvider,
      resetWorkflowEngineRuntimeProvider,
    } = await import('../../container/workflow-runtime-provider.js');

    const providerRouteMock = vi.fn().mockResolvedValue({ level: 'L3-provider' });
    const provider = vi.fn().mockReturnValue({
      route: providerRouteMock,
      plan: planMock,
      execute: executeMock,
      quickRollback: quickRollbackMock,
      lifecycle: lifecycleMock,
      createCheckpoint: createCheckpointMock,
      restoreCheckpoint: restoreCheckpointMock,
      listCheckpoints: listCheckpointsMock,
      bindPlanSession: bindPlanSessionMock,
    });

    await workflowRoute('default-runtime');
    setWorkflowEngineRuntimeProvider(provider);
    await workflowRoute('provider-runtime');

    expect(provider).toHaveBeenCalledWith({
      workspace: expect.any(String),
      sessionNamespace: 'mcp-workflow',
    });
    expect(providerRouteMock).toHaveBeenCalledWith('provider-runtime');

    resetWorkflowEngineRuntimeProvider();
  });

  it('uses workflow runtime provider from composition root when gateway control plane initializes', async () => {
    const runtimePlanMock = vi.fn().mockResolvedValue({ plan_id: 'plan-composition-root' });
    const runtimeProvider = vi.fn().mockReturnValue({
      route: routeMock,
      plan: runtimePlanMock,
      execute: executeMock,
      quickRollback: quickRollbackMock,
      lifecycle: lifecycleMock,
      createCheckpoint: createCheckpointMock,
      restoreCheckpoint: restoreCheckpointMock,
      listCheckpoints: listCheckpointsMock,
      bindPlanSession: bindPlanSessionMock,
    });

    const { setWorkflowEngineRuntimeProvider } = await import('../../container/workflow-runtime-provider.js');
    const {
      initializeGatewayControlPlane,
    } = await import('../../container/gateway-control-plane.js');
    const { workflowPlan, resetWorkflowEngineRuntimeProvider } = await import('../../mcp/services/workflow.js');

    initializeGatewayControlPlane({
      workflow: {
        createRuntime: runtimeProvider,
      },
    } as unknown as Parameters<typeof initializeGatewayControlPlane>[0]);

    await workflowPlan({ task: 'composition-root-plan-task' });

    expect(runtimeProvider).toHaveBeenCalledWith({
      workspace: expect.any(String),
      sessionNamespace: 'mcp-workflow',
    });
    expect(runtimePlanMock).toHaveBeenCalledWith('composition-root-plan-task', undefined, [], undefined);

    resetWorkflowEngineRuntimeProvider();
    setWorkflowEngineRuntimeProvider(undefined);
  });
});
