import { describe, expect, it, vi } from 'vitest';

import {
  AggregationStrategy,
  ParallelResultAggregatorImpl,
} from '../../../workflow/delegate/result-aggregator.js';

describe('workflow/delegate/result-aggregator additional coverage', () => {
  it('reports partial status when some subtasks fail without timing out', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'completed', result: 'alpha', error: null, completedAt: null },
        { id: 'sub-2', status: 'failed', result: null, error: null, completedAt: null },
      ],
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result.status).toBe('partial');
    expect(result.metadata.timedOut).toEqual([]);
    expect(result.errors).toEqual([
      { taskId: 'sub-2', error: 'Sub-task sub-2 failed with status: failed' },
    ]);
  });

  it('falls back to merge_all for unknown strategies', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'completed', result: 'alpha', error: null, completedAt: null },
        { id: 'sub-2', status: 'completed', result: 'beta', error: null, completedAt: null },
      ],
      { strategy: 'unexpected-strategy' as AggregationStrategy },
    );

    expect(result.data).toEqual([
      { id: 'sub-1', result: 'alpha' },
      { id: 'sub-2', result: 'beta' },
    ]);
  });

  it('treats partial timed-out aggregates as timeout and supports constructor broker injection', () => {
    const aggregator = new ParallelResultAggregatorImpl({} as never);

    expect((aggregator as { dispatcher: unknown }).dispatcher).toBeTruthy();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'completed', result: 'alpha', error: null, completedAt: null },
        { id: 'sub-2', status: 'timed_out', result: null, error: null, completedAt: null },
      ],
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result.status).toBe('timeout');
    expect(result.metadata.timedOut).toEqual(['sub-2']);
  });

  it('uses the default timeout and skips event publication when no event bus is configured', async () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = await aggregator.aggregateWithTimeout(
      {
        parentTaskId: 'plan-6',
        aggregation: 'parallel',
        subTasks: [{ id: 'sub-1', task: 'draft' }],
      },
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result).toEqual({
      status: 'failed',
      data: null,
      metadata: {
        strategyUsed: AggregationStrategy.MERGE_ALL,
        completedCount: 0,
        totalCount: 1,
        timedOut: [],
      },
      errors: [
        {
          taskId: 'plan-6',
          error: expect.stringContaining('DelegateBroker not set'),
        },
      ],
    });
  });

  it('allows broker replacement without an event bus and serializes undefined as null', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    aggregator.setBroker({} as never);

    expect((aggregator as { dispatcher: unknown }).dispatcher).toBeTruthy();
    expect((aggregator as { _serializeResult(result: unknown): string })._serializeResult(undefined)).toBe('null');
  });

  it('keeps the injected event bus when replacing the broker and handles empty majority votes', () => {
    const eventBus = { publish: () => undefined };
    const aggregator = new ParallelResultAggregatorImpl(undefined, eventBus as never);

    aggregator.setBroker({} as never);

    expect((aggregator as { dispatcher: unknown }).dispatcher).toBeTruthy();
    expect(
      aggregator.aggregate([], {
        strategy: AggregationStrategy.MAJORITY_VOTE,
      }).data,
    ).toBeNull();
  });

  it('publishes through the injected event bus when _publish is invoked directly', () => {
    const eventBus = { publish: vi.fn() };
    const aggregator = new ParallelResultAggregatorImpl(undefined, eventBus as never);

    (aggregator as { _publish(channel: string, payload: unknown): void })._publish(
      'delegate:test',
      { ok: true },
    );

    expect(eventBus.publish).toHaveBeenCalledWith('delegate:test', { ok: true });
  });
});
