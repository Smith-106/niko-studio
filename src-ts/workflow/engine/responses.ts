interface WorkflowExecutionResponseBaseInput {
  stepId: string;
  stepName: string;
  planStatus: string;
  runnerState: string;
  remainingSteps: number;
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  stateResumeMetadata: Record<string, unknown>;
}

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

export function buildWorkflowWaitingConfirmationResponse(
  input: WorkflowExecutionResponseBaseInput & { gate: Record<string, unknown> },
): Record<string, unknown> {
  return {
    step_id: input.stepId,
    step_name: input.stepName,
    status: 'waiting_confirmation',
    gate: input.gate,
    plan_status: input.planStatus,
    runner_state: input.runnerState,
    remaining_steps: input.remainingSteps,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    ...input.stateResumeMetadata,
  };
}

export function buildWorkflowExecutionSuccessResponse(
  input: WorkflowExecutionResponseBaseInput & {
    result: unknown;
    gate: Record<string, unknown>;
  },
): Record<string, unknown> {
  return {
    step_id: input.stepId,
    step_name: input.stepName,
    status: 'completed',
    result: input.result,
    gate: input.gate,
    plan_status: input.planStatus,
    runner_state: input.runnerState,
    remaining_steps: input.remainingSteps,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    ...input.stateResumeMetadata,
  };
}

export function buildWorkflowExecutionErrorResponse(
  input: {
    error: string;
    stepId: string;
    executionMode: string;
    observabilityMetrics: unknown;
    budgetGuardrail: Record<string, unknown>;
    stateResumeMetadata: Record<string, unknown>;
  },
): Record<string, unknown> {
  return {
    error: input.error,
    step_id: input.stepId,
    failure: { phase: 'executing', reason: input.error },
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    ...input.stateResumeMetadata,
  };
}

export function buildWorkflowLifecycleStatusResponse(
  input: WorkflowLifecycleResponseBaseInput & {
    sessionStatus: string | null;
  },
): Record<string, unknown> {
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
): Record<string, unknown> {
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
