import type {
  WorkflowExecuteResult,
  WorkflowPlanStatusResult,
  WorkflowSerializedMap,
} from './engine-contracts.js';

export interface MutableWorkflowStepState {
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface MutableWorkflowPlanRuntimeState {
  id: string;
  status: string;
  runner_state: string;
  triage_state: string;
  fix_status: string;
  fix_owner: string;
  template_meta: Record<string, unknown>;
}

interface WorkflowExecutionOutcomeInput<TPlan, TStep> {
  plan: TPlan;
  step: TStep;
  gate: WorkflowSerializedMap;
  executeStep: (plan: TPlan, step: TStep) => Promise<unknown>;
  transitionStepState: (
    plan: TPlan,
    step: TStep,
    targetStatus: string,
    reason: string,
  ) => void;
  completeExecutionStep: (
    plan: TPlan,
    step: TStep,
    gate: WorkflowSerializedMap,
    result: unknown,
  ) => WorkflowExecuteResult;
  failExecutionStep: (
    plan: TPlan,
    step: TStep,
    error: unknown,
    runtime: {
      observability: Record<string, unknown>;
      budgetGuardrail: Record<string, unknown>;
      executionMode: string;
    },
  ) => WorkflowExecuteResult;
  runtime: {
    observability: Record<string, unknown>;
    budgetGuardrail: Record<string, unknown>;
    executionMode: string;
  };
}

export function canonicalWorkflowStepStatus(
  status: string,
  legacyToCanonical: Record<string, string>,
): string {
  return legacyToCanonical[status] ?? status;
}

export function remainingWorkflowSteps(
  steps: Array<Pick<MutableWorkflowStepState, 'status'>>,
  legacyToCanonical: Record<string, string>,
): number {
  return steps.filter((step) => canonicalWorkflowStepStatus(step.status, legacyToCanonical) !== 'done').length;
}

export function applyWorkflowStepTransition(
  step: MutableWorkflowStepState,
  targetStatus: string,
  legacyToCanonical: Record<string, string>,
  allowedTransitions: Record<string, Set<string>>,
  nowIso: string,
): { current: string; target: string } {
  const current = canonicalWorkflowStepStatus(step.status, legacyToCanonical);
  const target = canonicalWorkflowStepStatus(targetStatus, legacyToCanonical);
  if (target !== current && !(allowedTransitions[current]?.has(target))) {
    throw new Error(`Invalid step transition: ${current} -> ${target}`);
  }

  step.status = target;
  if (target === 'executing' && !step.started_at) step.started_at = nowIso;
  if (['done', 'failed'].includes(target)) step.completed_at = nowIso;
  return { current, target };
}

export function applyWorkflowRunnerTransition(
  plan: MutableWorkflowPlanRuntimeState,
  targetState: string,
  allowedTransitions: Record<string, Set<string>>,
  transitionReason: string,
): { currentState: string; targetState: string } {
  const currentState = plan.runner_state;
  const allowed = allowedTransitions[currentState];
  if (targetState !== currentState && !allowed?.has(targetState)) {
    throw new Error(`Invalid runner transition: ${currentState} -> ${targetState}`);
  }

  plan.runner_state = targetState;
  if (targetState === 'running' && plan.status === 'created') plan.status = 'running';
  if (targetState === 'stopped' && !['completed', 'failed'].includes(plan.status)) plan.status = 'failed';
  if (transitionReason) {
    plan.template_meta['runner_transition_reason'] = transitionReason;
  }

  return { currentState, targetState };
}

export function applyWorkflowTriageTransition(
  plan: MutableWorkflowPlanRuntimeState,
  targetState: string,
  allowedTransitions: Record<string, Set<string>>,
): { changed: boolean } {
  const currentState = plan.triage_state;
  const allowed = allowedTransitions[currentState];
  if (targetState !== currentState && !allowed?.has(targetState)) {
    throw new Error(`Invalid triage transition: ${currentState} -> ${targetState}`);
  }
  if (targetState === currentState) {
    return { changed: false };
  }

  plan.triage_state = targetState;
  if (['in_progress', 'escalated'].includes(targetState)) {
    plan.fix_status = 'in_progress';
    if (!plan.fix_owner) plan.fix_owner = plan.id;
  } else if (targetState === 'resolved') {
    plan.fix_status = 'fixed';
    if (!plan.fix_owner) plan.fix_owner = plan.id;
  } else if (targetState === 'rejected') {
    plan.fix_status = 'wont_fix';
    if (!plan.fix_owner) plan.fix_owner = plan.id;
  }

  return { changed: true };
}

export async function executeWorkflowStepWithTransitions<TPlan, TStep>(
  input: WorkflowExecutionOutcomeInput<TPlan, TStep>,
): Promise<WorkflowExecuteResult> {
  try {
    input.transitionStepState(input.plan, input.step, 'executing', 'execution_started');
    const result = await input.executeStep(input.plan, input.step);
    input.transitionStepState(input.plan, input.step, 'review', 'execution_review');
    input.transitionStepState(input.plan, input.step, 'test', 'execution_test');
    input.transitionStepState(input.plan, input.step, 'done', 'execution_completed');
    return input.completeExecutionStep(input.plan, input.step, input.gate, result);
  } catch (error) {
    return input.failExecutionStep(input.plan, input.step, error, input.runtime);
  }
}

export function buildWorkflowPlanStatusResult(
  input: WorkflowPlanStatusResult,
): WorkflowPlanStatusResult {
  return structuredClone(input);
}
