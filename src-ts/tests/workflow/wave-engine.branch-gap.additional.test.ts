import { describe, expect, it } from 'vitest';

import { WaveExecutionEngineImpl } from '../../workflow/wave-engine.js';
import type { WaveSpec } from '../../workflow/wave-engine.js';

describe('workflow/wave-engine branch-gap coverage', () => {
  it('covers parallel core execution and aborted parallel task startup', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      taskTimeoutMs: 100,
    });
    const abortController = new AbortController();
    abortController.abort();

    const skipped = await (engine as any)._executeParallelWave(
      { wave: 1, tasks: ['a', 'b'], parallel: true } satisfies WaveSpec,
      async () => {},
      abortController,
    );
    const parallelCore = await (engine as any)._executeWaveCore(
      { wave: 2, tasks: ['core-a'], parallel: true } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(skipped).toEqual({
      a: { status: 'skipped', durationMs: 0 },
      b: { status: 'skipped', durationMs: 0 },
    });
    expect(parallelCore).toEqual({
      'core-a': { status: 'success', durationMs: expect.any(Number) },
    });
  });

  it('stringifies non-Error failures in parallel and sequential task execution', async () => {
    const parallelEngine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      taskTimeoutMs: 100,
    });
    const sequentialEngine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      taskTimeoutMs: 100,
    });

    const parallelResult = await (parallelEngine as any)._executeParallelWave(
      { wave: 3, tasks: ['parallel-fail'], parallel: true } satisfies WaveSpec,
      async () => {
        throw 'parallel string failure';
      },
      new AbortController(),
    );
    const sequentialResult = await (sequentialEngine as any)._executeSequentialWave(
      { wave: 4, tasks: ['sequential-fail'], parallel: false } satisfies WaveSpec,
      async () => {
        throw 'sequential string failure';
      },
      new AbortController(),
    );

    expect(parallelResult['parallel-fail']).toMatchObject({
      status: 'failed',
      error: 'parallel string failure',
    });
    expect(sequentialResult['sequential-fail']).toMatchObject({
      status: 'failed',
      error: 'sequential string failure',
    });
  });

  it('marks remaining sequential tasks as skipped on abort-strategy failure', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'abort',
      maxRetriesPerWave: 0,
      taskTimeoutMs: 100,
    });

    const result = await (engine as any)._executeSequentialWave(
      { wave: 5, tasks: ['first', 'second', 'third'], parallel: false } satisfies WaveSpec,
      async (taskId: string) => {
        if (taskId === 'first') {
          throw 'abort immediately';
        }
      },
      new AbortController(),
    );

    expect(result).toEqual({
      first: { status: 'failed', error: 'abort immediately', durationMs: expect.any(Number) },
      second: { status: 'skipped', durationMs: 0 },
      third: { status: 'skipped', durationMs: 0 },
    });
  });

  it('continues retry-failed waves across an intermediate partial retry', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-failed',
      maxRetriesPerWave: 2,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    const attempts = new Map<string, number>();

    const result = await (engine as any)._executeWaveWithRetries(
      { wave: 6, tasks: ['keeps-failing', 'eventually-recovers'], parallel: false } satisfies WaveSpec,
      async (taskId: string) => {
        const nextAttempt = (attempts.get(taskId) ?? 0) + 1;
        attempts.set(taskId, nextAttempt);

        if (taskId === 'keeps-failing') {
          throw new Error(`still broken ${nextAttempt}`);
        }
        if (nextAttempt < 2) {
          throw new Error('recover on second retry');
        }
      },
      new AbortController(),
    );

    expect(attempts.get('keeps-failing')).toBe(4);
    expect(attempts.get('eventually-recovers')).toBe(3);
    expect(result.status).toBe('partial');
    expect(result.taskResults['eventually-recovers'].status).toBe('success');
    expect(result.taskResults['keeps-failing']).toMatchObject({
      status: 'failed',
      error: 'still broken 4',
    });
  });

  it('covers the retry wrapper parallel path and preserves Error messages', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });

    const result = await (engine as any)._executeWaveWithRetries(
      { wave: 7, tasks: ['parallel-error'], parallel: true } satisfies WaveSpec,
      async () => {
        throw new Error('parallel object failure');
      },
      new AbortController(),
    );

    expect(result).toMatchObject({
      waveNumber: 7,
      status: 'failed',
      taskResults: {
        'parallel-error': {
          status: 'failed',
          error: 'parallel object failure',
        },
      },
    });
  });

  it('falls through to retries exhausted after a real retry-all attempt', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-all',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    let attempts = 0;

    const result = await (engine as any)._executeWaveWithRetries(
      { wave: 8, tasks: ['always-fails'], parallel: false } satisfies WaveSpec,
      async () => {
        attempts++;
        throw new Error('still failing');
      },
      new AbortController(),
    );

    expect(attempts).toBe(1);
    expect(result).toEqual({
      waveNumber: 8,
      status: 'failed',
      taskResults: {
        'always-fails': { status: 'failed', error: 'Retries exhausted', durationMs: 0 },
      },
      startedAt: 0,
      completedAt: 0,
    });
  });

  it('covers empty, timeout-only, and plain-failure wave status computation', () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
    });

    expect((engine as any)._computeWaveStatus({})).toBe('completed');
    expect(
      (engine as any)._computeWaveStatus({
        timeoutTask: { status: 'failed', error: 'Task timeout-task timed out after 100ms', durationMs: 0 },
      }),
    ).toBe('timeout');
    expect(
      (engine as any)._computeWaveStatus({
        successTask: { status: 'success', durationMs: 1 },
        timeoutTask: { status: 'failed', error: 'Task timeout-task timed out after 100ms', durationMs: 0 },
      }),
    ).toBe('timeout');
    expect(
      (engine as any)._computeWaveStatus({
        failedTask: { status: 'failed', error: 'plain failure', durationMs: 0 },
      }),
    ).toBe('failed');
  });
});
