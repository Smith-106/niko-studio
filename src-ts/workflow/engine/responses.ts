import type {
  WorkflowExecuteAllStepsCompletedResult,
  WorkflowExecuteCompletedResult,
  WorkflowExecuteFailureResult,
  WorkflowExecuteResult,
  WorkflowExecuteWaitingConfirmationResult,
  WorkflowLifecycleActionResult,
  WorkflowLifecycleStatusResult,
  WorkflowPlanResult,
  WorkflowPlanStatusResult,
  WorkflowRestoreCheckpointResult,
  WorkflowRouteResult,
  WorkflowRunBlockedResult,
  WorkflowRunCompletedResult,
  WorkflowRunFailedResult,
  WorkflowStreamEvent,
} from './engine-contracts.js';

interface WorkflowLifecycleResponseBaseInput {
  planId: string;
  action: string;
  runnerState: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  planStatus: string;
  lane: string;
  qualityMetrics: Record<string, number>;
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
}

export function buildWorkflowRouteResponse(input: WorkflowRouteResult): WorkflowRouteResult {
  return structuredClone(input);
}

export function buildWorkflowPlanResponse(input: WorkflowPlanResult): WorkflowPlanResult {
  return structuredClone(input);
}

export function buildWorkflowPlanStatusResponse(
  input: WorkflowPlanStatusResult,
): WorkflowPlanStatusResult {
  return structuredClone(input);
}

export function buildWorkflowWaitingConfirmationResponse(
  input: Omit<WorkflowExecuteWaitingConfirmationResult, 'status'>,
): WorkflowExecuteWaitingConfirmationResult {
  return {
    ...structuredClone(input),
    status: 'waiting_confirmation',
  };
}

export function buildWorkflowExecutionSuccessResponse(
  input: Omit<WorkflowExecuteCompletedResult, 'status'>,
): WorkflowExecuteCompletedResult {
  return {
    ...structuredClone(input),
    status: 'completed',
  };
}

export function buildWorkflowExecutionCompleteResponse(
  input: Omit<WorkflowExecuteAllStepsCompletedResult, 'status'>,
): WorkflowExecuteAllStepsCompletedResult {
  return {
    ...structuredClone(input),
    status: 'completed',
  };
}

export function buildWorkflowExecutionErrorResponse(
  input: WorkflowExecuteFailureResult,
): WorkflowExecuteFailureResult {
  return structuredClone(input);
}

export function buildWorkflowLifecycleStatusResponse(
  input: WorkflowLifecycleResponseBaseInput & {
    sessionStatus: string | null;
  },
): WorkflowLifecycleStatusResult {
  return {
    plan_id: input.planId,
    action: 'status',
    runner_state: input.runnerState,
    triage_state: input.triageState,
    fix_status: input.fixStatus,
    fix_owner: input.fixOwner,
    plan_status: input.planStatus,
    lane: input.lane,
    quality_metrics: input.qualityMetrics,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    handoff_package: input.handoffPackage,
    session_status: input.sessionStatus,
  };
}

export function buildWorkflowLifecycleActionResponse(
  input: WorkflowLifecycleResponseBaseInput & {
    checkpointId?: string;
    sessionStatus: string | null;
  },
): WorkflowLifecycleActionResult {
  return {
    plan_id: input.planId,
    action: input.action,
    runner_state: input.runnerState,
    triage_state: input.triageState,
    fix_status: input.fixStatus,
    fix_owner: input.fixOwner,
    plan_status: input.planStatus,
    checkpoint_id: input.checkpointId,
    lane: input.lane,
    quality_metrics: input.qualityMetrics,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    handoff_package: input.handoffPackage,
    session_status: input.sessionStatus,
  };
}

export function buildWorkflowRunCompletedResponse(
  input: WorkflowRunCompletedResult,
): WorkflowRunCompletedResult {
  return structuredClone(input);
}

export function buildWorkflowRunBlockedResponse(
  input: WorkflowRunBlockedResult,
): WorkflowRunBlockedResult {
  return structuredClone(input);
}

export function buildWorkflowRunFailedResponse(
  input: WorkflowRunFailedResult,
): WorkflowRunFailedResult {
  return structuredClone(input);
}

export function buildWorkflowStreamEvent<T extends WorkflowStreamEvent>(event: T): T {
  return structuredClone(event);
}

export function buildWorkflowRestoreCheckpointResponse<T extends WorkflowRestoreCheckpointResult>(
  result: T,
): T {
  return structuredClone(result);
}

export function isWorkflowExecutionErrorResult(
  result: WorkflowExecuteResult,
): result is WorkflowExecuteFailureResult | { error: string } {
  return 'error' in result;
}
