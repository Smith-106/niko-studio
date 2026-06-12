import { describe, expect, it, vi } from 'vitest';

import { SubPlanDispatcher } from '../../../workflow/delegate/sub-plan.js';

function createBroker(
  completions: Record<
    string,
    { status: 'completed' | 'failed'; result?: unknown; error?: string }
  >,
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
      const task = idToTask.get(id)!;
      const completion = completions[task];
      return {
        id,
        status: completion.status,
        result: completion.result,
        error: completion.error,
      };
    }),
  };
}

describe('workflow/delegate/sub-plan', () => {
  it('runs parallel sub-plans in batches and merges completed results', async () => {
    const broker = createBroker({
      collect: { status: 'completed', result: 'context' },
      draft: { status: 'completed', result: 'scene' },
      review: { status: 'completed', result: 'notes' },
    });
    const eventBus = { publish: vi.fn() };
    const dispatcher = new SubPlanDispatcher(broker as never, eventBus as never);

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-1',
      aggregation: 'parallel',
      maxParallelism: 2,
      subTasks: [
        { id: 'sub-1', task: 'collect' },
        { id: 'sub-2', task: 'draft' },
        { id: 'sub-3', task: 'review' },
      ],
    });

    expect(result.status).toBe('completed');
    expect(result.aggregateResult).toEqual({
      'sub-1': 'context',
      'sub-2': 'scene',
      'sub-3': 'notes',
    });
    expect(broker.submit).toHaveBeenCalledTimes(3);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:subplan-completed',
      expect.objectContaining({
        parentTaskId: 'plan-1',
        status: 'completed',
      }),
    );
  });

  it('cancels sequential tasks when dependencies fail and returns the lone completed result', async () => {
    const broker = createBroker({
      analyze: { status: 'failed', error: 'broken dependency' },
      summarize: { status: 'completed', result: 'backup summary' },
    });
    const dispatcher = new SubPlanDispatcher(broker as never);

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-2',
      aggregation: 'sequential',
      subTasks: [
        { id: 'sub-1', task: 'analyze' },
        { id: 'sub-2', task: 'draft', dependsOn: ['sub-1'] },
        { id: 'sub-3', task: 'summarize' },
      ],
    });

    expect(result.status).toBe('partial');
    expect(result.subResults.get('sub-1')).toMatchObject({
      status: 'failed',
      error: 'broken dependency',
    });
    expect(result.subResults.get('sub-2')).toMatchObject({
      status: 'cancelled',
      error: 'Dependency failed or was cancelled',
    });
    expect(result.aggregateResult).toBe('backup summary');
  });

  it('groups mixed-mode work by dependency graph and marks timed out delegates', async () => {
    const broker = createBroker({
      seed: { status: 'completed', result: 'seeded' },
      branchA: { status: 'failed', error: 'Timeout after 100ms' },
      branchB: { status: 'completed', result: 'branch-b' },
    });
    const dispatcher = new SubPlanDispatcher(broker as never);

    const result = await dispatcher.submitSubPlan({
      parentTaskId: 'plan-3',
      aggregation: 'mixed',
      maxParallelism: 2,
      subTasks: [
        { id: 'sub-1', task: 'seed' },
        { id: 'sub-2', task: 'branchA', dependsOn: ['sub-1'] },
        { id: 'sub-3', task: 'branchB', dependsOn: ['sub-1'] },
      ],
    });

    expect(result.status).toBe('partial');
    expect(result.subResults.get('sub-1')).toMatchObject({ status: 'completed' });
    expect(result.subResults.get('sub-2')).toMatchObject({ status: 'timed_out' });
    expect(result.subResults.get('sub-3')).toMatchObject({ status: 'completed' });
    expect(result.aggregateResult).toEqual({
      'sub-1': 'seeded',
      'sub-3': 'branch-b',
    });
  });
});
