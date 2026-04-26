import type { WorkflowAuthority } from './authority.js';
import {
  buildWorkflowCheckpointTrace,
  buildWorkflowSnapshotArtifacts,
  buildWorkflowStateMetadata,
  buildWorkflowStatePersistedAuditEvent,
  buildWorkflowStateResumeMetadata,
  buildWorkflowStateSnapshot,
} from './persistence.js';
import {
  buildWorkflowLifecycleActionResponse,
  buildWorkflowLifecycleStatusResponse,
} from './responses.js';

export type WorkflowSerializedMap = Record<string, unknown>;

export interface WorkflowExecutionContextPayload extends WorkflowSerializedMap {
  trace_context?: WorkflowSerializedMap;
  chat_canon_prompt?: string;
}

export type WorkflowRecommendationPrimitive = string | number | boolean | null;

export type WorkflowRecommendationRecordInput = WorkflowSerializedMap & {
  title?: string;
  name?: string;
  recommendation?: string;
  reason?: string;
  rationale?: string;
  action?: string;
  suggestion?: string;
  target?: string;
  params?: WorkflowSerializedMap;
};

export type WorkflowRecommendationInputItem =
  | WorkflowRecommendationPrimitive
  | WorkflowRecommendationRecordInput;

export type WorkflowRecommendationInput = WorkflowRecommendationInputItem[];
export type WorkflowObservabilityMetrics = unknown;

export interface WorkflowErrorResult extends WorkflowSerializedMap {
  error: string;
}

export interface WorkflowRouteRequest {
  task: string;
}

export interface WorkflowTemplateStep {
  name: string;
  description: string;
}

export interface WorkflowRouteResult {
  level: string;
  description: string;
  suggested_workflow: WorkflowTemplateStep[];
  reason: string;
  matched_features: WorkflowSerializedMap[];
  score: number;
  final_level: string;
  routing_diagnostics: WorkflowSerializedMap;
}

export interface WorkflowPlanRequest {
  task: string;
  level?: string;
  recommendations?: WorkflowRecommendationInput;
  executionContext?: WorkflowExecutionContextPayload;
}

export interface WorkflowPlanStepSummary {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  status: string;
}

export interface WorkflowPlanResult {
  plan_id: string;
  level: string;
  template_meta: WorkflowSerializedMap;
  gate_decision: string;
  recommendations: WorkflowSerializedMap[];
  recommendations_frozen: boolean;
  plan_hash: string;
  execution_mode: string;
  observability_metrics: WorkflowObservabilityMetrics;
  budget_guardrail: WorkflowSerializedMap;
  steps: WorkflowPlanStepSummary[];
  total_steps: number;
}

export interface WorkflowStateResumeMetadata {
  current_phase: string;
  state_trace_id: string;
  can_resume_from_checkpoint: boolean;
  observability: WorkflowSerializedMap;
  budget_guardrail: WorkflowSerializedMap;
  handoff_package: WorkflowSerializedMap;
  session_status: string | null;
  workspace_authority: {
    session_id: string;
    workspace_id: string | null;
    project_id: string | null;
  };
}

export interface WorkflowPlanRuntimeState {
  observability: WorkflowSerializedMap;
  budgetGuardrail: WorkflowSerializedMap;
  executionMode: string;
}

export interface WorkflowPlanRuntimeResponseContext {
  executionMode: string;
  observabilityMetrics: WorkflowObservabilityMetrics;
  budgetGuardrail: WorkflowSerializedMap;
  handoffPackage: WorkflowSerializedMap;
  sessionStatus: string | null;
}

export interface WorkflowExecutionResponseContext {
  executionMode: string;
  observabilityMetrics: WorkflowObservabilityMetrics;
  budgetGuardrail: WorkflowSerializedMap;
  remainingSteps: number;
  stateResumeMetadata: WorkflowStateResumeMetadata;
}

export interface WorkflowGateResult extends WorkflowSerializedMap {
  decision: string;
  reason: string;
  risk?: string;
  blocking: boolean;
  destructive: boolean;
  confirm_required: boolean;
  confirmed: boolean;
}

export interface WorkflowExecutionResultBase extends WorkflowStateResumeMetadata {
  execution_mode: string;
  observability_metrics: WorkflowObservabilityMetrics;
}

export interface WorkflowExecuteCompletedResult extends WorkflowExecutionResultBase {
  step_id: string;
  step_name: string;
  status: 'completed';
  result: unknown;
  gate: WorkflowGateResult | WorkflowSerializedMap;
  plan_status: string;
  runner_state: string;
  remaining_steps: number;
}

