import type {
  WorkflowExecuteResult,
  WorkflowExecutionErrorResult,
  WorkflowExecutionResponseContext,
  WorkflowExecutionSuccessResult,
  WorkflowExecutionTerminalResult,
  WorkflowExecutionWaitingConfirmationResult,
  WorkflowLifecycleResult,
  WorkflowPlanResult,
  WorkflowPlanRuntimeResponseContext,
  WorkflowPlanStatusResult,
  WorkflowRecommendation,
  WorkflowRiskGateResult,
  WorkflowRouteResult,
  WorkflowRunBlockedResult,
  WorkflowRunCompletedResult,
  WorkflowRunFailedResult,
  WorkflowStateResumeMetadataContract,
  WorkflowStreamErrorEvent,
  WorkflowStreamEvent,
  WorkflowStreamPlanBlockedEvent,
  WorkflowStreamPlanCompleteEvent,
  WorkflowStreamPlanCreatedEvent,
  WorkflowStreamPlanErrorEvent,
  WorkflowStreamStepCompleteEvent,
  WorkflowStreamStepStartEvent,
  WorkflowTemplateStepDescriptor,
} from './engine-contracts.js';

interface WorkflowExecutionResponseBaseInput {
  stepId: string;
  stepName: string;
  planStatus: string;
  runnerState: string;
  remainingSteps: number;
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  stateResumeMetadata: WorkflowStateResumeMetadataContract;
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

interface WorkflowPlanStepResponseInput extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  status: string;
}

interface WorkflowPlanStatusStepResponseInput extends Record<string, unknown> {
  id: string;
  name: string;
  status: string;
  output: unknown;
}

export function buildWorkflowRouteResponse(input: {
  level: string;
  description: string;
  suggestedWorkflow: WorkflowTemplateStepDescriptor[];
  reason: string;
  matchedFeatures: Array<Record<string, unknown>>;
  score: number;
  finalLevel: string;
  routingDiagnostics: Record<string, unknown>;
}): WorkflowRouteResult {
  return {
    level: input.level,
    description: input.description,
    suggested_workflow: input.suggestedWorkflow,
    reason: input.reason,
    matched_features: input.matchedFeatures,
    score: input.score,
    final_level: input.finalLevel,
    routing_diagnostics: input.routingDiagnostics,
  };
}

export function buildWorkflowPlanResponse(input: {
  planId: string;
  level: string;
  templateMeta: Record<string, unknown>;
  gateDecision: string;
  recommendations: WorkflowRecommendation[];
  recommendationsFrozen: boolean;
  planHash: string;
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  steps: WorkflowPlanStepResponseInput[];
  totalSteps: number;
}): WorkflowPlanResult {
  return {
    plan_id: input.planId,
    level: input.level,
    template_meta: input.templateMeta,
    gate_decision: input.gateDecision,
    recommendations: input.recommendations,
    recommendations_frozen: input.recommendationsFrozen,
    plan_hash: input.planHash,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    steps: input.steps,
    total_steps: input.totalSteps,
  };
}

export function buildWorkflowWaitingConfirmationResponse(
  input: WorkflowExecutionResponseBaseInput & { gate: WorkflowRiskGateResult },
): WorkflowExecutionWaitingConfirmationResult {
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
    ...input.stateResumeMetadata,
    budget_guardrail: input.budgetGuardrail,
  };
}

export function buildWorkflowExecutionSuccessResponse(
  input: WorkflowExecutionResponseBaseInput & {
    result: unknown;
    gate: WorkflowRiskGateResult;
  },
): WorkflowExecutionSuccessResult {
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
    ...input.stateResumeMetadata,
    budget_guardrail: input.budgetGuardrail,
  };
}

export function buildWorkflowExecutionTerminalResponse(
  input: WorkflowExecutionResponseContext & { message: string },
): WorkflowExecutionTerminalResult {
  return {
    status: 'completed',
    message: input.message,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    ...input.stateResumeMetadata,
    budget_guardrail: input.budgetGuardrail,
  };
}

export function buildWorkflowExecutionErrorResponse(
  input: {
    error: string;
    stepId: string;
    executionMode: string;
    observabilityMetrics: unknown;
    budgetGuardrail: Record<string, unknown>;
    stateResumeMetadata: WorkflowStateResumeMetadataContract;
  },
): WorkflowExecutionErrorResult {
  return {
    error: input.error,
    step_id: input.stepId,
    failure: { phase: 'executing', reason: input.error },
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    ...input.stateResumeMetadata,
    budget_guardrail: input.budgetGuardrail,
  };
}

