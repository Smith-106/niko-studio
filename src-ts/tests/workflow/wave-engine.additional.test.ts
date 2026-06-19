import { describe, expect, it } from 'vitest';

import { WaveExecutionEngineImpl } from '../../workflow/wave-engine.js';
import type { WaveSpec } from '../../workflow/wave-engine.js';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('workflow/wave-engine additional coverage', () => {
  it('skips a later wave cancelled during earlier execution and returns immutable status snapshots', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    const executed: string[] = [];
    const waves: WaveSpec[] = [
      { wave: 1, tasks: ['warmup'], parallel: false },
      { wave: 2, tasks: ['queued-a', 'queued-b'], parallel: true },
    ];

    engine.cancelWave(99);

    const results = await engine.executeWaves(waves, async (taskId) => {
      executed.push(taskId);
      if (taskId === 'warmup') {
        engine.cancelWave(2);
      }
    });

    expect(executed).toEqual(['warmup']);
    expect(results[1]).toMatchObject({
      waveNumber: 2,
      status: 'skipped',
      taskResults: {
        'queued-a': { status: 'skipped', durationMs: 0 },
        'queued-b': { status: 'skipped', durationMs: 0 },
      },
    });

    const snapshot = engine.getWaveStatus();
    snapshot.pop();

    expect(snapshot).toHaveLength(1);
    expect(engine.getWaveStatus()).toHaveLength(2);
  });

  it('cancels a running sequential wave and skips remaining tasks', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 200,
    });
    const releaseFirstTask = createDeferred();
    const firstTaskStarted = createDeferred();
    const executed: string[] = [];

    const execution = engine.executeWave(
      { wave: 1, tasks: ['task-a', 'task-b', 'task-c'], parallel: false },
      async (taskId) => {
        executed.push(taskId);
        if (taskId === 'task-a') {
          firstTaskStarted.resolve();
          await releaseFirstTask.promise;
        }
      },
    );

    await firstTaskStarted.promise;
    engine.cancelWave(1);
    releaseFirstTask.resolve();

    const result = await execution;

    expect(executed).toEqual(['task-a']);
    expect(result.status).toBe('partial');
    expect(result.taskResults).toMatchObject({
      'task-a': { status: 'success' },
      'task-b': { status: 'skipped', durationMs: 0 },
      'task-c': { status: 'skipped', durationMs: 0 },
    });
  });

  it('retries every task when retry-all strategy is selected', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-all',
      maxRetriesPerWave: 1,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    const attempts = new Map<string, number>();

    const result = await engine.executeWave(
      { wave: 3, tasks: ['task-a', 'task-b'], parallel: false },
      async (taskId) => {
        const nextAttempt = (attempts.get(taskId) ?? 0) + 1;
        attempts.set(taskId, nextAttempt);

        if (taskId === 'task-a' && nextAttempt === 1) {
          throw new Error('first pass failed');
        }
      },
    );

    expect(result.status).toBe('completed');
    expect(attempts.get('task-a')).toBe(2);
    expect(attempts.get('task-b')).toBe(2);
    expect(result.taskResults['task-a'].status).toBe('success');
    expect(result.taskResults['task-b'].status).toBe('success');
  });

  it('returns a failed wave after retry-all exhausts all attempts', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-all',
      maxRetriesPerWave: 1,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    const attempts = new Map<string, number>();

    const result = await engine.executeWave(
      { wave: 4, tasks: ['task-a', 'task-b'], parallel: false },
      async (taskId) => {
        attempts.set(taskId, (attempts.get(taskId) ?? 0) + 1);
        throw new Error(`${taskId} still failing`);
      },
    );

    expect(result.status).toBe('failed');
    expect(attempts.get('task-a')).toBe(2);
    expect(attempts.get('task-b')).toBe(2);
    expect(result.taskResults).toEqual({
      'task-a': { status: 'failed', error: 'Retries exhausted', durationMs: 0 },
      'task-b': { status: 'failed', error: 'Retries exhausted', durationMs: 0 },
    });
  });

  it('marks subsequent waves skipped after an abort-strategy failure', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'abort',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    const executed: string[] = [];

    const results = await engine.executeWaves(
      [
        { wave: 1, tasks: ['fail-now'], parallel: false },
        { wave: 2, tasks: ['never-runs-a', 'never-runs-b'], parallel: true },
      ],
      async (taskId) => {
        executed.push(taskId);
        if (taskId === 'fail-now') {
          throw new Error('stop the pipeline');
        }
      },
    );

    expect(executed).toEqual(['fail-now']);
    expect(results[0].status).toBe('failed');
    expect(results[1]).toMatchObject({
      waveNumber: 2,
      status: 'skipped',
      taskResults: {
        'never-runs-a': { status: 'skipped', durationMs: 0 },
        'never-runs-b': { status: 'skipped', durationMs: 0 },
      },
    });
  });
});
