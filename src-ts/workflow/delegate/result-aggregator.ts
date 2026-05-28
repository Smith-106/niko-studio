/**
 * Parallel Result Aggregator — 并行结果聚合器
 *
 * 提供可配置的聚合策略，用于合并并行子计划执行的结果。
 * 基于 SubPlanDispatcher 构建，支持 MERGE_ALL、FIRST_N、
 * MAJORITY_VOTE、SCHEMA_VALIDATED 四种策略。
 */

import { createLogger } from '../../logger/index.js';
import type { SubPlanSpec, SubTaskResult } from './sub-plan.js';
import { SubPlanDispatcher } from './sub-plan.js';
import type { DelegateBroker } from './delegate-broker.js';
import type { IEventBus } from '../../services/event-bus.js';

const _log = createLogger('result-aggregator');

// ─── Types ──────────────────────────────────────────────────────────────────

export enum AggregationStrategy {
  MERGE_ALL = 'merge_all',
  FIRST_N = 'first_n',
  MAJORITY_VOTE = 'majority_vote',
  SCHEMA_VALIDATED = 'schema_validated',
}

export interface AggregationConfig {
  strategy: AggregationStrategy;
  /** For FIRST_N strategy — how many results to take (default: 1) */
  firstNCount?: number;
  /** For SCHEMA_VALIDATED strategy — validator function */
  schemaValidator?: (result: unknown) => boolean;
  /** Per sub-task timeout in ms (default: 30000) */
  timeoutMs?: number;
}

export interface AggregatedResult {
  status: 'complete' | 'partial' | 'timeout' | 'failed';
  data: unknown;
  metadata: {
    strategyUsed: AggregationStrategy;
    completedCount: number;
    totalCount: number;
    timedOut: string[];
  };
  errors: Array<{ taskId: string; error: string }>;
}