export function buildWorkflowLifecycleStatusResponse(
  input: WorkflowLifecycleResponseBaseInput & {
    sessionStatus: string | null;
  },
): WorkflowLifecycleResult {
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
): WorkflowLifecycleResult {
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

export function buildWorkflowPlanStatusResponse(input: {
  planId: string;
  task: string;
  level: string;
  status: string;
  runnerState: string;
  triageState: string;
  fixStatus: string;
  fixOwner: string;
  templateMeta: Record<string, unknown>;
  gateDecision: string;
  recommendations: WorkflowRecommendation[];
  recommendationsFrozen: boolean;
  planHash: string;
  executionMode: string;
  observabilityMetrics: unknown;
  budgetGuardrail: Record<string, unknown>;
  handoffPackage: Record<string, unknown>;
  steps: WorkflowPlanStatusStepResponseInput[];
  progress: string;
}): WorkflowPlanStatusResult {
  return {
    plan_id: input.planId,
    task: input.task,
    level: input.level,
    status: input.status,
    runner_state: input.runnerState,
    triage_state: input.triageState,
    fix_status: input.fixStatus,
    fix_owner: input.fixOwner,
    template_meta: input.templateMeta,
    gate_decision: input.gateDecision,
    recommendations: input.recommendations,
    recommendations_frozen: input.recommendationsFrozen,
    plan_hash: input.planHash,
    execution_mode: input.executionMode,
    observability_metrics: input.observabilityMetrics,
    budget_guardrail: input.budgetGuardrail,
    handoff_package: input.handoffPackage,
    steps: input.steps,
    progress: input.progress,
  };
}

export function buildWorkflowRunFailedResponse(input: {
  planId: string;
  plan: WorkflowPlanResult;
  error: unknown;
}): WorkflowRunFailedResult {
  return {
    status: 'failed',
    plan_id: input.planId,
    plan: input.plan,
    error: input.error,
  };
}

export function buildWorkflowRunBlockedResponse(input: {
  planId: string;
  plan: WorkflowPlanResult;
  lastStep: WorkflowExecuteResult;
  finalStatus: WorkflowPlanStatusResult;
}): WorkflowRunBlockedResult {
  return {
    status: 'blocked',
    plan_id: input.planId,
    plan: input.plan,
    last_step: input.lastStep,
    final_status: input.finalStatus,
  };
}

export function buildWorkflowRunCompletedResponse(input: {
  planId: string;
  plan: WorkflowPlanResult;
  lastStep: WorkflowExecuteResult;
  finalStatus: WorkflowPlanStatusResult;
}): WorkflowRunCompletedResult {
  return {
    status: 'completed',
    plan_id: input.planId,
    plan: input.plan,
    last_step: input.lastStep,
    final_status: input.finalStatus,
  };
}

export function buildWorkflowStreamErrorEvent(input: {
  error: string;
}): WorkflowStreamErrorEvent {
  return {
    type: 'error',
    status: 'failed',
    error: input.error,
  };
}

export function buildWorkflowStreamPlanCreatedEvent(input: {
  planId: string;
  plan: WorkflowPlanResult;
}): WorkflowStreamPlanCreatedEvent {
  return {
    type: 'plan_created',
    plan_id: input.planId,
    plan: input.plan,
  };
}

export function buildWorkflowStreamStepStartEvent(input: {
  planId: string;
  stepId: string;
  stepName: string;
  iteration: number;
}): WorkflowStreamStepStartEvent {
  return {
    type: 'step_start',
    plan_id: input.planId,
    step_id: input.stepId,
    step_name: input.stepName,
    iteration: input.iteration,
  };
}

export function buildWorkflowStreamStepCompleteEvent(input: {
  planId: string;
  result: WorkflowExecuteResult;
}): WorkflowStreamStepCompleteEvent {
  return {
    type: 'step_complete',
    plan_id: input.planId,
    ...input.result,
  };
}

export function buildWorkflowStreamPlanErrorEvent(input: {
  planId: string;
  error: string;
}): WorkflowStreamPlanErrorEvent {
  return {
    type: 'plan_error',
    plan_id: input.planId,
    error: input.error,
  };
}

export function buildWorkflowStreamPlanBlockedEvent(input: {
  planId: string;
  status: string;
  lastStep: WorkflowExecuteResult;
}): WorkflowStreamPlanBlockedEvent {
  return {
    type: 'plan_blocked',
    plan_id: input.planId,
    status: input.status,
    last_step: input.lastStep,
  };
}

export function buildWorkflowStreamPlanCompleteEvent(input: {
  planId: string;
  plan: WorkflowPlanResult;
  lastStep: WorkflowExecuteResult;
  finalStatus: WorkflowPlanStatusResult;
}): WorkflowStreamPlanCompleteEvent {
  return {
    type: 'plan_complete',
    plan_id: input.planId,
    status: 'completed',
    plan: input.plan,
    last_step: input.lastStep,
    final_status: input.finalStatus,
  };
}

export function buildWorkflowOperationError(input: {
  error: string;
  fields?: Record<string, unknown>;
}): WorkflowExecuteResult {
  return {
    error: input.error,
    ...(input.fields ?? {}),
  };
}

export function isWorkflowBlockedStatus(status: unknown): boolean {
  return ['waiting_confirmation', 'preflight_blocked', 'gate_blocked'].includes(String(status));
}

export function isWorkflowExecutionComplete(result: WorkflowExecuteResult): boolean {
  return result['plan_status'] === 'completed'
    || (result['status'] === 'completed' && Number(result['remaining_steps'] ?? 1) === 0);
}

export function buildWorkflowStreamEvents(input: {
  planId: string;
  plan: WorkflowPlanResult;
  result: WorkflowExecuteResult;
  finalStatus: WorkflowPlanStatusResult;
  iteration: number;
  currentStep?: { id: string; name: string } | null;
}): WorkflowStreamEvent[] {
  const events: WorkflowStreamEvent[] = [];
  if (input.currentStep) {
    events.push(buildWorkflowStreamStepStartEvent({
      planId: input.planId,
      stepId: input.currentStep.id,
      stepName: input.currentStep.name,
      iteration: input.iteration,
    }));
  }
  events.push(buildWorkflowStreamStepCompleteEvent({
    planId: input.planId,
    result: input.result,
  }));
  if ('error' in input.result) {
    events.push(buildWorkflowStreamPlanErrorEvent({
      planId: input.planId,
      error: String(input.result.error),
    }));
  } else if (isWorkflowBlockedStatus(input.result.status)) {
    events.push(buildWorkflowStreamPlanBlockedEvent({
      planId: input.planId,
      status: String(input.result.status),
      lastStep: input.result,
    }));
  } else if (isWorkflowExecutionComplete(input.result)) {
    events.push(buildWorkflowStreamPlanCompleteEvent({
      planId: input.planId,
      plan: input.plan,
      lastStep: input.result,
      finalStatus: input.finalStatus,
    }));
  }
  return events;
}
