import {
  WorkflowDecision,
  WorkflowLevel,
} from '../types.js';
import type {
  WorkflowGateResult,
  WorkflowRestoreCheckpointResult,
  WorkflowRestoreResult,
  WorkflowRestoreWaitingConfirmationResult,
  WorkflowSerializedMap,
} from './engine-contracts.js';

export interface WorkflowCheckpointLike {
  id: string;
  commit_hash: string | null;
  plan_id: string | null;
  step_id: string | null;
  replay_payload: Record<string, unknown>;
}

interface WorkflowRestoreCheckpointInput {
  checkpoint: WorkflowCheckpointLike;
  confirmToken?: string;
  hasValidConfirmToken: (confirmToken: string | null | undefined) => boolean;
  applyReplayPayload: (checkpoint: WorkflowCheckpointLike) => WorkflowSerializedMap;
  checkoutCommit: (commitHash: string) => Promise<void>;
}

export function buildWorkflowQualityMetrics(task: string): Record<string, number> {
  const taskLength = (task ?? '').length;
  const passRate = taskLength < 80 ? 92.0 : 86.0;
  const riskScore = /维护|maintenance|回收|修复/i.test(task ?? '') ? 0.82 : 0.38;
  const recoveryLatency = taskLength >= 100 ? 280.0 : 120.0;
  return {
    pass_rate: Math.round(passRate * 100) / 100,
    risk_score: Math.round(riskScore * 100) / 100,
    recovery_latency: Math.round(recoveryLatency * 100) / 100,
  };
}

export function determineWorkflowLane(metrics: Record<string, number>): string {
  if (
    (metrics['risk_score'] ?? 0) >= 0.75
    || (metrics['recovery_latency'] ?? 0) >= 240.0
    || (metrics['pass_rate'] ?? 100) < 88.0
  ) {
    return 'maintenance';
  }
  return 'default';
}

export function resolveAdaptiveWorkflowLevel(
  level: number,
  lane: string,
  metrics: Record<string, number>,
): number {
  if (lane !== 'maintenance') return level;
  if ((metrics['risk_score'] ?? 0) >= 0.9 || (metrics['pass_rate'] ?? 100) < 80.0) {
    return WorkflowLevel.L5_COORDINATOR;
  }
  if ((metrics['risk_score'] ?? 0) >= 0.75 || (metrics['recovery_latency'] ?? 0) >= 240.0) {
    return WorkflowLevel.L4_BRAINSTORM;
  }
  if ((metrics['pass_rate'] ?? 100) < 88.0) {
    return WorkflowLevel.L3_STANDARD;
  }
  return level;
}

export function resolveWorkflowGateProfile(
  level: number,
  lane: string,
  metrics: Record<string, number>,
  templateMetadataMap: Record<number, Record<string, unknown>>,
): string {
  if (lane === 'maintenance') {
    if ((metrics['risk_score'] ?? 0) >= 0.9) return 'maintenance-hard';
    if ((metrics['risk_score'] ?? 0) >= 0.75 || (metrics['recovery_latency'] ?? 0) >= 240.0) {
      return 'maintenance-selective-hard';
    }
    return 'maintenance-soft';
  }
  return (templateMetadataMap[level] as Record<string, unknown>)?.['gate_profile'] as string ?? 'default-soft';
}

export function hasValidWorkflowConfirmToken(confirmToken: string | null | undefined): boolean {
  return typeof confirmToken === 'string' && confirmToken.trim().length > 0;
}

export function isDestructiveWorkflowStep(
  stepName: string,
  recommendations: Record<string, unknown>[] | undefined,
  destructiveStepNames: Set<string>,
): boolean {
  if (destructiveStepNames.has(stepName)) return true;
  const destructiveTokens = ['overwrite', 'delete', 'remove', 'destructive', '覆盖', '删除', '移除', '破坏'];
  for (const item of recommendations ?? []) {
    const action = String(item['action'] ?? '').toLowerCase();
    const title = String(item['title'] ?? '').toLowerCase();
    if (destructiveTokens.some((token) => action.includes(token) || title.includes(token))) return true;
  }
  return false;
}

