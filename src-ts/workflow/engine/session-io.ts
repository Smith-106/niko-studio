import * as path from 'path';

import { ContentType, SessionManager } from '../session/session-manager.js';
import {
  buildWorkflowPersistedAuditContract,
  buildWorkflowPersistedStateSnapshot,
  buildWorkflowStateResumeContract,
  type WorkflowAuthoritySnapshot,
  type WorkflowStateResumeMetadataContract,
} from './engine-contracts.js';
import { resolveWorkflowPersistencePhase } from './persistence.js';

interface WorkflowSessionContextInput {
  sessionManager: SessionManager;
  sessionId: string;
  runnerState: string;
  checkpointId?: string;
}

interface WorkflowStateArtifactsWriteInput {
  sessionManager: SessionManager;
  sessionId: string;
  snapshot: unknown;
  auditEvent: Record<string, unknown>;
}

interface WorkflowPersistedCheckpointRecord {
  id: string;
  step_id: string | null;
  description: string;
  created_at: string;
  plan_id: string | null;
}

interface WorkflowPersistedPlanStep {
  id: string;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

interface WorkflowPersistedPlanLike {
  id: string;
  task: string;
  level: string;
  status: string;
  runner_state: string;
  triage_state: string;
  fix_status: string;
  fix_owner: string;
  template_meta: Record<string, unknown>;
  recommendations_frozen: boolean;
  plan_hash: string;
  lane: string;
  quality_metrics: Record<string, number>;
  observability: Record<string, unknown>;
  budget_guardrail: Record<string, unknown>;
  handoff_package: Record<string, unknown>;
  steps: WorkflowPersistedPlanStep[];
}

interface PersistWorkflowPlanStateInput {
  plan: WorkflowPersistedPlanLike;
  currentPhase?: string | null;
  checkpointId?: string;
  schemaVersion: string;
  schemaPolicy: Record<string, string>;
  sessionManager: SessionManager;
  checkpoints: WorkflowPersistedCheckpointRecord[];
  canonicalizeStepStatus: (status: string) => string;
  getPlanAuthority: (planId: string) => WorkflowAuthoritySnapshot | null;
  getPlanSessionId: (planId: string) => string;
}

interface BuildWorkflowResumeMetadataForPlanInput {
  plan: Pick<
    WorkflowPersistedPlanLike,
    'id' | 'status' | 'template_meta' | 'observability' | 'budget_guardrail' | 'handoff_package'
  >;
  getPlanAuthority: (planId: string) => WorkflowAuthoritySnapshot | null;
  getPlanSessionId: (planId: string) => string;
}

function resolveAuthoritySnapshot(
  planId: string,
  getPlanAuthority: (planId: string) => WorkflowAuthoritySnapshot | null,
  getPlanSessionId: (planId: string) => string,
): WorkflowAuthoritySnapshot {
  const authority = getPlanAuthority(planId);
  const sessionId = authority?.sessionId ?? getPlanSessionId(planId);
  return {
    sessionId,
    workspaceId: authority?.workspaceId ?? null,
    projectId: authority?.projectId ?? null,
  };
}

export function syncWorkflowSessionContext(
  input: WorkflowSessionContextInput,
): { sessionLifecycle: Record<string, unknown>; sessionRoot: string } {
  const sessionLifecycle = input.sessionManager.syncLifecycle(
    input.sessionId,
    input.runnerState,
    input.checkpointId,
  );

  const sessionBase =
    String(sessionLifecycle['status'] ?? '') === 'archived'
      ? input.sessionManager.archivedPath
      : input.sessionManager.activePath;

  return {
    sessionLifecycle,
    sessionRoot: path.join(sessionBase, input.sessionId),
  };
}

export function writeWorkflowStateArtifacts(
  input: WorkflowStateArtifactsWriteInput,
): void {
  input.sessionManager.write(
    input.sessionId,
    ContentType.STATE,
    JSON.stringify(input.snapshot, null, 2),
  );
  input.sessionManager.appendAudit(input.sessionId, input.auditEvent);
}

export function persistWorkflowPlanState(
  input: PersistWorkflowPlanStateInput,
): Record<string, unknown> {
  const { phase, lastCheckpointId } = resolveWorkflowPersistencePhase({
    currentPhase: input.currentPhase,
    templateMeta: input.plan.template_meta,
    checkpointId: input.checkpointId,
  });
  input.plan.template_meta['current_phase'] = phase;
  if (lastCheckpointId) {
    input.plan.template_meta['last_checkpoint_id'] = lastCheckpointId;
  }

  const authoritySnapshot = resolveAuthoritySnapshot(
    input.plan.id,
    input.getPlanAuthority,
    input.getPlanSessionId,
  );
  const { sessionLifecycle, sessionRoot } = syncWorkflowSessionContext({
    sessionManager: input.sessionManager,
    sessionId: authoritySnapshot.sessionId,
    runnerState: input.plan.runner_state,
    checkpointId: lastCheckpointId || undefined,
  });
  input.plan.template_meta['session_id'] = authoritySnapshot.sessionId;
  input.plan.template_meta['session_status'] = sessionLifecycle['status'] ?? null;

  const snapshot = buildWorkflowPersistedStateSnapshot<Record<string, unknown>>({
    schemaVersion: input.schemaVersion,
    schemaPolicy: input.schemaPolicy,
    planId: input.plan.id,
    task: input.plan.task,
    level: input.plan.level,
    planStatus: input.plan.status,
    runnerState: input.plan.runner_state,
    currentPhase: phase,
    lastCheckpointId,
    sessionId: authoritySnapshot.sessionId,
    lane: input.plan.lane,
    executionMode: String(input.plan.template_meta['execution_mode'] ?? ''),
    qualityMetrics: input.plan.quality_metrics,
    templateMeta: input.plan.template_meta,
    recommendationsFrozen: input.plan.recommendations_frozen,
    planHash: input.plan.plan_hash,
    triageState: input.plan.triage_state,
    fixStatus: input.plan.fix_status,
    fixOwner: input.plan.fix_owner,
    authority: authoritySnapshot,
    sessionRoot,
    observability: input.plan.observability,
    budgetGuardrail: input.plan.budget_guardrail,
    handoffPackage: input.plan.handoff_package,
    steps: input.plan.steps.map((step) => ({
      id: step.id,
      name: step.name,
      status: input.canonicalizeStepStatus(step.status),
      started_at: step.started_at,
      completed_at: step.completed_at,
    })),
    checkpoints: input.checkpoints,
  });

  writeWorkflowStateArtifacts({
    sessionManager: input.sessionManager,
    sessionId: authoritySnapshot.sessionId,
    snapshot,
    auditEvent: buildWorkflowPersistedAuditContract({
      planId: input.plan.id,
      runnerState: input.plan.runner_state,
      currentPhase: phase,
      checkpointId: lastCheckpointId || null,
      sessionStatus: (sessionLifecycle['status'] as string | null | undefined) ?? null,
      authority: authoritySnapshot,
      recordedAt: String(snapshot['updated_at'] ?? new Date().toISOString()),
    }),
  });

  return sessionLifecycle;
}

export function buildWorkflowResumeMetadataForPlan(
  input: BuildWorkflowResumeMetadataForPlanInput,
): WorkflowStateResumeMetadataContract {
  const authoritySnapshot = resolveAuthoritySnapshot(
    input.plan.id,
    input.getPlanAuthority,
    input.getPlanSessionId,
  );

  return buildWorkflowStateResumeContract({
    currentPhase: String(input.plan.template_meta['current_phase'] ?? input.plan.status),
    sessionId: authoritySnapshot.sessionId,
    canResumeFromCheckpoint: !!input.plan.template_meta['last_checkpoint_id'],
    observability: input.plan.observability,
    budgetGuardrail: input.plan.budget_guardrail,
    handoffPackage: input.plan.handoff_package,
    sessionStatus: (input.plan.template_meta['session_status'] as string | null | undefined) ?? null,
    authority: authoritySnapshot,
  });
}
