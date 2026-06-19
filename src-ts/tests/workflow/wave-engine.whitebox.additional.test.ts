import { describe, expect, it } from 'vitest';

import { TypedEventBus } from '../../services/event-bus.js';
import { EventLogImpl } from '../../services/event-log.js';
import { WaveExecutionEngineImpl } from '../../workflow/wave-engine.js';
import type { WaveSpec } from '../../workflow/wave-engine.js';

describe('workflow/wave-engine whitebox additional coverage', () => {
  it('returns a skipped result immediately when the retry controller is already aborted', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
    });
    const abortController = new AbortController();
    abortController.abort();

    const result = await (engine as any)._executeWaveWithRetries(
      { wave: 7, tasks: ['alpha', 'beta'], parallel: false } satisfies WaveSpec,
      async () => {},
      abortController,
    );

    expect(result).toMatchObject({
      waveNumber: 7,
      status: 'skipped',
      taskResults: {
        alpha: { status: 'skipped', durationMs: 0 },
        beta: { status: 'skipped', durationMs: 0 },
      },
    });
  });

  it('returns timeout when a wave-level timeout wins the race', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      waveTimeoutMs: 1,
      taskTimeoutMs: 100,
    });
    const engineAny = engine as any;
    const timeoutError = await engineAny._createWaveTimeout(99).catch((error: unknown) => error);

    engineAny._createWaveTimeout = () => Promise.reject(timeoutError);
    engineAny._executeSequentialWave = () => new Promise(() => {});

    const result = await engineAny._executeWaveWithRetries(
      { wave: 99, tasks: ['slow-task'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(result).toEqual({
      waveNumber: 99,
      status: 'timeout',
      taskResults: {},
      startedAt: 0,
      completedAt: 0,
    });
  });

  it('maps unexpected execution errors into failed task results', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
    });
    const engineAny = engine as any;

    engineAny._executeSequentialWave = async () => {
      throw new Error('core exploded');
    };

    const result = await engineAny._executeWaveWithRetries(
      { wave: 3, tasks: ['one', 'two'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(result).toEqual({
      waveNumber: 3,
      status: 'failed',
      taskResults: {
        one: { status: 'failed', error: 'Error: core exploded', durationMs: 0 },
        two: { status: 'failed', error: 'Error: core exploded', durationMs: 0 },
      },
      startedAt: 0,
      completedAt: 0,
    });
  });

  it('treats retry-failed waves with only skipped tasks as completed fallback', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-failed',
      maxRetriesPerWave: 1,
    });
    const engineAny = engine as any;

    engineAny._executeSequentialWave = async () => ({
      skippedOnly: { status: 'skipped', durationMs: 0 },
    });

    const result = await engineAny._executeWaveWithRetries(
      { wave: 4, tasks: ['skippedOnly'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(result).toEqual({
      waveNumber: 4,
      status: 'completed',
      taskResults: {
        skippedOnly: { status: 'skipped', durationMs: 0 },
      },
      startedAt: 0,
      completedAt: 0,
    });
  });

  it('returns merged partial results when retry-failed reaches max retries', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-failed',
      maxRetriesPerWave: 1,
      waveTimeoutMs: 1000,
      taskTimeoutMs: 100,
    });
    const attempts = new Map<string, number>();

    const result = await engine.executeWave(
      { wave: 5, tasks: ['keep-failing', 'succeeds'], parallel: false },
      async (taskId) => {
        attempts.set(taskId, (attempts.get(taskId) ?? 0) + 1);
        if (taskId === 'keep-failing') {
          throw new Error('still broken');
        }
      },
    );

    expect(attempts.get('keep-failing')).toBe(2);
    expect(attempts.get('succeeds')).toBe(1);
    expect(result.status).toBe('partial');
    expect(result.taskResults).toMatchObject({
      'keep-failing': { status: 'failed', error: 'still broken' },
      succeeds: { status: 'success' },
    });
  });

  it('falls back to the computed wave status for unknown failure strategies', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'mystery' as never,
      maxRetriesPerWave: 0,
    });
    const engineAny = engine as any;

    engineAny._executeSequentialWave = async () => ({
      skippedOnly: { status: 'skipped', durationMs: 0 },
    });

    const result = await engineAny._executeWaveWithRetries(
      { wave: 6, tasks: ['skippedOnly'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(result).toEqual({
      waveNumber: 6,
      status: 'failed',
      taskResults: {
        skippedOnly: { status: 'skipped', durationMs: 0 },
      },
      startedAt: 0,
      completedAt: 0,
    });
  });

  it('uses the exhausted-retries fallback when retries are configured below zero', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'retry-all',
      maxRetriesPerWave: -1,
    });

    const result = await (engine as any)._executeWaveWithRetries(
      { wave: 8, tasks: ['alpha'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(result).toEqual({
      waveNumber: 8,
      status: 'failed',
      taskResults: {
        alpha: { status: 'failed', error: 'Retries exhausted', durationMs: 0 },
      },
      startedAt: 0,
      completedAt: 0,
    });
  });

  it('covers direct core dispatch, rejected parallel tasks, and event-bus publishing', async () => {
    const eventLog = new EventLogImpl({ maxRetention: 20 });
    const eventBus = new TypedEventBus(undefined, { eventLog });
    const engine = new WaveExecutionEngineImpl(eventBus, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      taskTimeoutMs: 100,
    });
    const engineAny = engine as any;

    const sequentialCore = await engineAny._executeWaveCore(
      { wave: 11, tasks: ['core-task'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );
    expect(sequentialCore['core-task'].status).toBe('success');
    eventLog.clear();

    const originalPublish = engineAny._publish.bind(engineAny);
    engineAny._publish = (channel: string, payload: unknown) => {
      if (channel === 'wave:task-started') {
        throw new Error('publish exploded');
      }
      return originalPublish(channel, payload);
    };

    const parallelResult = await engineAny._executeParallelWave(
      { wave: 12, tasks: ['parallel-task'], parallel: true } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(parallelResult).toEqual({});
    expect(eventLog.getEvents()).toEqual([]);

    engineAny._publish = originalPublish;

    await engine.executeWave(
      { wave: 13, tasks: ['evented'], parallel: false, reason: 'verify-publish' },
      async () => {},
    );

    const channels = eventLog.getEvents().map((event) => event.channel);
    expect(channels).toEqual([
      'wave:started',
      'wave:task-started',
      'wave:task-completed',
      'wave:completed',
    ]);
  });
});
