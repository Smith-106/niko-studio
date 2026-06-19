import { describe, expect, it, vi } from 'vitest';

import {
  AggregationStrategy,
  ParallelResultAggregatorImpl,
} from '../../../workflow/delegate/result-aggregator.js';

describe('workflow/delegate/result-aggregator', () => {
  it('merges partial and timed-out results with detailed metadata', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'completed', result: 'alpha', error: null, completedAt: null },
        { id: 'sub-2', status: 'timed_out', result: null, error: null, completedAt: null },
        { id: 'sub-3', status: 'failed', result: null, error: 'boom', completedAt: null },
      ],
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result).toEqual({
      status: 'timeout',
      data: [{ id: 'sub-1', result: 'alpha' }],
      metadata: {
        strategyUsed: AggregationStrategy.MERGE_ALL,
        completedCount: 1,
        totalCount: 3,
        timedOut: ['sub-2'],
      },
      errors: [
        { taskId: 'sub-2', error: 'Sub-task sub-2 failed with status: timed_out' },
        { taskId: 'sub-3', error: 'boom' },
      ],
    });
  });

  it('returns partial when some sub-tasks fail without any timeout', () => {
    const aggregator = new ParallelResultAggregatorImpl();

    const result = aggregator.aggregate(
      [
        { id: 'sub-1', status: 'completed', result: 'alpha', error: null, completedAt: null },
        { id: 'sub-2', status: 'failed', result: null, error: 'boom', completedAt: null },
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
      errors: [
        { taskId: 'sub-2', error: 'boom' },
      ],
    });
  });

  it('supports FIRST_N and MAJORITY_VOTE strategies', () => {
    const aggregator = new ParallelResultAggregatorImpl();
    const completed = [
      { id: 'sub-1', status: 'completed', result: { choice: 'A' }, error: null, completedAt: null },
      { id: 'sub-2', status: 'completed', result: { choice: 'A' }, error: null, completedAt: null },
      { id: 'sub-3', status: 'completed', result: { choice: 'B' }, error: null, completedAt: null },
    ] as const;

    expect(
      aggregator.aggregate([...completed], {
        strategy: AggregationStrategy.FIRST_N,
      }).data,
    ).toEqual({ choice: 'A' });

    expect(
      aggregator.aggregate([...completed], {
        strategy: AggregationStrategy.FIRST_N,
        firstNCount: 2,
      }).data,
    ).toEqual([
      { id: 'sub-1', result: { choice: 'A' } },
      { id: 'sub-2', result: { choice: 'A' } },
    ]);

    expect(
      aggregator.aggregate([...completed], {
        strategy: AggregationStrategy.MAJORITY_VOTE,
      }).data,
    ).toEqual({ choice: 'A' });
  });

  it('supports schema validation, including fallback and validator failures', () => {
    const aggregator = new ParallelResultAggregatorImpl();
    const results = [
      { id: 'sub-1', status: 'completed', result: { valid: true }, error: null, completedAt: null },
      { id: 'sub-2', status: 'completed', result: { valid: false }, error: null, completedAt: null },
    ];

    expect(
      aggregator.aggregate(results, {
        strategy: AggregationStrategy.SCHEMA_VALIDATED,
      }).data,
    ).toEqual([
      { id: 'sub-1', result: { valid: true } },
      { id: 'sub-2', result: { valid: false } },
    ]);

    expect(
      aggregator.aggregate(results, {
        strategy: AggregationStrategy.SCHEMA_VALIDATED,
        schemaValidator: (result) => (result as { valid: boolean }).valid === true,
      }).data,
    ).toEqual([{ id: 'sub-1', result: { valid: true } }]);

    expect(
      aggregator.aggregate(results, {
        strategy: AggregationStrategy.SCHEMA_VALIDATED,
        schemaValidator: () => {
          throw new Error('bad validator');
        },
      }).data,
    ).toBeNull();
  });

  it('returns a failed aggregateWithTimeout result when no broker is configured', async () => {
    const eventBus = { publish: vi.fn() };
    const aggregator = new ParallelResultAggregatorImpl(undefined, eventBus as never);

    const result = await aggregator.aggregateWithTimeout(
      {
        parentTaskId: 'plan-4',
        aggregation: 'parallel',
        subTasks: [{ id: 'sub-1', task: 'draft' }],
      },
      { strategy: AggregationStrategy.MERGE_ALL, timeoutMs: 1234 },
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
          taskId: 'plan-4',
          error: expect.stringContaining('DelegateBroker not set'),
        },
      ],
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:aggregation-start',
      expect.objectContaining({
        parentTaskId: 'plan-4',
        timeoutMs: 1234,
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:aggregation-partial',
      expect.objectContaining({
        parentTaskId: 'plan-4',
        status: 'failed',
      }),
    );
  });

  it('aggregates dispatcher results and publishes completion events', async () => {
    const eventBus = { publish: vi.fn() };
    const aggregator = new ParallelResultAggregatorImpl(undefined, eventBus as never);

    (aggregator as { dispatcher: unknown }).dispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        subResults: new Map([
          ['sub-1', { id: 'sub-1', status: 'completed', result: 'outline', error: null, completedAt: null }],
          ['sub-2', { id: 'sub-2', status: 'completed', result: 'draft', error: null, completedAt: null }],
        ]),
      }),
    };

    const result = await aggregator.aggregateWithTimeout(
      {
        parentTaskId: 'plan-5',
        aggregation: 'mixed',
        subTasks: [
          { id: 'sub-1', task: 'outline' },
          { id: 'sub-2', task: 'draft', timeout: 5000 },
        ],
      },
      { strategy: AggregationStrategy.FIRST_N, firstNCount: 2, timeoutMs: 9000 },
    );

    expect(result.status).toBe('complete');
    expect(result.data).toEqual([
      { id: 'sub-1', result: 'outline' },
      { id: 'sub-2', result: 'draft' },
    ]);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'delegate:aggregation-complete',
      expect.objectContaining({
        parentTaskId: 'plan-5',
        completedCount: 2,
      }),
    );
  });

  it('completes aggregateWithTimeout without publishing when no event bus is configured', async () => {
    const aggregator = new ParallelResultAggregatorImpl();

    (aggregator as { dispatcher: unknown }).dispatcher = {
      submitSubPlan: vi.fn().mockResolvedValue({
        subResults: new Map([
          ['sub-1', { id: 'sub-1', status: 'completed', result: 'outline', error: null, completedAt: null }],
        ]),
      }),
    };

    const result = await aggregator.aggregateWithTimeout(
      {
        parentTaskId: 'plan-6',
        aggregation: 'parallel',
        subTasks: [{ id: 'sub-1', task: 'outline' }],
      },
      { strategy: AggregationStrategy.MERGE_ALL },
    );

    expect(result).toEqual({
      status: 'complete',
      data: [{ id: 'sub-1', result: 'outline' }],
      metadata: {
        strategyUsed: AggregationStrategy.MERGE_ALL,
        completedCount: 1,
        totalCount: 1,
        timedOut: [],
      },
      errors: [],
    });
  });
});
