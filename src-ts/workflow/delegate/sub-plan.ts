/**
 * Sub-Plan Dispatcher — 子计划分发器
 *
 * 将一个父任务分解为多个子任务，通过 DelegateBroker 执行，
 * 支持并行、顺序和混合（依赖图）聚合模式。
 */

import { createLogger } from '../../logger/index.js';
import type { DelegateBroker, DelegatePriority, DelegateCompletion } from './delegate-broker.js';
import type { IEventBus } from '../../services/event-bus.js';

const _log = createLogger('sub-plan-dispatcher');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubTaskSpec {
  /** Unique sub-task ID (e.g. 'sub-1') */
  id: string;
  /** Task description passed to DelegateBroker */
  task: string;
  /** Priority for the delegate task */
  priority?: DelegatePriority;
  /** Timeout in ms */
  timeout?: number;
  /** IDs of sub-tasks this depends on (for sequential ordering in mixed mode) */
  dependsOn?: string[];
}

export interface SubPlanSpec {
  /** The parent delegate task ID */
  parentTaskId: string;
  /** List of sub-tasks */
  subTasks: SubTaskSpec[];
  /** How to execute sub-tasks */
  aggregation: 'sequential' | 'parallel' | 'mixed';
  /** Limit concurrent sub-tasks (default: 4) */
  maxParallelism?: number;
}

export interface SubTaskResult {
  id: string;
  status: 'completed' | 'failed' | 'cancelled' | 'timed_out';
  result: unknown;
  error: string | null;
  completedAt: string | null;
}

