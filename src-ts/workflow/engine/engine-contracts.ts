import {
  buildWorkflowCheckpointTrace,
  buildWorkflowSnapshotArtifacts,
  buildWorkflowStateMetadata,
  buildWorkflowStatePersistedAuditEvent,
  buildWorkflowStateResumeMetadata,
  buildWorkflowStateSnapshot,
} from './persistence.js';
import {
  buildWorkflowLifecycleActionContract as buildWorkflowLifecycleActionResponseContract,
  buildWorkflowLifecycleStatusContract as buildWorkflowLifecycleStatusResponseContract,
} from './responses.js';
import type { WorkflowAuthority } from './authority.js';


export interface WorkflowRecommendation {
  [key: string]: unknown;
}

export interface WorkflowExecutionContextPayload {
  [key: string]: unknown;
}

export interface WorkflowTemplateStepDescriptor {
  name: string;
  description: string;
}

export interface WorkflowRouteRequest {
  task: string;
}

export interface WorkflowRouteResult {
  level: string;
  description: string;
  suggested_workflow: WorkflowTemplateStepDescriptor[];
  reason: string;
  matched_features: Array<Record<string, unknown>>;
  score: number;
  final_level: string;
  routing_diagnostics: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowPlanStepResult {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  status: string;
  [key: string]: unknown;
}

export interface WorkflowPlanRequest {
  task: string;
  level?: string;
  recommendations?: WorkflowRecommendation[];
  executionContext?: WorkflowExecutionContextPayload;
}

export interface WorkflowPlanResult {
  plan_id: string;
  level: string;
  template_meta: Record<string, unknown>;
  gate_decision: string;
  recommendations: WorkflowRecommendation[];
  recommendations_frozen: boolean;
  plan_hash: string;
  execution_mode: string;
  observability_metrics: unknown;
  budget_guardrail: Record<string, unknown>;
  steps: WorkflowPlanStepResult[];
  total_steps: number;
  [key: string]: unknown;
}

export interface WorkflowWorkspaceAuthorityContract {
  session_id: string | null;
  workspace_id: string | null;
  project_id: string | null;
}

export interface WorkflowStateResumeMetadataContract {
  current_phase: string;
  state_trace_id: string;
  can_resume_from_checkpoint: boolean;
  observability: Record<string, unknown>;
  budget_guardrail: Record<string, unknown>;
  handoff_package: Record<string, unknown>;
  session_status: string | null;
  workspace_authority: WorkflowWorkspaceAuthorityContract;
  [key: string]: unknown;
}

export interface WorkflowRiskGateResult {
  decision: string;
  reason: string;
  risk: string;
  blocking: boolean;
  destructive: boolean;
  confirm_required: boolean;
  confirmed: boolean;
  [key: string]: unknown;
}

export interface WorkflowExecutionResultBase extends WorkflowStateResumeMetadataContract {
  execution_mode: string;
  observability_metrics: unknown;
  budget_guardrail: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WorkflowExecutionSuccessResult extends WorkflowExecutionResultBase {
  step_id: string;
  step_name: string;
  status: 'completed';
  result: unknown;
  gate: WorkflowRiskGateResult;
  plan_status: string;
  runner_state: string;
  remaining_steps: number;
}

export interface WorkflowExecutionWaitingConfirmationResult extends WorkflowExecutionResultBase {
  step_id: string;
  step_name: string;
  status: 'waiting_confirmation';
  gate: WorkflowRiskGateResult;
  plan_status: string;
  runner_state: string;
  remaining_steps: number;
}

export interface WorkflowExecutionTerminalResult extends WorkflowExecutionResultBase {
  status: 'completed';
  message: string;
}

export interface WorkflowExecutionErrorResult extends WorkflowExecutionResultBase {
  error: string;
  step_id: string;
  failure: {
    phase: string;
    reason: string;
  };
}

export interface WorkflowOperationErrorResult {
  error: string;
  [key: string]: unknown;
}

export type WorkflowExecuteResult =
  | WorkflowExecutionSuccessResult
  | WorkflowExecutionWaitingConfirmationResult
  | WorkflowExecutionTerminalResult
  | WorkflowExecutionErrorResult
  | WorkflowOperationErrorResult;

export interface WorkflowExecuteRequest {
  planId: string;
  stepId?: string;
  recommendations?: WorkflowRecommendation[];
  confirmToken?: string;
  authority?: WorkflowAuthority | null;
}

export interface WorkflowPlanStatusStepResult {
  id: string;
  name: string;
  status: string;
  output: unknown;
  [key: string]: unknown;
}

export interface WorkflowPlanStatusResult {
  plan_id: string;
  task: string;
  level: string;
  status: string;
  runner_state: string;
  triage_state: string;
  fix_status: string;
  fix_owner: string;
  template_meta: Record<string, unknown>;
  gate_decision: string;
  recommendations: WorkflowRecommendation[];
  recommendations_frozen: boolean;
  plan_hash: string;
  execution_mode: string;
  observability_metrics: unknown;
  budget_guardrail: Record<string, unknown>;
  handoff_package: Record<string, unknown>;
  steps: WorkflowPlanStatusStepResult[];
  progress: string;
  [key: string]: unknown;
}

export interface WorkflowRunRequest extends WorkflowPlanRequest {}

export interface WorkflowRunCompletedResult {
  status: 'completed';
  plan_id: string;
  plan: WorkflowPlanResult;
  last_step: WorkflowExecuteResult;
  final_status: WorkflowPlanStatusResult;
  [key: string]: unknown;
}

export interface WorkflowRunBlockedResult {
  status: 'blocked';
  plan_id: string;
  plan: WorkflowPlanResult;
  last_step: WorkflowExecuteResult;
  final_status: WorkflowPlanStatusResult;
  [key: string]: unknown;
}

export interface WorkflowRunFailedResult {
  status: 'failed';
  plan_id: string;
  plan: WorkflowPlanResult;
  error: unknown;
  [key: string]: unknown;
}

export type WorkflowRunResult =
  | WorkflowRunCompletedResult
  | WorkflowRunBlockedResult
  | WorkflowRunFailedResult
  | WorkflowOperationErrorResult;

export interface WorkflowRunWithExecutionContextRequest {
  task: string;
  executionContext?: WorkflowExecutionContextPayload;
  level?: string;
  recommendations?: WorkflowRecommendation[];
}

export interface WorkflowStreamPlanCreatedEvent {
  type: 'plan_created';
  plan_id: string;
  plan: WorkflowPlanResult;
  [key: string]: unknown;
}

export interface WorkflowStreamStepStartEvent {
  type: 'step_start';
  plan_id: string;
  step_id: string;
  step_name: string;
  iteration: number;
  [key: string]: unknown;
}

export interface WorkflowStreamStepCompleteEvent {
  type: 'step_complete';
  plan_id: string;
  [key: string]: unknown;
}

export interface WorkflowStreamPlanErrorEvent {
  type: 'plan_error';
  plan_id: string;
  error: string;
  [key: string]: unknown;
}

export interface WorkflowStreamPlanBlockedEvent {
  type: 'plan_blocked';
  plan_id: string;
  status: string;
  last_step: WorkflowExecuteResult;
  [key: string]: unknown;
}

export interface WorkflowStreamPlanCompleteEvent {
  type: 'plan_complete';
  plan_id: string;
  status: 'completed';
  plan: WorkflowPlanResult;
  last_step: WorkflowExecuteResult;
  final_status: WorkflowPlanStatusResult;
  [key: string]: unknown;
}

export interface WorkflowStreamErrorEvent {
  type: 'error';
  status: 'failed';
  error: string;
  [key: string]: unknown;
}

export type WorkflowStreamEvent =
  | WorkflowStreamPlanCreatedEvent
  | WorkflowStreamStepStartEvent
  | WorkflowStreamStepCompleteEvent
  | WorkflowStreamPlanErrorEvent
  | WorkflowStreamPlanBlockedEvent
  | WorkflowStreamPlanCompleteEvent
  | WorkflowStreamErrorEvent;

export interface WorkflowStreamRequest extends WorkflowPlanRequest {}

export interface WorkflowStreamWithExecutionContextRequest {
  task: string;
  executionContext?: WorkflowExecutionContextPayload;
  level?: string;
  recommendations?: WorkflowRecommendation[];
}

export interface WorkflowLifecycleResult {
  plan_id: string;
  action: string;
  runner_state: string;
  triage_state: string;
  fix_status: string;
  fix_owner: string;
  plan_status: string;
  checkpoint_id?: string;
  lane: string;
  quality_metrics: Record<string, number>;
  execution_mode: string;
  observability_metrics: unknown;
  budget_guardrail: Record<string, unknown>;
  handoff_package: Record<string, unknown>;
  session_status: string | null;
  last_checkpoint_id?: string;
  [key: string]: unknown;
}

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
  stateResumeMetadata: WorkflowStateResumeMetadataContract;
}

export interface WorkflowAuthoritySnapshot {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
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

export function normalizeWorkflowRouteRequest(
  taskOrRequest: string | WorkflowRouteRequest,
): WorkflowRouteRequest {
  if (typeof taskOrRequest === 'string') {
    return { task: taskOrRequest };
  }
  return { task: taskOrRequest.task };
}

export function normalizeWorkflowPlanRequest(
  taskOrRequest: string | WorkflowPlanRequest,
  level?: string,
  recommendations?: WorkflowRecommendation[],
  executionContext?: WorkflowExecutionContextPayload,
): WorkflowPlanRequest {
  if (typeof taskOrRequest === 'string') {
    return {
      task: taskOrRequest,
      level,
      recommendations,
      executionContext,
    };
  }

  return {
    task: taskOrRequest.task,
    level: taskOrRequest.level,
    recommendations: taskOrRequest.recommendations,
    executionContext: taskOrRequest.executionContext,
  };
}

export function normalizeWorkflowRunRequest(
  taskOrRequest: string | WorkflowRunRequest,
  level?: string,
  recommendations?: WorkflowRecommendation[],
  executionContext?: WorkflowExecutionContextPayload,
): WorkflowRunRequest {
  return normalizeWorkflowPlanRequest(
    taskOrRequest,
    level,
    recommendations,
    executionContext,
  );
}

export function normalizeWorkflowRunWithExecutionContextRequest(
  taskOrRequest: string | WorkflowRunWithExecutionContextRequest,
  executionContext?: WorkflowExecutionContextPayload,
  level?: string,
  recommendations?: WorkflowRecommendation[],
): WorkflowRunRequest {
  if (typeof taskOrRequest === 'string') {
    return {
      task: taskOrRequest,
      executionContext,
      level,
      recommendations,
    };
  }

  return {
    task: taskOrRequest.task,
    executionContext: taskOrRequest.executionContext,
    level: taskOrRequest.level,
    recommendations: taskOrRequest.recommendations,
  };
}

export function normalizeWorkflowExecuteRequest(
  planIdOrRequest: string | WorkflowExecuteRequest,
  stepId?: string,
  recommendations?: WorkflowRecommendation[],
  confirmToken?: string,
  authority?: WorkflowAuthority | null,
): WorkflowExecuteRequest {
  if (typeof planIdOrRequest === 'string') {
    return {
      planId: planIdOrRequest,
      stepId,
      recommendations,
      confirmToken,
      authority,
    };
  }

  return {
    planId: planIdOrRequest.planId,
    stepId: planIdOrRequest.stepId,
    recommendations: planIdOrRequest.recommendations,
    confirmToken: planIdOrRequest.confirmToken,
    authority: planIdOrRequest.authority,
  };
}

export function normalizeWorkflowStreamRequest(
  taskOrRequest: string | WorkflowStreamRequest,
  level?: string,
  recommendations?: WorkflowRecommendation[],
  executionContext?: WorkflowExecutionContextPayload,
): WorkflowStreamRequest {
  return normalizeWorkflowPlanRequest(
    taskOrRequest,
    level,
    recommendations,
    executionContext,
  );
}

export function normalizeWorkflowStreamWithExecutionContextRequest(
  taskOrRequest: string | WorkflowStreamWithExecutionContextRequest,
  executionContext?: WorkflowExecutionContextPayload,
  level?: string,
  recommendations?: WorkflowRecommendation[],
): WorkflowStreamRequest {
  return normalizeWorkflowRunWithExecutionContextRequest(
    taskOrRequest,
    executionContext,
    level,
    recommendations,
  );
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
  stateResumeMetadata: WorkflowStateResumeMetadataContract,
): WorkflowExecutionResponseContext {
  return {
    executionMode: runtime.executionMode,
    observabilityMetrics: runtime.observabilityMetrics,
    budgetGuardrail: runtime.budgetGuardrail,
    remainingSteps,
    stateResumeMetadata,
  };
}

export function buildWorkflowLifecycleStatusContract(input: {
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
}): WorkflowLifecycleResult {
  return buildWorkflowLifecycleStatusResponseContract(input);
}

export function buildWorkflowLifecycleActionContract(input: {
  planId: string;
  action: string;
  runnerState: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  planStatus: string;
  checkpointId?: string;
  lane: string;
  qualityMetrics: Record<string, number>;
  runtime: WorkflowPlanRuntimeResponseContext;
}): WorkflowLifecycleResult {
  return buildWorkflowLifecycleActionResponseContract(input);
}

export function buildWorkflowStateResumeContract(
  input: WorkflowResumeMetadataInput,
): WorkflowStateResumeMetadataContract {
  return buildWorkflowStateResumeMetadata<WorkflowStateResumeMetadataContract>({
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

// ============================================================
// Compatibility aliases (consumed by engine sub-modules)
// ============================================================

export type WorkflowRecommendationInput = Array<Record<string, unknown>> | unknown[];

export type WorkflowErrorResult = WorkflowOperationErrorResult;

export type WorkflowLifecycleActionResult = WorkflowLifecycleResult;

export type WorkflowSerializedMap = Record<string, unknown>;

export type WorkflowGateResult = WorkflowRiskGateResult;

export interface WorkflowRestoreWaitingConfirmationResult {
  status: 'waiting_confirmation';
  error: string;
  checkpoint_id: string;
  plan_id: string | null;
  step_id: string | null;
  gate: {
    decision: string;
    reason: string;
    blocking: boolean;
  };
}

export interface WorkflowRestoreResult {
  status: 'restored';
  checkpoint_id: string;
  commit_hash: string | null;
  plan_id: string | null;
  step_id: string | null;
  replay: Record<string, unknown>;
}

export type WorkflowRestoreCheckpointResult =
  | WorkflowRestoreWaitingConfirmationResult
  | WorkflowRestoreResult
  | { error: string; replay: Record<string, unknown> }
  | { error: string; plan_id: string | null; step_id: string | null; replay: Record<string, unknown> };
