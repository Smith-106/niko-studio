import * as path from 'path';

import { ContentType, SessionManager } from '../session/session-manager.js';
import type {
  WorkflowPlanResult,
  WorkflowPlanStatusResult,
  WorkflowRestoreCheckpointResult,
  WorkflowSerializedMap,
  WorkflowStreamEvent,
  WorkflowExecuteResult,
  WorkflowRunBlockedResult,
  WorkflowRunCompletedResult,
  WorkflowRunFailedResult,
} from './engine-contracts.js';
import {
  buildWorkflowExecutionCompleteResponse,
  buildWorkflowExecutionErrorResponse,
  buildWorkflowExecutionSuccessResponse,
  buildWorkflowPlanStatusResponse,
  buildWorkflowStreamEvent,
  buildWorkflowWaitingConfirmationResponse,
} from './responses.js';

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

interface WorkflowExecutionMetadata {
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: WorkflowSerializedMap;
  stateResumeMetadata: {
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
  };
}

interface WorkflowCompletedStepInput extends WorkflowExecutionMetadata {
  stepId: string;
  stepName: string;
  gate: WorkflowSerializedMap;
  planStatus: string;
  runnerState: string;
  remainingSteps: number;
  result: unknown;
}

interface WorkflowWaitingConfirmationInput extends WorkflowExecutionMetadata {
  stepId: string;
  stepName: string;
  gate: WorkflowSerializedMap;
  planStatus: string;
  runnerState: string;
  remainingSteps: number;
}

interface WorkflowExecutionFailureInput extends WorkflowExecutionMetadata {
  error: string;
  stepId: string;
}

interface WorkflowAllStepsCompletedInput extends WorkflowExecutionMetadata {
  message: string;
}

interface WorkflowRunCompletedInput {
  planId: string;
  plan: WorkflowPlanResult;
  lastStep: WorkflowExecuteResult;
  finalStatus: WorkflowPlanStatusResult;
}

interface WorkflowRunBlockedInput {
  planId: string;
  plan: WorkflowPlanResult;
  lastStep: WorkflowExecuteResult;
  finalStatus: WorkflowPlanStatusResult;
}

interface WorkflowRunFailedInput {
  planId: string;
  plan: WorkflowPlanResult;
  error: unknown;
}

interface WorkflowRestoreWaitingConfirmationInput {
  checkpointId: string;
  planId: string | null;
  stepId: string | null;
}

interface WorkflowRestoreCompletedInput {
  checkpointId: string;
  commitHash: string | null;
  planId: string | null;
  stepId: string | null;
  replay: WorkflowSerializedMap;
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

export function buildWorkflowCompletedStepResult(
  input: WorkflowCompletedStepInput,
): WorkflowExecuteResult {
  return buildWorkflowExecutionSuccessResponse({
    step_id: input.stepId,
    step_name: input.stepName,
    result: input.result,
    gate: input.gate,
    plan_status: input.planStatus,
    runner_state: input.runnerState,
    remaining_steps: input.remainingSteps,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    current_phase: input.stateResumeMetadata.current_phase,
    state_trace_id: input.stateResumeMetadata.state_trace_id,
    can_resume_from_checkpoint: input.stateResumeMetadata.can_resume_from_checkpoint,
    observability: input.stateResumeMetadata.observability,
    budget_guardrail: input.stateResumeMetadata.budget_guardrail,
    handoff_package: input.stateResumeMetadata.handoff_package,
    session_status: input.stateResumeMetadata.session_status,
    workspace_authority: input.stateResumeMetadata.workspace_authority,
  });
}

export function buildWorkflowWaitingConfirmationResult(
  input: WorkflowWaitingConfirmationInput,
): WorkflowExecuteResult {
  return buildWorkflowWaitingConfirmationResponse({
    step_id: input.stepId,
    step_name: input.stepName,
    gate: input.gate,
    plan_status: input.planStatus,
    runner_state: input.runnerState,
    remaining_steps: input.remainingSteps,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    current_phase: input.stateResumeMetadata.current_phase,
    state_trace_id: input.stateResumeMetadata.state_trace_id,
    can_resume_from_checkpoint: input.stateResumeMetadata.can_resume_from_checkpoint,
    observability: input.stateResumeMetadata.observability,
    budget_guardrail: input.stateResumeMetadata.budget_guardrail,
    handoff_package: input.stateResumeMetadata.handoff_package,
    session_status: input.stateResumeMetadata.session_status,
    workspace_authority: input.stateResumeMetadata.workspace_authority,
  });
}

export function buildWorkflowExecutionFailureResult(
  input: WorkflowExecutionFailureInput,
): WorkflowExecuteResult {
  return buildWorkflowExecutionErrorResponse({
    error: input.error,
    step_id: input.stepId,
    failure: { phase: 'executing', reason: input.error },
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    current_phase: input.stateResumeMetadata.current_phase,
    state_trace_id: input.stateResumeMetadata.state_trace_id,
    can_resume_from_checkpoint: input.stateResumeMetadata.can_resume_from_checkpoint,
    observability: input.stateResumeMetadata.observability,
    budget_guardrail: input.stateResumeMetadata.budget_guardrail,
    handoff_package: input.stateResumeMetadata.handoff_package,
    session_status: input.stateResumeMetadata.session_status,
    workspace_authority: input.stateResumeMetadata.workspace_authority,
  });
}

export function buildWorkflowAllStepsCompletedResult(
  input: WorkflowAllStepsCompletedInput,
): WorkflowExecuteResult {
  return buildWorkflowExecutionCompleteResponse({
    message: input.message,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    current_phase: input.stateResumeMetadata.current_phase,
    state_trace_id: input.stateResumeMetadata.state_trace_id,
    can_resume_from_checkpoint: input.stateResumeMetadata.can_resume_from_checkpoint,
    observability: input.stateResumeMetadata.observability,
    budget_guardrail: input.stateResumeMetadata.budget_guardrail,
    handoff_package: input.stateResumeMetadata.handoff_package,
    session_status: input.stateResumeMetadata.session_status,
    workspace_authority: input.stateResumeMetadata.workspace_authority,
  });
}

export function buildWorkflowRunCompletedResult(
  input: WorkflowRunCompletedInput,
): WorkflowRunCompletedResult {
  return {
    status: 'completed',
    plan_id: input.planId,
    plan: input.plan,
    last_step: input.lastStep,
    final_status: buildWorkflowPlanStatusResponse(input.finalStatus),
  };
}

export function buildWorkflowRunBlockedResult(
  input: WorkflowRunBlockedInput,
): WorkflowRunBlockedResult {
  return {
    status: 'blocked',
    plan_id: input.planId,
    plan: input.plan,
    last_step: input.lastStep,
    final_status: buildWorkflowPlanStatusResponse(input.finalStatus),
  };
}

export function buildWorkflowRunFailedResult(
  input: WorkflowRunFailedInput,
): WorkflowRunFailedResult {
  return {
    status: 'failed',
    plan_id: input.planId,
    plan: input.plan,
    error: input.error,
  };
}

export function buildWorkflowStreamPlanCreationErrorEvent(
  error: string,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'error',
    status: 'failed',
    error,
  });
}