export interface SubPlanResult {
  parentTaskId: string;
  subResults: Map<string, SubTaskResult>;
  status: 'completed' | 'partial' | 'failed';
  aggregateResult: unknown;
  completedAt: string;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/** Convert a DelegateCompletion status to SubTaskResult status */
function toSubTaskStatus(
  completion: DelegateCompletion,
): SubTaskResult['status'] {
  if (completion.status === 'completed') return 'completed';
  if (completion.status === 'failed') {
    // Distinguish timeout from generic failure via error message
    if (completion.error?.startsWith('Timeout')) return 'timed_out';
    return 'failed';
  }
  return 'failed';
}

/** Build a topological execution order from dependsOn edges */
function buildExecutionGroups(specs: SubTaskSpec[]): SubTaskSpec[][] {
  const specMap = new Map(specs.map(s => [s.id, s]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const spec of specs) {
    inDegree.set(spec.id, 0);
    adjacency.set(spec.id, []);
  }

  for (const spec of specs) {
    for (const dep of spec.dependsOn ?? []) {
      if (specMap.has(dep)) {
        adjacency.get(dep)!.push(spec.id);
        inDegree.set(spec.id, inDegree.get(spec.id)! + 1);
      }
    }
  }

  const groups: SubTaskSpec[][] = [];
  const visited = new Set<string>();

  while (visited.size < specs.length) {
    // Collect all nodes with inDegree 0 that haven't been visited
    const ready: SubTaskSpec[] = [];
    for (const spec of specs) {
      if (!visited.has(spec.id) && inDegree.get(spec.id)! === 0) {
        ready.push(spec);
      }
    }

    if (ready.length === 0) {
      // Cycle detected — treat remaining as a single group
      const remaining = specs.filter(s => !visited.has(s.id));
      if (remaining.length > 0) groups.push(remaining);
      break;
    }

    groups.push(ready);

    for (const spec of ready) {
      visited.add(spec.id);
      for (const next of adjacency.get(spec.id)!) {
        inDegree.set(next, inDegree.get(next)! - 1);
      }
    }
  }

  return groups;
}

// ─── SubPlanDispatcher ──────────────────────────────────────────────────────

export class SubPlanDispatcher {
  private readonly broker: DelegateBroker;
  private readonly eventBus: IEventBus | null;

  constructor(broker: DelegateBroker, eventBus?: IEventBus) {
    this.broker = broker;
    this.eventBus = eventBus ?? null;
  }

  /**
   * Submit a sub-plan: decompose and execute sub-tasks according to the
   * aggregation strategy, then aggregate results.
   */
  async submitSubPlan(spec: SubPlanSpec): Promise<SubPlanResult> {
    _log.info('Sub-plan submitted', {
      parentTaskId: spec.parentTaskId,
      subTaskCount: spec.subTasks.length,
      aggregation: spec.aggregation,
    });

    const subResults = new Map<string, SubTaskResult>();

    try {
      switch (spec.aggregation) {
        case 'parallel':
          await this._executeParallel(spec, subResults);
          break;
        case 'sequential':
          await this._executeSequential(spec, subResults);
          break;
        case 'mixed':
          await this._executeMixed(spec, subResults);
          break;
      }
    } catch (err) {
      _log.error('Sub-plan execution error', {
        parentTaskId: spec.parentTaskId,
        error: String(err),
      });
    }

    const status = this._computePlanStatus(subResults);
    const aggregateResult = this._aggregateResults(subResults, spec.aggregation);
    const completedAt = new Date().toISOString();

    const result: SubPlanResult = {
      parentTaskId: spec.parentTaskId,
      subResults,
      status,
      aggregateResult,
      completedAt,
    };

    this._publish('delegate:subplan-completed', {
      parentTaskId: spec.parentTaskId,
      status,
      subTaskCount: spec.subTasks.length,
      completedCount: Array.from(subResults.values()).filter(r => r.status === 'completed').length,
    });

    _log.info('Sub-plan completed', {
      parentTaskId: spec.parentTaskId,
      status,
    });

    return result;
  }

  // ─── Execution strategies ─────────────────────────────────────────────

  private async _executeParallel(
    spec: SubPlanSpec,
    subResults: Map<string, SubTaskResult>,
  ): Promise<void> {
    const maxParallelism = spec.maxParallelism ?? 4;
    const tasks = spec.subTasks;

    // Execute in batches limited by maxParallelism
    for (let i = 0; i < tasks.length; i += maxParallelism) {
      const batch = tasks.slice(i, i + maxParallelism);
      const promises = batch.map(t => this._runSubTask(t, spec.parentTaskId));
      const results = await Promise.allSettled(promises);

      for (let j = 0; j < batch.length; j++) {
        const settled = results[j];
        if (settled.status === 'fulfilled') {
          subResults.set(batch[j].id, settled.value);
        } else {
          subResults.set(batch[j].id, {
            id: batch[j].id,
            status: 'failed',
            result: null,
            error: String(settled.reason),
            completedAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  private async _executeSequential(
    spec: SubPlanSpec,
    subResults: Map<string, SubTaskResult>,
  ): Promise<void> {
    // Respect dependsOn order; if no dependsOn, execute in array order
    const ordered = this._orderByDependsOn(spec.subTasks);

    for (const subTask of ordered) {
      // Check if any dependency failed — if so, cancel this sub-task
      const depsFailed = (subTask.dependsOn ?? []).some(depId => {
        const depResult = subResults.get(depId);
        return !depResult || depResult.status !== 'completed';
      });

      if (depsFailed) {
        const cancelledResult: SubTaskResult = {
          id: subTask.id,
          status: 'cancelled',
          result: null,
          error: 'Dependency failed or was cancelled',
          completedAt: new Date().toISOString(),
        };
        subResults.set(subTask.id, cancelledResult);
        continue;
      }

      const result = await this._runSubTask(subTask, spec.parentTaskId);
      subResults.set(subTask.id, result);
    }
  }

  private async _executeMixed(
    spec: SubPlanSpec,
    subResults: Map<string, SubTaskResult>,
  ): Promise<void> {
    const maxParallelism = spec.maxParallelism ?? 4;
    const groups = buildExecutionGroups(spec.subTasks);

    for (const group of groups) {
      // Filter out sub-tasks whose dependencies failed
      const runnable = group.filter(subTask => {
        const depsFailed = (subTask.dependsOn ?? []).some(depId => {
          const depResult = subResults.get(depId);
          return !depResult || depResult.status !== 'completed';
        });
        if (depsFailed) {
          subResults.set(subTask.id, {
            id: subTask.id,
            status: 'cancelled',
            result: null,
            error: 'Dependency failed or was cancelled',
            completedAt: new Date().toISOString(),
          });
          return false;
        }
        return true;
      });

      // Execute runnable sub-tasks in parallel, respecting maxParallelism
      for (let i = 0; i < runnable.length; i += maxParallelism) {
        const batch = runnable.slice(i, i + maxParallelism);
        const promises = batch.map(t => this._runSubTask(t, spec.parentTaskId));
        const results = await Promise.allSettled(promises);

        for (let j = 0; j < batch.length; j++) {
          const settled = results[j];
          if (settled.status === 'fulfilled') {
            subResults.set(batch[j].id, settled.value);
          } else {
            subResults.set(batch[j].id, {
              id: batch[j].id,
              status: 'failed',
              result: null,
              error: String(settled.reason),
              completedAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // ─── Single sub-task execution ────────────────────────────────────────

  private async _runSubTask(
    subTask: SubTaskSpec,
    parentTaskId: string,
  ): Promise<SubTaskResult> {
    this._publish('delegate:subtask-started', {
      parentTaskId,
      subTaskId: subTask.id,
      task: subTask.task,
    });

    _log.info('Sub-task started', { parentTaskId, subTaskId: subTask.id });

    try {
      const delegateId = await this.broker.submit({
        task: subTask.task,
        priority: subTask.priority,
        timeout: subTask.timeout,
        metadata: { parentTaskId, subTaskId: subTask.id },
      });

      const completion = await this.broker.wait(delegateId, subTask.timeout);
      const status = toSubTaskStatus(completion);
      const completedAt = new Date().toISOString();

      const result: SubTaskResult = {
        id: subTask.id,
        status,
        result: completion.result ?? null,
        error: completion.error ?? null,
        completedAt,
      };

      this._publish('delegate:subtask-completed', {
        parentTaskId,
        subTaskId: subTask.id,
        status,
      });

      _log.info('Sub-task completed', {
        parentTaskId,
        subTaskId: subTask.id,
        status,
      });

      return result;
    } catch (err) {
      const result: SubTaskResult = {
        id: subTask.id,
        status: 'failed',
        result: null,
        error: String(err),
        completedAt: new Date().toISOString(),
      };

      this._publish('delegate:subtask-completed', {
        parentTaskId,
        subTaskId: subTask.id,
        status: 'failed',
      });

      _log.error('Sub-task failed', {
        parentTaskId,
        subTaskId: subTask.id,
        error: String(err),
      });

      return result;
    }
  }

  // ─── Result aggregation ───────────────────────────────────────────────

  private _computePlanStatus(
    subResults: Map<string, SubTaskResult>,
  ): SubPlanResult['status'] {
    const results = Array.from(subResults.values());
    if (results.length === 0) return 'completed';

    const allCompleted = results.every(r => r.status === 'completed');
    const anyCompleted = results.some(r => r.status === 'completed');

    if (allCompleted) return 'completed';
    if (anyCompleted) return 'partial';
    return 'failed';
  }

  private _aggregateResults(
    subResults: Map<string, SubTaskResult>,
    aggregation: SubPlanSpec['aggregation'],
  ): unknown {
    const entries = Array.from(subResults.entries());

    if (aggregation === 'sequential') {
      // For sequential: chain results — return the last completed result,
      // or an array of all results in order
      const results = entries
        .filter(([, r]) => r.status === 'completed')
        .map(([id, r]) => ({ id, result: r.result }));

      return results.length === 1
        ? results[0].result
        : results;
    }

    // For parallel / mixed: merge all sub-results into a map
    const merged: Record<string, unknown> = {};
    for (const [id, r] of entries) {
      if (r.status === 'completed') {
        merged[id] = r.result;
      }
    }
    return merged;
  }

  // ─── Ordering ─────────────────────────────────────────────────────────

  private _orderByDependsOn(tasks: SubTaskSpec[]): SubTaskSpec[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const visited = new Set<string>();
    const ordered: SubTaskSpec[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const task = taskMap.get(id);
      if (!task) return;

      for (const dep of task.dependsOn ?? []) {
        visit(dep);
      }
      ordered.push(task);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return ordered;
  }

  // ─── Event publishing ─────────────────────────────────────────────────

  private _publish(channel: string, payload: unknown): void {
    if (this.eventBus) {
      this.eventBus.publish(channel, payload);
    }
  }
}
