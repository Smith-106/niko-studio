import { afterEach, describe, expect, it, vi } from 'vitest';

const routeMock = vi.fn();
const planMock = vi.fn();
const executeMock = vi.fn();
const quickRollbackMock = vi.fn();
const lifecycleMock = vi.fn();
const createCheckpointMock = vi.fn();
const restoreCheckpointMock = vi.fn();
const listCheckpointsMock = vi.fn();

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
  })),
}));

describe('mcp workflow service', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
