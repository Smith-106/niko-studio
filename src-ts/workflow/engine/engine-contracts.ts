import {
  buildWorkflowLifecycleActionResponse,
  buildWorkflowLifecycleStatusResponse,
} from './responses.js';
import {
  buildWorkflowCheckpointTrace,
  buildWorkflowSnapshotArtifacts,
  buildWorkflowStateMetadata,
  buildWorkflowStatePersistedAuditEvent,
  buildWorkflowStateResumeMetadata,
  buildWorkflowStateSnapshot,
} from './persistence.js';

export interface WorkflowPlanRuntimeState {
  observability: Record<string, unknown>;
  budgetGuardrail: Record<string, unknown>;
  executionMode: string;
}

export interface WorkflowPlanRuntimeResponseContext {
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
  sessionStatus: string | null;
}

export interface WorkflowExecutionResponseContext {
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  remainingSteps: number;
  stateResumeMetadata: Record<string, unknown>;
}

interface WorkflowAuthoritySnapshot {
  sessionId: string;
  workspaceId: string | null;
  projectId: string | null;
}

interface WorkflowLifecycleContractInput {
  planId: string;
  action: string;
  runnerState: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  planStatus: string;
  lane: string;
  qualityMetrics: Record<string, number>;
  runtime: WorkflowPlanRuntimeResponseContext;
}

interface WorkflowLifecycleActionContractInput extends WorkflowLifecycleContractInput {
  checkpointId?: string;
}

interface WorkflowPersistedStateSnapshotInput {
  schemaVersion: string;
  schemaPolicy: Record<string, string>;
  planId: string;
  task: string;
  level: string;
  planStatus: string;
  runnerState: string;
  currentPhase: string;
  lastCheckpointId: string;
  sessionId: string;
  lane: string;
  executionMode: string;
  qualityMetrics: Record<string, number>;
  templateMeta: Record<string, unknown>;
  recommendationsFrozen: boolean;
  planHash: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  authority: WorkflowAuthoritySnapshot;
  sessionRoot: string;
  observability: Record<string, unknown>;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  checkpoints: Array<{
    id: string;
    step_id: string | null;
    description: string;
    created_at: string;
    plan_id: string | null;
  }>;
}

interface WorkflowResumeMetadataInput {
  currentPhase: string;
  sessionId: string;
  canResumeFromCheckpoint: boolean;
  observability: Record<string, unknown>;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
  sessionStatus: string | null;
  authority: WorkflowAuthoritySnapshot;
}

interface WorkflowPersistedAuditInput {
  planId: string;
  runnerState: string;
  currentPhase: string;
  checkpointId: string | null;
  sessionStatus: string | null;
  authority: WorkflowAuthoritySnapshot;
  recordedAt: string;
}

export function buildWorkflowRuntimeResponseContext(
  runtime: WorkflowPlanRuntimeState,
  handoffPackage: Record<string, unknown>,
  sessionStatus: string | null,
): WorkflowPlanRuntimeResponseContext {
  return {
    executionMode: runtime.executionMode,
    observabilityMetrics: runtime.observability['aggregate'],
    budgetGuardrail: runtime.budgetGuardrail,
    handoffPackage,
    sessionStatus,
  };
}

export function buildWorkflowExecutionResponseContext(
  runtime: WorkflowPlanRuntimeResponseContext,
  remainingSteps: number,
  stateResumeMetadata: Record<string, unknown>,
): WorkflowExecutionResponseContext {
  return {
    executionMode: runtime.executionMode,
    observabilityMetrics: runtime.observabilityMetrics,
    budgetGuardrail: runtime.budgetGuardrail,
    remainingSteps,
    stateResumeMetadata,
  };
}

export function buildWorkflowLifecycleStatusContract(
  input: WorkflowLifecycleContractInput,
): Record<string, unknown> {
  return buildWorkflowLifecycleStatusResponse({
    planId: input.planId,
    action: input.action,
    runnerState: input.runnerState,
    triageState: input.triageState,
    fixStatus: input.fixStatus,
    fixOwner: input.fixOwner,
    planStatus: input.planStatus,
    lane: input.lane,
    qualityMetrics: input.qualityMetrics,
    executionMode: input.runtime.executionMode,
    observabilityMetrics: input.runtime.observabilityMetrics,
    budgetGuardrail: input.runtime.budgetGuardrail,
    handoffPackage: input.runtime.handoffPackage,
    sessionStatus: input.runtime.sessionStatus,
  });
}

