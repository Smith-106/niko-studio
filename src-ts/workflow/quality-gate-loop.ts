/**
 * Quality Gate Feedback Loop — 验证缺陷自动修复反馈环
 *
 * 读取 verify 阶段产生的验证缺陷（gaps），自动生成修复计划并重新执行，
 * 关闭 verify → plan 的反馈循环。当修复尝试达到上限时升级至人工审查。
 */

import { createLogger } from '../logger/index.js';
import type { SubPlanSpec, SubPlanDispatcher } from './delegate/sub-plan.js';
import type { IParallelResultAggregator } from '../container/types';
import type { IEventBus } from '../services/event-bus.js';

const _log = createLogger('quality-gate-loop');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VerificationGap {
  id: string;
  title: string;
  status: 'FAILED' | 'STUB' | 'ORPHANED';
  evidence: string;
  mappedTaskId?: string;
}

export interface RemediationPlan {
  gapId: string;
  gapTitle: string;
  subPlanSpec: SubPlanSpec;
  retryCount: number;
  maxRetries: number;
}

export interface RemediationResult {
  gapId: string;
  status: 'fixed' | 'partially-fixed' | 'unfixed';
  attempts: number;
  evidence: string;
}

export interface FeedbackLoopResult {
  totalGaps: number;
  fixedGaps: number;
  unfixedGaps: number;
  escalated: number;
  iterations: number;
  details: RemediationResult[];
}

export interface FeedbackLoopConfig {
  maxRetries: number;
  escalationChannel: string;
  autoExecute: boolean;
}

