/**
 * Wave Execution Engine — 波次并行执行引擎
 *
 * 读取 plan.json 的波次定义，按波次顺序执行任务。
 * 每个波次内的任务可并行或顺序执行（由 WaveSpec.parallel 控制），
 * 波次之间严格顺序推进，上一波次完成后才开始下一波次。
 *
 * 支持四种失败策略：retry-all / retry-failed / skip / abort，
 * 以及波次超时和取消机制。
 */

import { createLogger } from '../logger/index.js';
import type { IEventBus } from '../services/event-bus.js';
import type { IParallelResultAggregator } from './delegate/result-aggregator.js';

const _log = createLogger('wave-engine');

// ─── Types ──────────────────────────────────────────────────────────────────

/** Mirrors the wave structure from plan.json */
export interface WaveSpec {
  wave: number;
  tasks: string[];
  parallel: boolean;
  reason?: string;
}

/** Configuration for wave execution behavior */
export interface WaveExecutionConfig {
  /** How to handle failures within a wave */
  failureStrategy: 'retry-all' | 'retry-failed' | 'skip' | 'abort';
  /** Maximum retries per wave (default: 2) */
  maxRetriesPerWave: number;
  /** Timeout per wave in ms (default: 300000 — 5 minutes) */
  waveTimeoutMs: number;
  /** Timeout per task in ms (default: 60000 — 1 minute) */
  taskTimeoutMs: number;
}