export interface WorkflowExecuteWaitingConfirmationResult extends WorkflowExecutionResultBase {
  step_id: string;
  step_name: string;
  status: 'waiting_confirmation';
  gate: WorkflowGateResult | WorkflowSerializedMap;
  plan_status: string;
  runner_state: string;
  remaining_steps: number;
}

export interface WorkflowExecuteAllStepsCompletedResult extends WorkflowExecutionResultBase {
  status: 'completed';
  message: string;
}

export interface WorkflowExecuteFailureResult extends WorkflowExecutionResultBase {
  error: string;
  step_id: string;
  failure: {
    phase: string;
    reason: string;
  };
}

export type WorkflowExecuteResult =
  | WorkflowExecuteCompletedResult
  | WorkflowExecuteWaitingConfirmationResult
  | WorkflowExecuteAllStepsCompletedResult
  | WorkflowExecuteFailureResult
  | WorkflowErrorResult;

export interface WorkflowExecuteRequest {
  planId: string;
  stepId?: string;
  recommendations?: WorkflowRecommendationInput;
  confirmToken?: string;
  authority?: WorkflowAuthority | null;
}

export interface WorkflowPlanStatusStepSummary {
  id: string;
  name: string;
  status: string;
  output: unknown;
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
  template_meta: WorkflowSerializedMap;
  gate_decision: string;
  recommendations: WorkflowSerializedMap[];
  recommendations_frozen: boolean;
  plan_hash: string;
  execution_mode: string;
  observability_metrics: WorkflowObservabilityMetrics;
  budget_guardrail: WorkflowSerializedMap;
  handoff_package: WorkflowSerializedMap;
  steps: WorkflowPlanStatusStepSummary[];
  progress: string;
}

export interface WorkflowRunRequest {
  task: string;
  level?: string;
  recommendations?: WorkflowRecommendationInput;
  executionContext?: WorkflowExecutionContextPayload;
}

export interface WorkflowRunCompletedResult {
  status: 'completed';
  plan_id: string;
  plan: WorkflowPlanResult;
  last_step: WorkflowExecuteResult;
  final_status: WorkflowPlanStatusResult;
}

export interface WorkflowRunBlockedResult {
  status: 'blocked';
  plan_id: string;
  plan: WorkflowPlanResult;
  last_step: WorkflowExecuteResult;
  final_status: WorkflowPlanStatusResult;
}

export interface WorkflowRunFailedResult {
  status: 'failed';
  plan_id: string;
  plan: WorkflowPlanResult;
  error: unknown;
}

export type WorkflowRunResult =
  | WorkflowRunCompletedResult
  | WorkflowRunBlockedResult
  | WorkflowRunFailedResult
  | WorkflowErrorResult;

export type WorkflowRunWithExecutionContextRequest = WorkflowRunRequest;
export type WorkflowRunStreamRequest = WorkflowRunRequest;
export type WorkflowRunStreamWithExecutionContextRequest = WorkflowRunRequest;

export interface WorkflowStreamPlanCreationErrorEvent {
  type: 'error';
  status: 'failed';
  error: string;
}

export interface WorkflowStreamPlanCreatedEvent {
  type: 'plan_created';
  plan_id: string;
  plan: WorkflowPlanResult;
}

export interface WorkflowStreamStepStartEvent {
  type: 'step_start';
  plan_id: string;
  step_id: string;
  step_name: string;
  iteration: number;
}

export type WorkflowStreamStepCompleteEvent = {
  type: 'step_complete';
  plan_id: string;
} & WorkflowExecuteResult;

export interface WorkflowStreamPlanErrorEvent {
  type: 'plan_error';
  plan_id: string;
  error: unknown;
}

export interface WorkflowStreamPlanBlockedEvent {
  type: 'plan_blocked';
  plan_id: string;
  status: string;
  last_step: WorkflowExecuteResult;
}

export interface WorkflowStreamPlanCompleteEvent {
  type: 'plan_complete';
  plan_id: string;
  status: 'completed';
  plan: WorkflowPlanResult;
  last_step: WorkflowExecuteResult;
  final_status: WorkflowPlanStatusResult;
}

export type WorkflowStreamEvent =
  | WorkflowStreamPlanCreationErrorEvent
  | WorkflowStreamPlanCreatedEvent
  | WorkflowStreamStepStartEvent
  | WorkflowStreamStepCompleteEvent
  | WorkflowStreamPlanErrorEvent
  | WorkflowStreamPlanBlockedEvent
  | WorkflowStreamPlanCompleteEvent;

