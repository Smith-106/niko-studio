import { describe, expect, it } from 'vitest';

import {
  AggregationStrategy,
  ParallelResultAggregatorImpl,
} from '../../../workflow/delegate/result-aggregator.js';

describe('workflow/delegate/result-aggregator tail branch coverage', () => {
  it('returns timeout when every sub-task times out and none complete', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'timed_out', result: null, error: null, completedAt: null },
        { id: 'sub-2', status: 'timed_out', result: null, error: null, completedAt: null },
      ],
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result).toEqual({
      status: 'timeout',
      data: [],
      metadata: {
        strategyUsed: AggregationStrategy.MERGE_ALL,
        completedCount: 0,
        totalCount: 2,
        timedOut: ['sub-1', 'sub-2'],
      },
      errors: [
        { taskId: 'sub-1', error: 'Sub-task sub-1 failed with status: timed_out' },
        { taskId: 'sub-2', error: 'Sub-task sub-2 failed with status: timed_out' },
      ],
    });
  });

  it('returns failed when every sub-task fails without any timeout', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'failed', result: null, error: 'boom', completedAt: null },
        { id: 'sub-2', status: 'failed', result: null, error: null, completedAt: null },
      ],
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result).toEqual({
      status: 'failed',
      data: [],
      metadata: {
        strategyUsed: AggregationStrategy.MERGE_ALL,
        completedCount: 0,
        totalCount: 2,
        timedOut: [],
      },
      errors: [
        { taskId: 'sub-1', error: 'boom' },
        { taskId: 'sub-2', error: 'Sub-task sub-2 failed with status: failed' },
      ],
    });
  });

  it('falls back to String(result) when JSON serialization throws', () => {
    const aggregator = new ParallelResultAggregatorImpl();
    const circular: { name: string; self?: unknown } = { name: 'loop' };
    circular.self = circular;

    expect(
      (aggregator as unknown as { _serializeResult(result: unknown): string })._serializeResult(circular),
    ).toBe('[object Object]');
  });
});
