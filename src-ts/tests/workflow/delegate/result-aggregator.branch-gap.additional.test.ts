import { describe, expect, it, vi } from 'vitest';

import { AggregationStrategy, ParallelResultAggregatorImpl } from '../../../workflow/delegate/result-aggregator.js';

describe('workflow/delegate/result-aggregator branch gap coverage', () => {
  it('returns partial when some subtasks fail and none time out', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'completed', result: 'alpha', error: null, completedAt: null },
        { id: 'sub-2', status: 'failed', result: null, error: 'broken', completedAt: null },
      ],
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result).toEqual({
      status: 'partial',
      data: [{ id: 'sub-1', result: 'alpha' }],
      metadata: {
        strategyUsed: AggregationStrategy.MERGE_ALL,
        completedCount: 1,
        totalCount: 2,
        timedOut: [],
      },
      errors: [{ taskId: 'sub-2', error: 'broken' }],
    });
  });

  it('skips publication cleanly when no event bus is attached', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    expect(() =>
      (aggregator as unknown as { _publish(channel: string, payload: unknown): void })._publish(
        'delegate:noop',
        { ok: true },
      ),
    ).not.toThrow();
  });

  it('publishes aggregation completion when a broker-backed run finishes partially', async () => {
    const eventBus = { publish: vi.fn() };
    const aggregator = new ParallelResultAggregatorImpl(undefined, eventBus as never);

    (aggregator as { dispatcher: unknown }).dispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        subResults: new Map([
          ['sub-1', { id: 'sub-1', status: 'completed', result: 'outline', error: null, completedAt: null }],
          ['sub-2', { id: 'sub-2', status: 'failed', result: null, error: 'boom', completedAt: null }],
        ]),
      }),
    };

    await expect(
      aggregator.aggregateWithTimeout(
        {
          parentTaskId: 'plan-partial',
          aggregation: 'mixed',
          subTasks: [
            { id: 'sub-1', task: 'outline' },
            { id: 'sub-2', task: 'draft' },
          ],
        },
        { strategy: AggregationStrategy.MERGE_ALL, timeoutMs: 4321 },
      ),
    ).resolves.toMatchObject({
      status: 'partial',
      metadata: {
        completedCount: 1,
        totalCount: 2,
      },
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:aggregation-partial',
      expect.objectContaining({
        parentTaskId: 'plan-partial',
        status: 'partial',
      }),
    );
  });
});
