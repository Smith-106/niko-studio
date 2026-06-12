import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubPlanDispatcher } from '../../../workflow/delegate/sub-plan.js';

function createBroker(
  completions: Record<
    string,
    { status: 'completed' | 'failed'; result?: unknown; error?: string }
  > = {},
) {
  let counter = 0;
  const idToTask = new Map<string, string>();

  return {
    submit: vi.fn(async (spec: { task: string }) => {
      const id = `delegate-${++counter}`;
      idToTask.set(id, spec.task);
      return id;
    }),
    wait: vi.fn(async (id: string) => {
      const task = idToTask.get(id) ?? '';
      const completion = completions[task] ?? { status: 'completed', result: task };
      return {
        id,
        status: completion.status,
        result: completion.result,
        error: completion.error,
      };
    }),
  };
}

describe('workflow/delegate/sub-plan additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks cyclic mixed sub-plans as cancelled without dispatching delegates', async () => {
    const broker = createBroker();
    const dispatcher = new SubPlanDispatcher(broker as never);

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-cycle',
      aggregation: 'mixed',
      subTasks: [
        { id: 'sub-1', task: 'outline', dependsOn: ['sub-2'] },
        { id: 'sub-2', task: 'draft', dependsOn: ['sub-1'] },
      ],
    });

    expect(result.status).toBe('failed');
    expect(result.aggregateResult).toEqual({});
    expect(result.subResults.get('sub-1')).toMatchObject({
      status: 'cancelled',
      error: 'Dependency failed or was cancelled',
    });
    expect(result.subResults.get('sub-2')).toMatchObject({
      status: 'cancelled',
      error: 'Dependency failed or was cancelled',
    });
    expect(broker.submit).not.toHaveBeenCalled();
  });

  it('converts rejected parallel batches into failed sub-results', async () => {
    const broker = createBroker();
    const dispatcher = new SubPlanDispatcher(broker as never);
    vi.spyOn(dispatcher as never, '_runSubTask' as never)
      .mockResolvedValueOnce({
        id: 'sub-1',
        status: 'completed',
        result: 'context',
        error: null,
        completedAt: '2026-06-05T00:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('parallel batch exploded'));

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-parallel-reject',
      aggregation: 'parallel',
      maxParallelism: 2,
      subTasks: [
        { id: 'sub-1', task: 'collect' },
        { id: 'sub-2', task: 'draft' },
      ],
    });

    expect(result.status).toBe('partial');
    expect(result.aggregateResult).toEqual({ 'sub-1': 'context' });
    expect(result.subResults.get('sub-2')).toMatchObject({
      status: 'failed',
      error: 'Error: parallel batch exploded',
    });
  });

  it('converts rejected mixed batches into failed sub-results', async () => {
    const broker = createBroker();
    const dispatcher = new SubPlanDispatcher(broker as never);
    vi.spyOn(dispatcher as never, '_runSubTask' as never)
      .mockResolvedValueOnce({
        id: 'sub-1',
        status: 'completed',
        result: 'seed',
        error: null,
        completedAt: '2026-06-05T00:00:00.000Z',
      })
      .mockRejectedValueOnce(new Error('mixed batch exploded'));

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-mixed-reject',
      aggregation: 'mixed',
      maxParallelism: 2,
      subTasks: [
        { id: 'sub-1', task: 'seed' },
        { id: 'sub-2', task: 'branch' },
      ],
    });

    expect(result.status).toBe('partial');
    expect(result.aggregateResult).toEqual({ 'sub-1': 'seed' });
    expect(result.subResults.get('sub-2')).toMatchObject({
      status: 'failed',
      error: 'Error: mixed batch exploded',
    });
  });

  it('returns ordered sequential aggregates when multiple sub-tasks complete', async () => {
    const broker = createBroker({
      collect: { status: 'completed', result: 'context' },
      write: { status: 'completed', result: 'draft' },
    });
    const dispatcher = new SubPlanDispatcher(broker as never);

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-sequential-array',
      aggregation: 'sequential',
      subTasks: [
        { id: 'sub-1', task: 'collect' },
        { id: 'sub-2', task: 'write', dependsOn: ['sub-1'] },
      ],
    });

    expect(result.status).toBe('completed');
    expect(result.aggregateResult).toEqual([
      { id: 'sub-1', result: 'context' },
      { id: 'sub-2', result: 'draft' },
    ]);
  });

  it('keeps bookkeeping intact when an execution strategy throws at the top level', async () => {
    const broker = createBroker();
    const eventBus = { publish: vi.fn() };
    const dispatcher = new SubPlanDispatcher(broker as never, eventBus as never);
    vi.spyOn(dispatcher as never, '_executeParallel' as never).mockRejectedValueOnce(
      new Error('strategy exploded'),
    );

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-top-level-catch',
      aggregation: 'parallel',
      subTasks: [{ id: 'sub-1', task: 'noop' }],
    });

    expect(result.status).toBe('completed');
    expect(result.subResults.size).toBe(0);
    expect(result.aggregateResult).toEqual({});
    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:subplan-completed',
      expect.objectContaining({
        parentTaskId: 'plan-top-level-catch',
        status: 'completed',
        completedCount: 0,
      }),
    );
  });

  it('treats unexpected delegate states as failures and catches broker submission errors', async () => {
    const eventBus = { publish: vi.fn() };
    const broker = {
      submit: vi
        .fn()
        .mockResolvedValueOnce('delegate-1')
        .mockRejectedValueOnce(new Error('submit failed')),
      wait: vi.fn().mockResolvedValueOnce({
        id: 'delegate-1',
        status: 'cancelled',
        result: 'ignored',
        error: null,
      }),
    };
    const dispatcher = new SubPlanDispatcher(broker as never, eventBus as never);

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-broker-failures',
      aggregation: 'parallel',
      subTasks: [
        { id: 'sub-1', task: 'unexpected-status' },
        { id: 'sub-2', task: 'submit-failure' },
      ],
    });

    expect(result.status).toBe('failed');
    expect(result.aggregateResult).toEqual({});
    expect(result.subResults.get('sub-1')).toMatchObject({
      status: 'failed',
      result: 'ignored',
      error: null,
    });
    expect(result.subResults.get('sub-2')).toMatchObject({
      status: 'failed',
      error: 'Error: submit failed',
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:subtask-completed',
      expect.objectContaining({
        parentTaskId: 'plan-broker-failures',
        subTaskId: 'sub-2',
        status: 'failed',
      }),
    );
  });
});
