import type { ExecFileOptions } from 'node:child_process';

import { WorkflowDecision } from '../types.js';

export interface WorkflowCheckpointRecordLike {
  id: string;
  description: string;
  commit_hash: string | null;
  plan_id: string | null;
  step_id: string | null;
  replay_payload: Record<string, unknown>;
  created_at: string;
}

export interface WorkflowCheckpointPlanLike {
  status: string;
  template_meta: Record<string, unknown>;
  recommendations: Record<string, unknown>[];
  recommendations_frozen: boolean;
  plan_hash: string;
}

export interface WorkflowCheckpointView {
  id: string;
  description: string;
  commit_hash?: string | null;
  created_at: string;
  plan_id?: string | null;
  step_id?: string | null;
  replay_payload?: Record<string, unknown>;
}

export interface WorkflowCheckpointStrategy<
  TPlan extends WorkflowCheckpointPlanLike = WorkflowCheckpointPlanLike,
  TCheckpoint extends WorkflowCheckpointRecordLike = WorkflowCheckpointRecordLike,
> {
  createCheckpoint(
    description?: string,
    autoCommit?: boolean,
    planId?: string,
    stepId?: string,
    replayPayload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  restoreCheckpointInternal(checkpointId: string, confirmToken?: string): Promise<Record<string, unknown>>;
  listCheckpoints(limit?: number): Promise<Record<string, unknown>[]>;
  getCheckpoint(checkpointId: string): WorkflowCheckpointView | null;
  applyReplayPayload(checkpoint: TCheckpoint): Record<string, unknown>;
}

type WorkflowContractWrapper = <T extends Record<string, unknown>>(payload: T) => T;
type WorkflowExecFileRunner = (
  file: string,
  args: readonly string[],
  options?: ExecFileOptions,
) => Promise<{ stdout: string; stderr?: string }>;

type WorkflowCheckpointFactory<TCheckpoint extends WorkflowCheckpointRecordLike> = (data: {
  id: string;
  description: string;
  commit_hash?: string | null;
  plan_id?: string | null;
  step_id?: string | null;
  replay_payload?: Record<string, unknown>;
}) => TCheckpoint;

interface DefaultWorkflowCheckpointStrategyOptions<
  TPlan extends WorkflowCheckpointPlanLike,
  TCheckpoint extends WorkflowCheckpointRecordLike,
> {
  workspace: string;
  checkpoints: Map<string, TCheckpoint>;
  plans: Map<string, TPlan>;
  execFileAsync: WorkflowExecFileRunner;
  createId: () => string;
  createCheckpointRecord: WorkflowCheckpointFactory<TCheckpoint>;
  withContract: WorkflowContractWrapper;
  hasValidConfirmToken: (confirmToken: string | null | undefined) => boolean;
  canonicalizeRecommendations: (recommendations?: unknown[]) => Record<string, unknown>[];
  computePlanHash: (plan: TPlan) => string;
  persistPlanState: (plan: TPlan, currentPhase?: string | null, checkpointId?: string) => Record<string, unknown>;
}

export class DefaultWorkflowCheckpointStrategy<
  TPlan extends WorkflowCheckpointPlanLike,
  TCheckpoint extends WorkflowCheckpointRecordLike,
> implements WorkflowCheckpointStrategy<TPlan, TCheckpoint> {
  constructor(private readonly options: DefaultWorkflowCheckpointStrategyOptions<TPlan, TCheckpoint>) {}

  async createCheckpoint(
    description: string = '',
    autoCommit: boolean = true,
    planId?: string,
    stepId?: string,
    replayPayload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const checkpointId = this.options.createId();
    let commitHash: string | null = null;

    if (autoCommit) {
      try {
        await this.options.execFileAsync('git', ['add', this.options.workspace], { cwd: this.options.workspace });
        const { stdout: commitOut } = await this.options.execFileAsync(
          'git',
          ['commit', '-m', `[checkpoint:${checkpointId}] ${description || 'Auto checkpoint'}`],
          { cwd: this.options.workspace },
        );
        if (commitOut) {
          const { stdout: hashOut } = await this.options.execFileAsync('git', ['rev-parse', 'HEAD'], {
            cwd: this.options.workspace,
          });
          commitHash = hashOut.trim();
        }
      } catch {
        // Git not available or no changes to commit
      }
    }

    const checkpoint = this.options.createCheckpointRecord({
      id: checkpointId,
      description,
      commit_hash: commitHash,
      plan_id: planId,
      step_id: stepId,
      replay_payload: replayPayload ? structuredClone(replayPayload) : {},
    });
    this.options.checkpoints.set(checkpointId, checkpoint);

    if (planId && this.options.plans.has(planId)) {
      this.options.persistPlanState(this.options.plans.get(planId)!, undefined, checkpointId);
    }

    return {
      checkpoint_id: checkpointId,
      commit_hash: commitHash,
      description,
      plan_id: checkpoint.plan_id,
      step_id: checkpoint.step_id,
      replay_payload: checkpoint.replay_payload,
      created_at: checkpoint.created_at,
    };
  }

  async restoreCheckpointInternal(checkpointId: string, confirmToken?: string): Promise<Record<string, unknown>> {
    const checkpoint = this.options.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { error: `Checkpoint '${checkpointId}' not found` };
    }

    const destructive = Object.keys(checkpoint.replay_payload).length > 0;
    const confirmed = !destructive || this.options.hasValidConfirmToken(confirmToken);

    if (destructive && !confirmed) {
      return this.options.withContract({
        status: 'waiting_confirmation',
        error: 'destructive restore requires secondary confirmation',
        checkpoint_id: checkpointId,
        plan_id: checkpoint.plan_id,
        step_id: checkpoint.step_id,
        gate: {
          decision: WorkflowDecision.NO_GO,
          reason: 'destructive restore requires secondary confirmation',
          blocking: true,
        },
      });
    }

    const replayResult = this.applyReplayPayload(checkpoint);

    if (checkpoint.commit_hash) {
      try {
        await this.options.execFileAsync('git', ['checkout', checkpoint.commit_hash], { cwd: this.options.workspace });
        return this.options.withContract({
          status: 'restored',
          checkpoint_id: checkpointId,
          commit_hash: checkpoint.commit_hash,
          plan_id: checkpoint.plan_id,
          step_id: checkpoint.step_id,
          replay: replayResult,
        });
      } catch (error) {
        return { error: `Git restore failed: ${error}`, replay: replayResult };
      }
    }

    if (replayResult['applied'] === true) {
      return this.options.withContract({
        status: 'restored',
        checkpoint_id: checkpointId,
        commit_hash: null,
        plan_id: checkpoint.plan_id,
        step_id: checkpoint.step_id,
        replay: replayResult,
      });
    }

    return {
      error: 'No commit hash available for this checkpoint',
      plan_id: checkpoint.plan_id,
      step_id: checkpoint.step_id,
      replay: replayResult,
    };
  }

  async listCheckpoints(limit: number = 10): Promise<Record<string, unknown>[]> {
    return Array.from(this.options.checkpoints.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((checkpoint) => ({
        id: checkpoint.id,
        description: checkpoint.description,
        commit_hash: checkpoint.commit_hash,
        created_at: checkpoint.created_at,
      }));
  }

  getCheckpoint(checkpointId: string): WorkflowCheckpointView | null {
    const checkpoint = this.options.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return null;
    }
    return {
      id: checkpoint.id,
      description: checkpoint.description,
      commit_hash: checkpoint.commit_hash ?? null,
      created_at: checkpoint.created_at,
      plan_id: checkpoint.plan_id ?? null,
      step_id: checkpoint.step_id ?? null,
      replay_payload: checkpoint.replay_payload ?? {},
    };
  }

  applyReplayPayload(checkpoint: TCheckpoint): Record<string, unknown> {
    const payload = checkpoint.replay_payload;
    if (!payload || Object.keys(payload).length === 0) {
      return { applied: false, reason: 'no_replay_payload' };
    }

    const planId = (payload['plan_id'] as string) ?? checkpoint.plan_id;
    if (!planId) {
      return { applied: false, reason: 'no_plan_id' };
    }

    const plan = this.options.plans.get(planId);
    if (!plan) {
      return { applied: false, reason: `plan_not_found:${planId}` };
    }

    const expectedHash = payload['plan_hash'];
    if (typeof expectedHash !== 'string' || expectedHash.trim().length === 0) {
      return { applied: false, reason: 'missing_plan_hash' };
    }

    const currentHash = this.options.computePlanHash(plan);
    if (currentHash !== expectedHash) {
      return {
        applied: false,
        reason: 'plan_hash_mismatch',
        expected_plan_hash: expectedHash,
        current_plan_hash: currentHash,
      };
    }

    plan.recommendations = this.options.canonicalizeRecommendations(payload['recommendations'] as unknown[]);
    plan.recommendations_frozen = Boolean(payload['recommendations_frozen'] ?? true);
    plan.plan_hash = expectedHash;

    return {
      applied: true,
      plan_id: planId,
      plan_hash: plan.plan_hash,
      recommendation_count: plan.recommendations.length,
    };
  }
}
