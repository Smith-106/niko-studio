export interface WorkflowPlanObservabilityInput {
  steps: Array<{ status: string }>;
  task: string;
  createdAt: string;
  budgetGuardrail: Record<string, unknown>;
  observability: Record<string, unknown>;
  templateMeta: Record<string, unknown>;
}

export function createWorkflowObservabilityBaseline(
  observabilityModes: readonly string[],
): Record<string, unknown> {
  return {
    wave: 5,
    mode: observabilityModes[0],
    upgrade_target: observabilityModes[0],
    upgrade_reason: 'baseline',
    mode_changed: false,
    threshold_triggered: false,
    aggregate: {
      completed_steps: 0,
      failed_steps: 0,
      retry_count: 0,
      convergence_rounds: 0,
      mttr: 0.0,
      completion_rate: 0.0,
      failure_rate: 0.0,
    },
  };
}

export function refreshWorkflowObservability(
  current: Record<string, unknown> | undefined,
  steps: Array<{ status: string }>,
  canonicalizeStatus: (status: string) => string,
  observabilityModes: readonly string[],
): Record<string, unknown> {
  const next = { ...(current ?? createWorkflowObservabilityBaseline(observabilityModes)) };
  const completedSteps = steps.filter((step) => canonicalizeStatus(step.status) === 'done').length;
  const failedSteps = steps.filter((step) => canonicalizeStatus(step.status) === 'failed').length;
  const totalSteps = steps.length || 1;
  const completionRate = Math.round((completedSteps / totalSteps) * 10000) / 100;
  const failureRate = Math.round((failedSteps / totalSteps) * 10000) / 100;

  next['aggregate'] = {
    completed_steps: completedSteps,
    failed_steps: failedSteps,
    retry_count: Math.max(0, failedSteps - 1),
    convergence_rounds: completedSteps + Math.max(0, failedSteps - 1),
    mttr: 0.0,
    completion_rate: completionRate,
    failure_rate: failureRate,
  };
  next['mode'] = observabilityModes[0];
  return next;
}

export function createWorkflowBudgetGuardrailBaseline(
  tokenBudget: number,
  timeBudgetMinutes: number,
): Record<string, unknown> {
  return {
    token_budget: tokenBudget,
    time_budget_minutes: timeBudgetMinutes,
    token_used: 0,
    elapsed_minutes: 0.0,
    threshold_triggered: false,
    degraded: false,
    degrade_mode: '',
    reason: 'within budget',
  };
}

export function refreshWorkflowBudgetGuardrail(
  current: Record<string, unknown> | undefined,
  steps: Array<{ description?: string }>,
  task: string,
  createdAt: string,
  tokenBudget: number,
  timeBudgetMinutes: number,
  ecoModeLabel: string,
): { budgetGuardrail: Record<string, unknown>; overBudget: boolean } {
  const next = { ...(current ?? createWorkflowBudgetGuardrailBaseline(tokenBudget, timeBudgetMinutes)) };
  const tokenUsed = steps.reduce((sum, step) => sum + (step.description?.length ?? 0), 0) + (task?.length ?? 0);
  const elapsedMinutes = Math.round(Math.max((Date.now() - new Date(createdAt).getTime()) / 60000, 0) * 100) / 100;
  const resolvedTokenBudget = Number(next['token_budget'] ?? tokenBudget);
  const resolvedTimeBudget = Number(next['time_budget_minutes'] ?? timeBudgetMinutes);
  const overBudget = tokenUsed >= resolvedTokenBudget || elapsedMinutes >= resolvedTimeBudget;

  next['token_used'] = tokenUsed;
  next['elapsed_minutes'] = elapsedMinutes;
  next['threshold_triggered'] = overBudget;
  next['degraded'] = overBudget;
  next['degrade_mode'] = overBudget ? ecoModeLabel : '';
  next['reason'] = overBudget ? 'budget threshold breached' : 'within budget';

  return { budgetGuardrail: next, overBudget };
}

export function resolveWorkflowExecutionMode(
  budgetGuardrail: Record<string, unknown>,
  observabilityMode: string,
  ecoModeLabel: string,
): string {
  if (budgetGuardrail['degraded']) return ecoModeLabel;
  return observabilityMode;
}