/** Result of a single wave execution */
export interface WaveResult {
  waveNumber: number;
  status: 'completed' | 'partial' | 'failed' | 'timeout' | 'skipped';
  taskResults: Record<string, {
    status: 'success' | 'failed' | 'skipped';
    error?: string;
    durationMs: number;
  }>;
  startedAt: number;
  completedAt: number;
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface IWaveExecutionEngine {
  /**
   * Execute all waves sequentially, each wave waits for completion before
   * advancing to the next.
   */
  executeWaves(
    waves: WaveSpec[],
    taskExecutor: (taskId: string) => Promise<void>,
  ): Promise<WaveResult[]>;

  /**
   * Execute a single wave — parallel or sequential based on WaveSpec.parallel.
   */
  executeWave(
    wave: WaveSpec,
    taskExecutor: (taskId: string) => Promise<void>,
  ): Promise<WaveResult>;

  /**
   * Get results of all completed waves.
   */
  getWaveStatus(): WaveResult[];

  /**
   * Cancel pending tasks in the specified wave.
   */
  cancelWave(waveNumber: number): void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WaveExecutionConfig = {
  failureStrategy: 'retry-failed',
  maxRetriesPerWave: 2,
  waveTimeoutMs: 300000,
  taskTimeoutMs: 60000,
};

// ─── Implementation ──────────────────────────────────────────────────────────

export class WaveExecutionEngineImpl implements IWaveExecutionEngine {
  private readonly eventBus: IEventBus | null;
  private readonly aggregator: IParallelResultAggregator | null;
  private readonly config: WaveExecutionConfig;
  private readonly waveResults: WaveResult[] = [];
  private readonly cancelledWaves = new Set<number>();
  private currentWaveNumber: number | null = null;
  private readonly pendingAbortControllers = new Map<number, AbortController>();

  constructor(
    eventBus: IEventBus | null,
    aggregator?: IParallelResultAggregator,
    config?: Partial<WaveExecutionConfig>,
  ) {
    this.eventBus = eventBus ?? null;
    this.aggregator = aggregator ?? null;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── executeWaves ─────────────────────────────────────────────────────

  async executeWaves(
    waves: WaveSpec[],
    taskExecutor: (taskId: string) => Promise<void>,
  ): Promise<WaveResult[]> {
    _log.info('Wave execution started', {
      waveCount: waves.length,
      config: this.config,
    });

    this.waveResults.length = 0;
    this.cancelledWaves.clear();

    for (const wave of waves) {
      // Check if a previous wave requested abort
      if (this.cancelledWaves.has(-1)) {
        _log.warn('Execution aborted by previous wave', {
          abortedAtWave: wave.wave,
        });
        // Mark remaining waves as skipped
        for (const remainingWave of waves.slice(wave.wave - 1)) {
          const skippedResult: WaveResult = {
            waveNumber: remainingWave.wave,
            status: 'skipped',
            taskResults: Object.fromEntries(
              remainingWave.tasks.map(id => [id, { status: 'skipped', durationMs: 0 }]),
            ),
            startedAt: Date.now(),
            completedAt: Date.now(),
          };
          this.waveResults.push(skippedResult);
        }
        break;
      }

      // Check if this specific wave was cancelled
      if (this.cancelledWaves.has(wave.wave)) {
        _log.info('Wave cancelled, skipping', { waveNumber: wave.wave });
        const skippedResult: WaveResult = {
          waveNumber: wave.wave,
          status: 'skipped',
          taskResults: Object.fromEntries(
            wave.tasks.map(id => [id, { status: 'skipped', durationMs: 0 }]),
          ),
          startedAt: Date.now(),
          completedAt: Date.now(),
        };
        this.waveResults.push(skippedResult);
        continue;
      }

      const result = await this.executeWave(wave, taskExecutor);
      this.waveResults.push(result);

      // Abort strategy: stop all subsequent execution
      if (result.status === 'failed' && this.config.failureStrategy === 'abort') {
        _log.error('Wave failed with abort strategy, stopping execution', {
          waveNumber: wave.wave,
        });
        this.cancelledWaves.add(-1);
      }
    }

    _log.info('Wave execution completed', {
      totalWaves: this.waveResults.length,
      completedWaves: this.waveResults.filter(r => r.status === 'completed').length,
      failedWaves: this.waveResults.filter(r => r.status === 'failed').length,
    });

    return [...this.waveResults];
  }

  // ─── executeWave ──────────────────────────────────────────────────────

  async executeWave(
    wave: WaveSpec,
    taskExecutor: (taskId: string) => Promise<void>,
  ): Promise<WaveResult> {
    this.currentWaveNumber = wave.wave;
    const startedAt = Date.now();

    this._publish('wave:started', {
      waveNumber: wave.wave,
      taskCount: wave.tasks.length,
      parallel: wave.parallel,
      reason: wave.reason,
    });

    _log.info('Wave started', {
      waveNumber: wave.wave,
      taskCount: wave.tasks.length,
      parallel: wave.parallel,
    });

    // Set up abort controller for wave cancellation
    const abortController = new AbortController();
    this.pendingAbortControllers.set(wave.wave, abortController);

    let result: WaveResult;

    try {
      result = await this._executeWaveWithRetries(wave, taskExecutor, abortController);
    } finally {
      this.pendingAbortControllers.delete(wave.wave);
      this.currentWaveNumber = null;
    }

    const completedAt = Date.now();
    result.startedAt = startedAt;
    result.completedAt = completedAt;

    const eventChannel = result.status === 'completed'
      ? 'wave:completed'
      : 'wave:failed';

    this._publish(eventChannel, {
      waveNumber: wave.wave,
      status: result.status,
      taskResults: result.taskResults,
      durationMs: completedAt - startedAt,
    });

    _log.info('Wave completed', {
      waveNumber: wave.wave,
      status: result.status,
      durationMs: completedAt - startedAt,
    });

    return result;
  }

  // ─── getWaveStatus ────────────────────────────────────────────────────

  getWaveStatus(): WaveResult[] {
    return [...this.waveResults];
  }

  // ─── cancelWave ───────────────────────────────────────────────────────

  cancelWave(waveNumber: number): void {
    this.cancelledWaves.add(waveNumber);
    const controller = this.pendingAbortControllers.get(waveNumber);
    if (controller) {
      controller.abort();
      _log.info('Wave cancellation triggered', { waveNumber });
    } else {
      _log.info('Wave marked for cancellation (not currently executing)', { waveNumber });
    }
  }

  // ─── Internal: execute wave with retry logic ─────────────────────────

  private async _executeWaveWithRetries(
    wave: WaveSpec,
    taskExecutor: (taskId: string) => Promise<void>,
    abortController: AbortController,
  ): Promise<WaveResult> {
    let attempt = 0;
    const maxRetries = this.config.maxRetriesPerWave;

    while (attempt <= maxRetries) {
      // Check cancellation before each attempt
      if (abortController.signal.aborted) {
        return this._buildSkippedResult(wave);
      }

      // Check wave timeout
      const waveTimeoutPromise = this._createWaveTimeout(wave.wave);

      let taskResults: WaveResult['taskResults'];
      let waveStatus: WaveResult['status'];

      try {
        // Execute wave with timeout
        const executionPromise = wave.parallel
          ? this._executeParallelWave(wave, taskExecutor, abortController)
          : this._executeSequentialWave(wave, taskExecutor, abortController);

        // Race between execution and wave timeout
        taskResults = await Promise.race([executionPromise, waveTimeoutPromise]);

        // Determine wave status from task results
        waveStatus = this._computeWaveStatus(taskResults);
      } catch (err) {
        // Wave timeout or unexpected error
        _log.error('Wave execution error', {
          waveNumber: wave.wave,
          attempt,
          error: String(err),
        });

        if (err instanceof WaveTimeoutError) {
          return {
            waveNumber: wave.wave,
            status: 'timeout',
            taskResults: err.partialResults,
            startedAt: 0, // filled by caller
            completedAt: 0,
          };
        }

        // Unexpected error — treat as failed
        return {
          waveNumber: wave.wave,
          status: 'failed',
          taskResults: Object.fromEntries(
            wave.tasks.map(id => [id, { status: 'failed', error: String(err), durationMs: 0 }]),
          ),
          startedAt: 0,
          completedAt: 0,
        };
      }

      // Success or non-retryable strategy
      if (waveStatus === 'completed') {
        return {
          waveNumber: wave.wave,
          status: waveStatus,
          taskResults,
          startedAt: 0,
          completedAt: 0,
        };
      }

      // Handle failure based on strategy
      switch (this.config.failureStrategy) {
        case 'abort':
          return {
            waveNumber: wave.wave,
            status: 'failed',
            taskResults,
            startedAt: 0,
            completedAt: 0,
          };

        case 'skip':
          // Return partial result, continue to next wave
          return {
            waveNumber: wave.wave,
            status: waveStatus,
            taskResults,
            startedAt: 0,
            completedAt: 0,
          };

        case 'retry-all':
          attempt++;
          _log.info('Retrying entire wave', {
            waveNumber: wave.wave,
            attempt,
            maxRetries,
          });
          // All tasks will be re-executed on next loop iteration
          continue;

        case 'retry-failed':
          attempt++;
          _log.info('Retrying failed tasks in wave', {
            waveNumber: wave.wave,
            attempt,
            maxRetries,
            failedTasks: Object.entries(taskResults)
              .filter(([, r]) => r.status === 'failed')
              .map(([id]) => id),
          });

          // Build a reduced wave spec with only failed tasks
          const failedTaskIds = Object.entries(taskResults)
            .filter(([, r]) => r.status === 'failed')
            .map(([id]) => id);

          if (failedTaskIds.length === 0) {
            // All tasks actually succeeded — shouldn't reach here but handle gracefully
            return {
              waveNumber: wave.wave,
              status: 'completed',
              taskResults,
              startedAt: 0,
              completedAt: 0,
            };
          }

          // Retry only failed tasks, keep successful results
          const retryWave: WaveSpec = {
            ...wave,
            tasks: failedTaskIds,
          };

          const retryResults = await this._executeWaveCore(
            retryWave,
            taskExecutor,
            abortController,
          );

          // Merge retry results with existing successful results
          const mergedResults = { ...taskResults };
          for (const [taskId, taskResult] of Object.entries(retryResults)) {
            mergedResults[taskId] = taskResult;
          }

          const mergedStatus = this._computeWaveStatus(mergedResults);
          if (mergedStatus === 'completed' || attempt >= maxRetries) {
            return {
              waveNumber: wave.wave,
              status: mergedStatus,
              taskResults: mergedResults,
              startedAt: 0,
              completedAt: 0,
            };
          }

          // Update taskResults for next retry iteration
          taskResults = mergedResults;
          continue;

        default:
          return {
            waveNumber: wave.wave,
            status: waveStatus,
            taskResults,
            startedAt: 0,
            completedAt: 0,
          };
      }
    }

    // Exhausted retries — return last known results
    _log.warn('Wave retries exhausted', {
      waveNumber: wave.wave,
      maxRetries,
    });

    // We shouldn't reach here normally — the loop returns in all branches.
    // Fallback: return a failed result
    return {
      waveNumber: wave.wave,
      status: 'failed',
      taskResults: Object.fromEntries(
        wave.tasks.map(id => [id, { status: 'failed', error: 'Retries exhausted', durationMs: 0 }]),
      ),
      startedAt: 0,
      completedAt: 0,
    };
  }

  // ─── Internal: core wave execution (no retry wrapper) ──────────────

  private async _executeWaveCore(
    wave: WaveSpec,
    taskExecutor: (taskId: string) => Promise<void>,
    abortController: AbortController,
  ): Promise<WaveResult['taskResults']> {
    return wave.parallel
      ? this._executeParallelWave(wave, taskExecutor, abortController)
      : this._executeSequentialWave(wave, taskExecutor, abortController);
  }

  // ─── Internal: parallel wave execution ─────────────────────────────

  private async _executeParallelWave(
    wave: WaveSpec,
    taskExecutor: (taskId: string) => Promise<void>,
    abortController: AbortController,
  ): Promise<WaveResult['taskResults']> {
    const taskResults: WaveResult['taskResults'] = {};

    const promises = wave.tasks.map(async (taskId) => {
      // Check abort before starting task
      if (abortController.signal.aborted) {
        return { taskId, status: 'skipped', durationMs: 0 } as const;
      }

      this._publish('wave:task-started', { waveNumber: wave.wave, taskId });
      const taskStart = Date.now();

      try {
        // Execute with per-task timeout
        await this._executeTaskWithTimeout(taskId, taskExecutor);
        const durationMs = Date.now() - taskStart;
        this._publish('wave:task-completed', { waveNumber: wave.wave, taskId, durationMs });
        return { taskId, status: 'success', durationMs } as const;
      } catch (err) {
        const durationMs = Date.now() - taskStart;
        const errorMsg = err instanceof Error ? err.message : String(err);
        this._publish('wave:task-failed', { waveNumber: wave.wave, taskId, error: errorMsg, durationMs });
        return { taskId, status: 'failed', error: errorMsg, durationMs } as const;
      }
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        const { taskId, ...rest } = result.value;
        taskResults[taskId] = rest;
      } else {
        // Promise.allSettled should never reject, but handle defensively
        // We can't identify which task failed here, so we mark remaining as failed
        _log.error('Unexpected rejection in parallel wave', {
          waveNumber: wave.wave,
          reason: String(result.reason),
        });
      }
    }

    return taskResults;
  }

  // ─── Internal: sequential wave execution ───────────────────────────

  private async _executeSequentialWave(
    wave: WaveSpec,
    taskExecutor: (taskId: string) => Promise<void>,
    abortController: AbortController,
  ): Promise<WaveResult['taskResults']> {
    const taskResults: WaveResult['taskResults'] = {};

    for (const taskId of wave.tasks) {
      // Check abort before each task
      if (abortController.signal.aborted) {
        taskResults[taskId] = { status: 'skipped', durationMs: 0 };
        continue;
      }

      this._publish('wave:task-started', { waveNumber: wave.wave, taskId });
      const taskStart = Date.now();

      try {
        await this._executeTaskWithTimeout(taskId, taskExecutor);
        const durationMs = Date.now() - taskStart;
        this._publish('wave:task-completed', { waveNumber: wave.wave, taskId, durationMs });
        taskResults[taskId] = { status: 'success', durationMs };
      } catch (err) {
        const durationMs = Date.now() - taskStart;
        const errorMsg = err instanceof Error ? err.message : String(err);
        this._publish('wave:task-failed', { waveNumber: wave.wave, taskId, error: errorMsg, durationMs });
        taskResults[taskId] = { status: 'failed', error: errorMsg, durationMs };

        // In sequential mode with abort strategy, stop on first failure
        if (this.config.failureStrategy === 'abort') {
          // Mark remaining tasks as skipped
          for (const remainingId of wave.tasks.slice(wave.tasks.indexOf(taskId) + 1)) {
            taskResults[remainingId] = { status: 'skipped', durationMs: 0 };
          }
          break;
        }
      }
    }

    return taskResults;
  }

  // ─── Internal: task execution with timeout ──────────────────────────

  private async _executeTaskWithTimeout(
    taskId: string,
    taskExecutor: (taskId: string) => Promise<void>,
  ): Promise<void> {
    const timeoutMs = this.config.taskTimeoutMs;

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      taskExecutor(taskId)
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  }

  // ─── Internal: wave timeout ─────────────────────────────────────────

  private _createWaveTimeout(waveNumber: number): Promise<WaveResult['taskResults']> {
    return new Promise<WaveResult['taskResults']>((_, reject) => {
      setTimeout(() => {
        reject(new WaveTimeoutError(waveNumber, this.config.waveTimeoutMs));
      }, this.config.waveTimeoutMs);
    });
  }

  // ─── Internal: compute wave status from task results ────────────────

  private _computeWaveStatus(taskResults: WaveResult['taskResults']): WaveResult['status'] {
    const results = Object.values(taskResults);
    if (results.length === 0) return 'completed';

    const allSuccess = results.every(r => r.status === 'success');
    const anySuccess = results.some(r => r.status === 'success');
    const anyTimeout = results.some(r => r.error?.includes('timed out'));

    if (allSuccess) return 'completed';
    if (anySuccess) return anyTimeout ? 'timeout' : 'partial';
    return anyTimeout ? 'timeout' : 'failed';
  }

  // ─── Internal: build skipped result ─────────────────────────────────

  private _buildSkippedResult(wave: WaveSpec): WaveResult {
    return {
      waveNumber: wave.wave,
      status: 'skipped',
      taskResults: Object.fromEntries(
        wave.tasks.map(id => [id, { status: 'skipped', durationMs: 0 }]),
      ),
      startedAt: Date.now(),
      completedAt: Date.now(),
    };
  }

  // ─── Event publishing ─────────────────────────────────────────────────

  private _publish(channel: string, payload: unknown): void {
    if (this.eventBus) {
      this.eventBus.publish(channel, payload);
    }
  }
}

// ─── WaveTimeoutError ────────────────────────────────────────────────────────

class WaveTimeoutError extends Error {
  readonly partialResults: WaveResult['taskResults'];

  constructor(waveNumber: number, timeoutMs: number, partialResults?: WaveResult['taskResults']) {
    super(`Wave ${waveNumber} timed out after ${timeoutMs}ms`);
    this.name = 'WaveTimeoutError';
    this.partialResults = partialResults ?? {};
  }
}