export function buildWorkflowLifecycleActionContract(
  input: WorkflowLifecycleActionContractInput,
): Record<string, unknown> {
  return buildWorkflowLifecycleActionResponse({
    planId: input.planId,
    action: input.action,
    runnerState: input.runnerState,
    triageState: input.triageState,
    fixStatus: input.fixStatus,
    fixOwner: input.fixOwner,
    planStatus: input.planStatus,
    checkpointId: input.checkpointId,
    lane: input.lane,
    qualityMetrics: input.qualityMetrics,
    executionMode: input.runtime.executionMode,
    observabilityMetrics: input.runtime.observabilityMetrics,
    budgetGuardrail: input.runtime.budgetGuardrail,
    handoffPackage: input.runtime.handoffPackage,
    sessionStatus: input.runtime.sessionStatus,
  });
}

export function buildWorkflowStateResumeContract(
  input: WorkflowResumeMetadataInput,
): Record<string, unknown> {
  return buildWorkflowStateResumeMetadata<Record<string, unknown>>({
    currentPhase: input.currentPhase,
    stateTraceId: input.sessionId,
    canResumeFromCheckpoint: input.canResumeFromCheckpoint,
    observability: input.observability,
    budgetGuardrail: input.budgetGuardrail,
    handoffPackage: input.handoffPackage,
    sessionStatus: input.sessionStatus,
    workspaceAuthority: {
      session_id: input.authority.sessionId,
      workspace_id: input.authority.workspaceId,
      project_id: input.authority.projectId,
    },
  });
}

export function buildWorkflowPersistedStateSnapshot<T>(
  input: WorkflowPersistedStateSnapshotInput,
): T {
  return buildWorkflowStateSnapshot<T>({
    schemaVersion: input.schemaVersion,
    schemaPolicy: input.schemaPolicy,
    planId: input.planId,
    task: input.task,
    level: input.level,
    planStatus: input.planStatus,
    runnerState: input.runnerState,
    currentPhase: input.currentPhase,
    lastCheckpointId: input.lastCheckpointId,
    stateTraceId: input.sessionId,
    updatedAt: new Date().toISOString(),
    metadata: buildWorkflowStateMetadata({
      lane: input.lane,
      executionMode: input.executionMode,
      qualityMetrics: structuredClone(input.qualityMetrics),
      templateMeta: structuredClone(input.templateMeta),
      recommendationsFrozen: input.recommendationsFrozen,
      planHash: input.planHash,
      triageState: input.triageState,
      fixStatus: input.fixStatus,
      fixOwner: input.fixOwner,
      workspaceAuthority: {
        session_id: input.authority.sessionId,
        workspace_id: input.authority.workspaceId,
        project_id: input.authority.projectId,
      },
    }),
    artifacts: buildWorkflowSnapshotArtifacts(input.sessionRoot),
    observability: structuredClone(input.observability),
    budgetGuardrail: structuredClone(input.budgetGuardrail),
    handoffPackage: structuredClone(input.handoffPackage),
    steps: input.steps,
    checkpointTrace: buildWorkflowCheckpointTrace(input.checkpoints, input.planId),
  });
}

export function buildWorkflowPersistedAuditContract(
  input: WorkflowPersistedAuditInput,
): Record<string, unknown> {
  return buildWorkflowStatePersistedAuditEvent({
    planId: input.planId,
    runnerState: input.runnerState,
    currentPhase: input.currentPhase,
    checkpointId: input.checkpointId,
    sessionStatus: input.sessionStatus,
    workspaceAuthority: {
      session_id: input.authority.sessionId,
      workspace_id: input.authority.workspaceId,
      project_id: input.authority.projectId,
    },
    recordedAt: input.recordedAt,
  });
}