export interface IParallelResultAggregator {
  aggregate(results: SubTaskResult[], config: AggregationConfig): AggregatedResult;
  aggregateWithTimeout(spec: SubPlanSpec, config: AggregationConfig): Promise<AggregatedResult>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class ParallelResultAggregatorImpl implements IParallelResultAggregator {
  private dispatcher: SubPlanDispatcher | null;
  private readonly eventBus: IEventBus | null;

  constructor(broker?: DelegateBroker, eventBus?: IEventBus) {
    this.dispatcher = broker ? new SubPlanDispatcher(broker, eventBus) : null;
    this.eventBus = eventBus ?? null;
  }

  /** Set or replace the DelegateBroker (enables aggregateWithTimeout) */
  setBroker(broker: DelegateBroker): void {
    this.dispatcher = new SubPlanDispatcher(broker, this.eventBus ?? undefined);
  }

  /**
   * Aggregate completed sub-task results using the specified strategy.
   */
  aggregate(results: SubTaskResult[], config: AggregationConfig): AggregatedResult {
    const totalCount = results.length;
    const completed = results.filter(r => r.status === 'completed');
    const failed = results.filter(r => r.status !== 'completed');
    const timedOut = results.filter(r => r.status === 'timed_out').map(r => r.id);
    const completedCount = completed.length;

    const errors = failed.map(r => ({
      taskId: r.id,
      error: r.error ?? `Sub-task ${r.id} failed with status: ${r.status}`,
    }));

    // Determine overall status
    let status: AggregatedResult['status'];
    if (completedCount === 0) {
      status = timedOut.length > 0 ? 'timeout' : 'failed';
    } else if (completedCount === totalCount) {
      status = 'complete';
    } else {
      status = timedOut.length > 0 ? 'timeout' : 'partial';
    }

    // Apply aggregation strategy
    const data = this._applyStrategy(completed, config);

    const result: AggregatedResult = {
      status,
      data,
      metadata: {
        strategyUsed: config.strategy,
        completedCount,
        totalCount,
        timedOut,
      },
      errors,
    };

    _log.info('Aggregation completed', {
      strategy: config.strategy,
      status,
      completedCount,
      totalCount,
    });

    return result;
  }

  /**
   * Execute sub-plan with per-task timeouts and aggregate results.
   */
  async aggregateWithTimeout(
    spec: SubPlanSpec,
    config: AggregationConfig,
  ): Promise<AggregatedResult> {
    const timeoutMs = config.timeoutMs ?? 30000;

    this._publish('delegate:aggregation-start', {
      parentTaskId: spec.parentTaskId,
      strategy: config.strategy,
      subTaskCount: spec.subTasks.length,
      timeoutMs,
    });

    _log.info('Aggregation with timeout started', {
      parentTaskId: spec.parentTaskId,
      strategy: config.strategy,
      timeoutMs,
    });

    // Apply timeout overrides to sub-tasks
    const specWithTimeout: SubPlanSpec = {
      ...spec,
      subTasks: spec.subTasks.map(st => ({
        ...st,
        timeout: st.timeout ?? timeoutMs,
      })),
    };

    try {
      if (!this.dispatcher) {
        throw new Error('DelegateBroker not set — call setBroker() before aggregateWithTimeout()');
      }
      const planResult = await this.dispatcher.submitSubPlan(specWithTimeout);
      const subTaskResults = Array.from(planResult.subResults.values());

      const aggregated = this.aggregate(subTaskResults, config);

      const eventChannel = aggregated.status === 'complete'
        ? 'delegate:aggregation-complete'
        : 'delegate:aggregation-partial';

      this._publish(eventChannel, {
        parentTaskId: spec.parentTaskId,
        status: aggregated.status,
        completedCount: aggregated.metadata.completedCount,
        totalCount: aggregated.metadata.totalCount,
      });

      _log.info('Aggregation with timeout completed', {
        parentTaskId: spec.parentTaskId,
        status: aggregated.status,
      });

      return aggregated;
    } catch (err) {
      _log.error('Aggregation with timeout failed', {
        parentTaskId: spec.parentTaskId,
        error: String(err),
      });

      const result: AggregatedResult = {
        status: 'failed',
        data: null,
        metadata: {
          strategyUsed: config.strategy,
          completedCount: 0,
          totalCount: spec.subTasks.length,
          timedOut: [],
        },
        errors: [{
          taskId: spec.parentTaskId,
          error: String(err),
        }],
      };

      this._publish('delegate:aggregation-partial', {
        parentTaskId: spec.parentTaskId,
        status: 'failed',
        error: String(err),
      });

      return result;
    }
  }

  // ─── Strategy implementations ────────────────────────────────────────

  private _applyStrategy(
    completed: SubTaskResult[],
    config: AggregationConfig,
  ): unknown {
    switch (config.strategy) {
      case AggregationStrategy.MERGE_ALL:
        return this._mergeAll(completed);
      case AggregationStrategy.FIRST_N:
        return this._firstN(completed, config.firstNCount ?? 1);
      case AggregationStrategy.MAJORITY_VOTE:
        return this._majorityVote(completed);
      case AggregationStrategy.SCHEMA_VALIDATED:
        return this._schemaValidated(completed, config.schemaValidator);
      default:
        _log.warn('Unknown aggregation strategy', { strategy: config.strategy });
        return this._mergeAll(completed);
    }
  }

  /** MERGE_ALL: merge all successful results into an array */
  private _mergeAll(completed: SubTaskResult[]): unknown {
    return completed.map(r => ({ id: r.id, result: r.result }));
  }

  /** FIRST_N: take first N successful results */
  private _firstN(completed: SubTaskResult[], n: number): unknown {
    const selected = completed.slice(0, n);
    if (selected.length === 1) {
      return selected[0].result;
    }
    return selected.map(r => ({ id: r.id, result: r.result }));
  }

  /** MAJORITY_VOTE: count result frequencies and return the most common */
  private _majorityVote(completed: SubTaskResult[]): unknown {
    if (completed.length === 0) return null;

    const frequencyMap = new Map<string, { result: unknown; count: number }>();

    for (const r of completed) {
      // Serialize result for comparison — use JSON for deterministic key
      const key = this._serializeResult(r.result);
      const entry = frequencyMap.get(key);
      if (entry) {
        entry.count++;
      } else {
        frequencyMap.set(key, { result: r.result, count: 1 });
      }
    }

    // Find the result with highest frequency
    let maxCount = 0;
    let majorityResult: unknown = null;
    for (const [, entry] of frequencyMap) {
      if (entry.count > maxCount) {
        maxCount = entry.count;
        majorityResult = entry.result;
      }
    }

    _log.info('Majority vote resolved', {
      candidateCount: frequencyMap.size,
      winnerCount: maxCount,
    });

    return majorityResult;
  }

  /** SCHEMA_VALIDATED: filter results through validator, then merge */
  private _schemaValidated(
    completed: SubTaskResult[],
    validator?: (result: unknown) => boolean,
  ): unknown {
    if (!validator) {
      _log.warn('SCHEMA_VALIDATED strategy missing validator — falling back to MERGE_ALL');
      return this._mergeAll(completed);
    }

    const valid = completed.filter(r => {
      try {
        return validator(r.result);
      } catch {
        _log.warn('Schema validator threw for sub-task', { taskId: r.id });
        return false;
      }
    });

    if (valid.length === 0) {
      _log.warn('No results passed schema validation');
      return null;
    }

    return valid.map(r => ({ id: r.id, result: r.result }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private _serializeResult(result: unknown): string {
    try {
      return JSON.stringify(result ?? null);
    } catch {
      return String(result);
    }
  }

  private _publish(channel: string, payload: unknown): void {
    if (this.eventBus) {
      this.eventBus.publish(channel, payload);
    }
  }
}