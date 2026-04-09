export interface WorkflowPlanPreflightState {
  runner_state: string;
  recommendations: Record<string, unknown>[];
  recommendations_frozen: boolean;
  plan_hash: string;
  template_meta: Record<string, unknown>;
}

export function validateWorkflowRunnerState(
  runnerState: string,
): string | null {
  if (runnerState === 'stopped') return 'Loop runner is stopped';
  if (runnerState === 'paused') return 'Loop runner is paused';
  return null;
}

export function applyWorkflowRecommendationRefresh(
  plan: WorkflowPlanPreflightState,
  recommendations: unknown[] | undefined,
  canonicalizeRecommendations: (recommendations?: unknown[]) => Record<string, unknown>[],
  computePlanHash: () => string,
): void {
  if (recommendations) {
    plan.recommendations = canonicalizeRecommendations(recommendations);
    plan.recommendations_frozen = false;
    plan.plan_hash = computePlanHash();
  }

  if (!plan.plan_hash) {
    plan.plan_hash = computePlanHash();
  }
}

export function applyWorkflowPreflightExecutionMode(
  plan: WorkflowPlanPreflightState,
  refreshObservability: () => Record<string, unknown>,
  refreshBudgetGuardrail: () => Record<string, unknown>,
  resolveExecutionMode: (observabilityMode: string) => string,
): {
  observability: Record<string, unknown>;
  budgetGuardrail: Record<string, unknown>;
  executionMode: string;
} {
  const observability = refreshObservability();
  const budgetGuardrail = refreshBudgetGuardrail();
  const executionMode = resolveExecutionMode(String(observability['mode'] ?? ''));
  plan.template_meta['execution_mode'] = executionMode;
  return {
    observability,
    budgetGuardrail,
    executionMode,
  };
}