export function evaluateWorkflowRiskGate(
  level: number,
  stepName: string,
  recommendations: Record<string, unknown>[] | undefined,
  confirmToken: string | null | undefined,
  templateMetadataMap: Record<number, Record<string, unknown>>,
  destructiveStepNames: Set<string>,
): WorkflowGateResult {
  const templateMeta = templateMetadataMap[level] ?? {};
  const risk = (templateMeta as Record<string, unknown>)['risk'] as string ?? 'low';
  const needsSoftReview = ['checkpoint', 'final_review'].includes(stepName) && ['medium', 'high'].includes(risk);
  const destructive = isDestructiveWorkflowStep(stepName, recommendations, destructiveStepNames);

  if (destructive) {
    const confirmed = hasValidWorkflowConfirmToken(confirmToken ?? null);
    return {
      decision: confirmed ? WorkflowDecision.GO : WorkflowDecision.NO_GO,
      reason: confirmed
        ? 'destructive write confirmed, hard gate passed'
        : 'destructive write requires secondary confirmation',
      risk: 'high',
      blocking: !confirmed,
      destructive: true,
      confirm_required: true,
      confirmed,
    };
  }
  if (needsSoftReview) {
    return {
      decision: WorkflowDecision.SOFT_GO,
      reason: `${stepName} requires soft gate review under ${risk} risk`,
      risk,
      blocking: false,
      destructive: false,
      confirm_required: false,
      confirmed: true,
    };
  }
  return {
    decision: WorkflowDecision.GO,
    reason: 'soft gate passed',
    risk,
    blocking: false,
    destructive: false,
    confirm_required: false,
    confirmed: true,
  };
}

export async function restoreWorkflowCheckpoint(
  input: WorkflowRestoreCheckpointInput,
): Promise<WorkflowRestoreCheckpointResult> {
  const destructive = Object.keys(input.checkpoint.replay_payload).length > 0;
  const confirmed = !destructive || input.hasValidConfirmToken(input.confirmToken);

  if (destructive && !confirmed) {
    const blocked: WorkflowRestoreWaitingConfirmationResult = {
      status: 'waiting_confirmation',
      error: 'destructive restore requires secondary confirmation',
      checkpoint_id: input.checkpoint.id,
      plan_id: input.checkpoint.plan_id,
      step_id: input.checkpoint.step_id,
      gate: {
        decision: WorkflowDecision.NO_GO,
        reason: 'destructive restore requires secondary confirmation',
        blocking: true,
      },
    };
    return blocked;
  }

  const replayResult = input.applyReplayPayload(input.checkpoint);

  if (input.checkpoint.commit_hash) {
    try {
      await input.checkoutCommit(input.checkpoint.commit_hash);
      const restored: WorkflowRestoreResult = {
        status: 'restored',
        checkpoint_id: input.checkpoint.id,
        commit_hash: input.checkpoint.commit_hash,
        plan_id: input.checkpoint.plan_id,
        step_id: input.checkpoint.step_id,
        replay: replayResult,
      };
      return restored;
    } catch (error) {
      return {
        error: `Git restore failed: ${error}`,
        replay: replayResult,
      };
    }
  }

  if (replayResult['applied'] === true) {
    const restored: WorkflowRestoreResult = {
      status: 'restored',
      checkpoint_id: input.checkpoint.id,
      commit_hash: null,
      plan_id: input.checkpoint.plan_id,
      step_id: input.checkpoint.step_id,
      replay: replayResult,
    };
    return restored;
  }

  return {
    error: 'No commit hash available for this checkpoint',
    plan_id: input.checkpoint.plan_id,
    step_id: input.checkpoint.step_id,
    replay: replayResult,
  };
}