export function buildWorkflowStreamPlanCreatedEvent(
  planId: string,
  plan: WorkflowPlanResult,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'plan_created',
    plan_id: planId,
    plan,
  });
}

export function buildWorkflowStreamStepStartEvent(
  planId: string,
  stepId: string,
  stepName: string,
  iteration: number,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'step_start',
    plan_id: planId,
    step_id: stepId,
    step_name: stepName,
    iteration,
  });
}

export function buildWorkflowStreamStepCompleteEvent(
  planId: string,
  result: WorkflowExecuteResult,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'step_complete',
    plan_id: planId,
    ...result,
  });
}

export function buildWorkflowStreamPlanErrorEvent(
  planId: string,
  error: unknown,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'plan_error',
    plan_id: planId,
    error,
  });
}

export function buildWorkflowStreamPlanBlockedEvent(
  planId: string,
  status: string,
  lastStep: WorkflowExecuteResult,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'plan_blocked',
    plan_id: planId,
    status,
    last_step: lastStep,
  });
}

export function buildWorkflowStreamPlanCompleteEvent(
  planId: string,
  plan: WorkflowPlanResult,
  lastStep: WorkflowExecuteResult,
  finalStatus: WorkflowPlanStatusResult,
): WorkflowStreamEvent {
  return buildWorkflowStreamEvent({
    type: 'plan_complete',
    plan_id: planId,
    status: 'completed',
    plan,
    last_step: lastStep,
    final_status: buildWorkflowPlanStatusResponse(finalStatus),
  });
}

export function buildWorkflowRestoreWaitingConfirmationResult(
  input: WorkflowRestoreWaitingConfirmationInput,
): WorkflowRestoreCheckpointResult {
  return {
    status: 'waiting_confirmation',
    error: 'destructive restore requires secondary confirmation',
    checkpoint_id: input.checkpointId,
    plan_id: input.planId,
    step_id: input.stepId,
    gate: {
      decision: 'no_go',
      reason: 'destructive restore requires secondary confirmation',
      blocking: true,
    },
  };
}

export function buildWorkflowRestoreCompletedResult(
  input: WorkflowRestoreCompletedInput,
): WorkflowRestoreCheckpointResult {
  return {
    status: 'restored',
    checkpoint_id: input.checkpointId,
    commit_hash: input.commitHash,
    plan_id: input.planId,
    step_id: input.stepId,
    replay: input.replay,
  };
}