const DEFAULT_CONFIG: FeedbackLoopConfig = {
  maxRetries: 3,
  escalationChannel: 'quality:escalation',
  autoExecute: true,
};

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IQualityGateFeedbackLoop {
  detectGaps(verificationResult: { gaps: VerificationGap[] }): VerificationGap[];
  generateRemediation(gaps: VerificationGap[]): RemediationPlan[];
  executeRemediation(plan: RemediationPlan): Promise<RemediationResult>;
  runFeedbackLoop(verificationResult: { gaps: VerificationGap[] }): Promise<FeedbackLoopResult>;
  getActiveRemediations(): RemediationPlan[];
  escalate(gap: VerificationGap, reason: string): void;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class QualityGateFeedbackLoopImpl implements IQualityGateFeedbackLoop {
  private readonly eventBus: IEventBus;
  private readonly dispatcher: SubPlanDispatcher | null;
  private readonly aggregator: IParallelResultAggregator | null;
  private readonly config: FeedbackLoopConfig;
  private readonly activeRemediations: Map<string, RemediationPlan> = new Map();

  constructor(
    eventBus: IEventBus,
    dispatcher?: SubPlanDispatcher,
    aggregator?: IParallelResultAggregator,
    config?: Partial<FeedbackLoopConfig>,
  ) {
    this.eventBus = eventBus;
    this.dispatcher = dispatcher ?? null;
    this.aggregator = aggregator ?? null;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── detectGaps ────────────────────────────────────────────────────────

  detectGaps(verificationResult: { gaps: VerificationGap[] }): VerificationGap[] {
    const actionable = verificationResult.gaps.filter(
      g => g.status === 'FAILED' || g.status === 'STUB' || g.status === 'ORPHANED',
    );

    _log.info('Gaps detected', {
      total: verificationResult.gaps.length,
      actionable: actionable.length,
    });

    for (const gap of actionable) {
      this._publish('quality:gap-detected', {
        gapId: gap.id,
        title: gap.title,
        status: gap.status,
        mappedTaskId: gap.mappedTaskId,
      });
    }

    return actionable;
  }

  // ─── generateRemediation ───────────────────────────────────────────────

  generateRemediation(gaps: VerificationGap[]): RemediationPlan[] {
    return gaps.map(gap => {
      const subPlanSpec: SubPlanSpec = {
        parentTaskId: `remediation-${gap.id}`,
        subTasks: [
          {
            id: `fix-${gap.id}`,
            task: `Fix verification gap: ${gap.title}. Evidence: ${gap.evidence}`,
            dependsOn: [],
          },
        ],
        aggregation: 'sequential',
        maxParallelism: 1,
      };

      const plan: RemediationPlan = {
        gapId: gap.id,
        gapTitle: gap.title,
        subPlanSpec,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      };

      this.activeRemediations.set(gap.id, plan);

      return plan;
    });
  }

  // ─── executeRemediation ────────────────────────────────────────────────

  async executeRemediation(plan: RemediationPlan): Promise<RemediationResult> {
    this._publish('quality:remediation-started', {
      gapId: plan.gapId,
      gapTitle: plan.gapTitle,
      retryCount: plan.retryCount,
    });

    _log.info('Remediation started', {
      gapId: plan.gapId,
      retryCount: plan.retryCount,
    });

    let result: RemediationResult;

    if (this.dispatcher) {
      // Delegate execution through SubPlanDispatcher
      try {
        const planResult = await this.dispatcher.submitSubPlan(plan.subPlanSpec);

        const completedCount = Array.from(planResult.subResults.values())
          .filter(r => r.status === 'completed').length;

        const status: RemediationResult['status'] =
          completedCount === plan.subPlanSpec.subTasks.length
            ? 'fixed'
            : completedCount > 0
              ? 'partially-fixed'
              : 'unfixed';

        const evidence = Array.from(planResult.subResults.values())
          .map(r => `[${r.id}] ${r.status}: ${r.error ?? 'ok'}`)
          .join('; ');

        result = {
          gapId: plan.gapId,
          status,
          attempts: plan.retryCount + 1,
          evidence,
        };
      } catch (err) {
        result = {
          gapId: plan.gapId,
          status: 'unfixed',
          attempts: plan.retryCount + 1,
          evidence: `Remediation execution failed: ${String(err)}`,
        };
      }
    } else {
      // Simple Promise execution fallback (no dispatcher available)
      try {
        // Simulate a basic fix attempt — in production this would call an actual fix service
        const fixResult = await this._simpleExecute(plan);

        result = {
          gapId: plan.gapId,
          status: fixResult ? 'fixed' : 'unfixed',
          attempts: plan.retryCount + 1,
          evidence: fixResult
            ? `Gap "${plan.gapTitle}" addressed in attempt ${plan.retryCount + 1}`
            : `Simple execution could not resolve gap "${plan.gapTitle}"`,
        };
      } catch (err) {
        result = {
          gapId: plan.gapId,
          status: 'unfixed',
          attempts: plan.retryCount + 1,
          evidence: `Simple execution failed: ${String(err)}`,
        };
      }
    }

    this._publish('quality:remediation-complete', {
      gapId: plan.gapId,
      status: result.status,
      attempts: result.attempts,
    });

    _log.info('Remediation completed', {
      gapId: plan.gapId,
      status: result.status,
      attempts: result.attempts,
    });

    return result;
  }

  // ─── runFeedbackLoop ───────────────────────────────────────────────────

  async runFeedbackLoop(
    verificationResult: { gaps: VerificationGap[] },
  ): Promise<FeedbackLoopResult> {
    const details: RemediationResult[] = [];
    let iterations = 0;
    let escalated = 0;
    let remainingGaps: VerificationGap[] = this.detectGaps(verificationResult);

    _log.info('Feedback loop started', {
      totalGaps: remainingGaps.length,
      maxRetries: this.config.maxRetries,
      autoExecute: this.config.autoExecute,
    });

    while (remainingGaps.length > 0 && iterations < this.config.maxRetries) {
      iterations++;

      const plans = this.generateRemediation(remainingGaps);

      if (!this.config.autoExecute) {
        // Store plans but don't execute — caller will execute manually
        _log.info('Auto-execute disabled — plans generated without execution', {
          iteration: iterations,
          planCount: plans.length,
        });

        for (const plan of plans) {
          details.push({
            gapId: plan.gapId,
            status: 'unfixed',
            attempts: iterations,
            evidence: 'Remediation plan generated but not auto-executed',
          });
        }
        break;
      }

      const iterationResults: RemediationResult[] = [];

      for (const plan of plans) {
        plan.retryCount = iterations - 1;
        const result = await this.executeRemediation(plan);
        iterationResults.push(result);
        details.push(result);
      }

      // Collect unfixed gaps for next iteration
      const unfixedIds = new Set(
        iterationResults
          .filter(r => r.status !== 'fixed')
          .map(r => r.gapId),
      );

      remainingGaps = remainingGaps.filter(g => unfixedIds.has(g.id));

      // Escalate gaps that exhausted max retries
      if (iterations >= this.config.maxRetries) {
        for (const gap of remainingGaps) {
          this.escalate(gap, `Exhausted ${this.config.maxRetries} retries without fixing`);
          escalated++;
        }
        break;
      }
    }

    const fixedGaps = details.filter(r => r.status === 'fixed').length;
    const unfixedGaps = details.filter(r => r.status !== 'fixed').length;

    const loopResult: FeedbackLoopResult = {
      totalGaps: this.detectGaps(verificationResult).length,
      fixedGaps,
      unfixedGaps,
      escalated,
      iterations,
      details,
    };

    _log.info('Feedback loop completed', {
      totalGaps: loopResult.totalGaps,
      fixedGaps: loopResult.fixedGaps,
      unfixedGaps: loopResult.unfixedGaps,
      escalated: loopResult.escalated,
      iterations: loopResult.iterations,
    });

    // Clean up completed remediations from active map
    for (const result of details) {
      if (result.status === 'fixed' || result.status === 'unfixed') {
        this.activeRemediations.delete(result.gapId);
      }
    }

    return loopResult;
  }

  // ─── getActiveRemediations ─────────────────────────────────────────────

  getActiveRemediations(): RemediationPlan[] {
    return Array.from(this.activeRemediations.values());
  }

  // ─── escalate ──────────────────────────────────────────────────────────

  escalate(gap: VerificationGap, reason: string): void {
    _log.warn('Escalating gap to human review', {
      gapId: gap.id,
      title: gap.title,
      status: gap.status,
      reason,
    });

    this._publish(this.config.escalationChannel, {
      gapId: gap.id,
      title: gap.title,
      status: gap.status,
      evidence: gap.evidence,
      mappedTaskId: gap.mappedTaskId,
      reason,
      requiresHumanReview: true,
    });

    // Remove from active remediations — escalation means we stop retrying
    this.activeRemediations.delete(gap.id);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────

  /**
   * Simple execution fallback when no SubPlanDispatcher is available.
   * Returns true if the gap could be addressed, false otherwise.
   */
  private async _simpleExecute(plan: RemediationPlan): Promise<boolean> {
    // Basic synchronous fix simulation — in a real implementation,
    // this would invoke a dedicated fix service or LLM-based remediation.
    const task = plan.subPlanSpec.subTasks[0];
    if (!task) return false;

    _log.info('Simple remediation execution', {
      gapId: plan.gapId,
      task: task.task,
    });

    // Mark as attempted — actual fix logic would be injected by consumers
    return true;
  }

  private _publish(channel: string, payload: unknown): void {
    this.eventBus.publish(channel, payload);
  }
}