export interface WorkflowLifecycleStatusResult {
  plan_id: string;
  action: 'status';
  runner_state: string;
  triage_state: string;
  fix_status: string;
  fix_owner: string;
  plan_status: string;
  lane: string;
  quality_metrics: Record<string, number>;
  execution_mode: string;
  observability_metrics: WorkflowObservabilityMetrics;
  budget_guardrail: WorkflowSerializedMap;
  handoff_package: WorkflowSerializedMap;
  session_status: string | null;
  last_checkpoint_id?: string;
}

export interface WorkflowLifecycleActionResult {
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
  observability_metrics: WorkflowObservabilityMetrics;
  budget_guardrail: WorkflowSerializedMap;
  handoff_package: WorkflowSerializedMap;
  session_status: string | null;
  last_checkpoint_id?: string;
}

export type WorkflowLifecycleResult =
  | WorkflowLifecycleStatusResult
  | WorkflowLifecycleActionResult
  | WorkflowErrorResult;

export interface WorkflowCheckpointResult {
  checkpoint_id: string;
  commit_hash: string | null;
  description: string;
  plan_id: string | null;
  step_id: string | null;
  replay_payload: WorkflowSerializedMap;
  created_at: string;
}

export interface WorkflowCheckpointSummary {
  id: string;
  description: string;
  commit_hash: string | null;
  created_at: string;
}

export interface WorkflowRestoreWaitingConfirmationResult {
  status: 'waiting_confirmation';
  error: string;
  checkpoint_id: string;
  plan_id: string | null;
  step_id: string | null;
  gate: WorkflowGateResult | WorkflowSerializedMap;
}

export interface WorkflowRestoreResult {
  status: 'restored';
  checkpoint_id: string;
  commit_hash: string | null;
  plan_id: string | null;
  step_id: string | null;
  replay: WorkflowSerializedMap;
}

export type WorkflowRestoreCheckpointResult =
  | WorkflowRestoreResult
  | WorkflowRestoreWaitingConfirmationResult
  | WorkflowErrorResult;

export interface WorkflowQuickRollbackResult {
  plan_id: string;
  checkpoint_id: string;
  reason: string;
  restored: boolean;
  restore: WorkflowRestoreCheckpointResult;
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
  recommendations?: WorkflowRecommendationInput,
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

export function normalizeWorkflowExecuteRequest(
  requestOrPlanId: string | WorkflowExecuteRequest,
  stepId?: string,
  recommendations?: WorkflowRecommendationInput,
  confirmToken?: string,
  authority?: WorkflowAuthority | null,
): WorkflowExecuteRequest {
  if (typeof requestOrPlanId === 'string') {
    return {
      planId: requestOrPlanId,
      stepId,
      recommendations,
      confirmToken,
      authority,
    };
  }

  return {
    planId: requestOrPlanId.planId,
    stepId: requestOrPlanId.stepId,
    recommendations: requestOrPlanId.recommendations,
    confirmToken: requestOrPlanId.confirmToken,
    authority: requestOrPlanId.authority,
  };
}

export function normalizeWorkflowRunRequest(
  taskOrRequest: string | WorkflowRunRequest,
  level?: string,
  recommendations?: WorkflowRecommendationInput,
  executionContext?: WorkflowExecutionContextPayload,
): WorkflowRunRequest {
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

export function normalizeWorkflowRunWithExecutionContextRequest(
  taskOrRequest: string | WorkflowRunWithExecutionContextRequest,
  executionContext?: WorkflowExecutionContextPayload,
  level?: string,
  recommendations?: WorkflowRecommendationInput,
): WorkflowRunWithExecutionContextRequest {
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

export function normalizeWorkflowRunStreamRequest(
  taskOrRequest: string | WorkflowRunStreamRequest,
  level?: string,
  recommendations?: WorkflowRecommendationInput,
  executionContext?: WorkflowExecutionContextPayload,
): WorkflowRunStreamRequest {
  return normalizeWorkflowRunRequest(taskOrRequest, level, recommendations, executionContext);
}

export function normalizeWorkflowRunStreamWithExecutionContextRequest(
  taskOrRequest: string | WorkflowRunStreamWithExecutionContextRequest,
  executionContext?: WorkflowExecutionContextPayload,
  level?: string,
  recommendations?: WorkflowRecommendationInput,
): WorkflowRunStreamWithExecutionContextRequest {
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
  stateResumeMetadata: WorkflowStateResumeMetadata,
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
): WorkflowLifecycleStatusResult {
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
): WorkflowLifecycleActionResult {
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
): WorkflowStateResumeMetadata {
  return buildWorkflowStateResumeMetadata<WorkflowStateResumeMetadata>({
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
): WorkflowSerializedMap {
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
