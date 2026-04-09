import * as path from 'path';

interface WorkflowAuthoritySummary {
  session_id: string | null;
  workspace_id: string | null;
  project_id: string | null;
}

interface WorkflowStateSnapshotInput {
  schemaVersion: string;
  schemaPolicy: Record<string, string>;
  planId: string;
  task: string;
  level: string;
  planStatus: string;
  runnerState: string;
  currentPhase: string;
  lastCheckpointId: string;
  stateTraceId: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  artifacts: Record<string, string>;
  observability: Record<string, unknown>;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  checkpointTrace: Array<Record<string, unknown>>;
}

interface WorkflowStateResumeMetadataInput {
  currentPhase: string;
  stateTraceId: string;
  canResumeFromCheckpoint: boolean;
  observability: Record<string, unknown>;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
  sessionStatus: string | null;
  workspaceAuthority: WorkflowAuthoritySummary;
}

interface WorkflowHandoffPackageInput {
  generatedAt: string;
  trigger: string;
  planId: string;
  status: string;
  runnerState: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  executionMode: unknown;
  pendingSteps: Array<Record<string, unknown>>;
  blockedBy: string[];
}

interface WorkflowCheckpointRecord {
  id: string;
  step_id: string | null;
  description: string;
  created_at: string;
  plan_id: string | null;
}

interface WorkflowPersistencePhaseInput {
  currentPhase: string | null | undefined;
  templateMeta: Record<string, unknown>;
  checkpointId?: string;
}

interface WorkflowSessionRootInput {
  activePath: string;
  archivedPath: string;
  sessionStatus: string | null | undefined;
  sessionId: string;
}

interface WorkflowStateMetadataInput {
  lane: string;
  executionMode: string;
  qualityMetrics: Record<string, number>;
  templateMeta: Record<string, unknown>;
  recommendationsFrozen: boolean;
  planHash: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  workspaceAuthority: WorkflowAuthoritySummary;
}

interface WorkflowStatePersistedAuditInput {
  planId: string;
  runnerState: string;
  currentPhase: string;
  checkpointId: string | null;
  sessionStatus: string | null;
  workspaceAuthority: WorkflowAuthoritySummary;
  recordedAt: string;
}

export function buildWorkflowStateSnapshot<T>(
  input: WorkflowStateSnapshotInput,
): T {
  return {
    schema_version: input.schemaVersion,
    schema_policy: input.schemaPolicy,
    plan_id: input.planId,
    task: input.task,
    level: input.level,
    plan_status: input.planStatus,
    runner_state: input.runnerState,
    current_phase: input.currentPhase,
    last_checkpoint_id: input.lastCheckpointId,
    state_trace_id: input.stateTraceId,
    updated_at: input.updatedAt,
    metadata: input.metadata,
    artifacts: input.artifacts,
    observability: input.observability,
    budget_guardrail: input.budgetGuardrail,
    handoff_package: input.handoffPackage,
    steps: input.steps,
    checkpoint_trace: input.checkpointTrace,
  } as unknown as T;
}

export function buildWorkflowStateResumeMetadata<T>(
  input: WorkflowStateResumeMetadataInput,
): T {
  return {
    current_phase: input.currentPhase,
    state_trace_id: input.stateTraceId,
    can_resume_from_checkpoint: input.canResumeFromCheckpoint,
    observability: input.observability,
    budget_guardrail: input.budgetGuardrail,
    handoff_package: input.handoffPackage,
    session_status: input.sessionStatus,
    workspace_authority: input.workspaceAuthority,
  } as unknown as T;
}

export function buildWorkflowHandoffPackage<T>(
  input: WorkflowHandoffPackageInput,
): T {
  return {
    generated_at: input.generatedAt,
    trigger: input.trigger,
    plan_id: input.planId,
    status: input.status,
    runner_state: input.runnerState,
    triage_state: input.triageState,
    fix_status: input.fixStatus,
    fix_owner: input.fixOwner,
    execution_mode: input.executionMode,
    pending_steps: input.pendingSteps,
    blocked_by: input.blockedBy,
    next_command: `workflow_execute(plan_id='${input.planId}')`,
  } as unknown as T;
}

export function buildWorkflowCheckpointTrace(
  checkpoints: WorkflowCheckpointRecord[],
  planId: string,
): Array<Record<string, unknown>> {
  return checkpoints
    .filter((checkpoint) => checkpoint.plan_id === planId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map((checkpoint) => ({
      checkpoint_id: checkpoint.id,
      step_id: checkpoint.step_id,
      description: checkpoint.description,
      created_at: checkpoint.created_at,
    }));
}

export function buildWorkflowSnapshotArtifacts(
  sessionRoot: string,
): Record<string, string> {
  return {
    state: path.join(sessionRoot, '.data', 'state.json'),
    handoff: path.join(sessionRoot, 'HANDOFF.md'),
    audit: path.join(sessionRoot, '.data', 'audit.jsonl'),
    snapshot_index: path.join(sessionRoot, '.data', 'snapshot-index.json'),
  };
}

export function resolveWorkflowPersistencePhase(
  input: WorkflowPersistencePhaseInput,
): { phase: string; lastCheckpointId: string } {
  const phase = input.currentPhase ?? 'planned';
  const lastCheckpointId =
    input.checkpointId
    ?? (typeof input.templateMeta['last_checkpoint_id'] === 'string'
      ? String(input.templateMeta['last_checkpoint_id']).trim()
      : '');

  return { phase, lastCheckpointId };
}

export function resolveWorkflowSessionRoot(
  input: WorkflowSessionRootInput,
): string {
  const sessionBase =
    String(input.sessionStatus ?? '') === 'archived'
      ? input.archivedPath
      : input.activePath;
  return path.join(sessionBase, input.sessionId);
}

export function buildWorkflowStateMetadata(
  input: WorkflowStateMetadataInput,
): Record<string, unknown> {
  return {
    lane: input.lane,
    execution_mode: input.executionMode,
    quality_metrics: input.qualityMetrics,
    template_meta: input.templateMeta,
    recommendations_frozen: input.recommendationsFrozen,
    plan_hash: input.planHash,
    triage_state: input.triageState,
    fix_status: input.fixStatus,
    fix_owner: input.fixOwner,
    workspace_authority: input.workspaceAuthority,
  };
}

export function buildWorkflowStatePersistedAuditEvent(
  input: WorkflowStatePersistedAuditInput,
): Record<string, unknown> {
  return {
    event: 'workflow_state_persisted',
    plan_id: input.planId,
    runner_state: input.runnerState,
    current_phase: input.currentPhase,
    checkpoint_id: input.checkpointId,
    session_status: input.sessionStatus,
    workspace_authority: input.workspaceAuthority,
    recorded_at: input.recordedAt,
  };
}
