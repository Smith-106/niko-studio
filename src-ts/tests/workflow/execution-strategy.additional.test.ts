import { describe, expect, it, vi } from 'vitest';

import {
  DefaultWorkflowExecutionStrategy,
  type WorkflowExecutionContext,
  type WorkflowExecutionPlanLike,
  type WorkflowStepLike,
} from '../../workflow/strategies/execution-strategy.js';
import type {
  WorkflowExecutionResponseContext,
  WorkflowPlanRuntimeState,
  WorkflowRiskGateResult,
} from '../../workflow/engine/engine-contracts.js';

interface TestStep extends WorkflowStepLike {
  output?: unknown;
}

interface TestPlan extends WorkflowExecutionPlanLike {
  steps: TestStep[];
}

const allowedGate: WorkflowRiskGateResult = {
  decision: 'allow',
  reason: 'safe',
  risk: 'low',
  blocking: false,
  destructive: false,
  confirm_required: false,
  confirmed: true,
};

function makeStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    id: 'step-1',
    name: 'Draft',
    status: 'planned',
    dependencies: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<TestPlan> = {}): TestPlan {
  return {
    id: 'plan-1',
    level: 'L3',
    status: 'ready',
    runner_state: 'running',
    recommendations: [],
    recommendations_frozen: false,
    template_meta: {},
    gate_decision: '',
    plan_hash: 'hash-1',
    steps: [makeStep()],
    ...overrides,
  };
}

function makeResponseContext(
  runtime?: WorkflowPlanRuntimeState,
): WorkflowExecutionResponseContext {
  return {
    executionMode: runtime?.executionMode ?? 'standard',
    observabilityMetrics: runtime?.observability.aggregate ?? { completion_rate: 0 },
    budgetGuardrail: runtime?.budgetGuardrail ?? { token_budget: 1000 },
    remainingSteps: 1,
    stateResumeMetadata: {
      current_phase: 'planned',
      state_trace_id: 'trace-1',
      can_resume_from_checkpoint: false,
      observability: runtime?.observability ?? { aggregate: { completion_rate: 0 } },
      budget_guardrail: runtime?.budgetGuardrail ?? { token_budget: 1000 },
      handoff_package: {},
      session_status: 'active',
      workspace_authority: {
        session_id: 'session-1',
        workspace_id: 'workspace-1',
        project_id: 'project-1',
      },
    },
  };
}

function makeStrategy(
  plan: TestPlan,
  overrides: Record<string, unknown> = {},
): DefaultWorkflowExecutionStrategy<TestPlan, TestStep> {
  const options = {
    resolveManagedPlan: vi.fn().mockReturnValue({ context: { plan } }),
    setRunnerState: vi.fn((targetPlan: TestPlan, targetState: string) => {
      targetPlan.runner_state = targetState;
      return { status: targetState };
    }),
    canonicalizeRecommendations: vi.fn((items?: unknown[]) => items as Record<string, unknown>[] ?? []),
    computePlanHash: vi.fn(() => 'hash-computed'),
    freezeRecommendations: vi.fn((targetPlan: TestPlan) => {
      targetPlan.recommendations_frozen = true;
    }),
    refreshPlanRuntime: vi.fn(() => ({
      observability: { aggregate: { completion_rate: 25 } },
      budgetGuardrail: { token_budget: 1000 },
      executionMode: 'standard',
    })),
    canonicalStepStatus: vi.fn((status: string) => status),
    persistPlanState: vi.fn(),
    executionResponseContext: vi.fn((_plan: TestPlan, runtime?: WorkflowPlanRuntimeState) =>
      makeResponseContext(runtime),
    ),
    levelFromLabel: vi.fn(() => 3),
    evaluateRiskGate: vi.fn(() => allowedGate),
    withContract: vi.fn((payload: Record<string, unknown>) => ({
      ...payload,
      contract: 'wrapped',
    })),
    transitionStepState: vi.fn((targetPlan: TestPlan, step: TestStep, targetStatus: string) => {
      step.status = targetStatus;
      targetPlan.status = 'running';
    }),
    executeStep: vi.fn().mockResolvedValue({ ok: true }),
    completeExecutionStep: vi.fn((_plan: TestPlan, step: TestStep, gate: WorkflowRiskGateResult, result: unknown) => ({
      status: 'completed',
      step_id: step.id,
      gate,
      result,
    })),
    failExecutionStep: vi.fn((_plan: TestPlan, step: TestStep, error: unknown, runtime: WorkflowPlanRuntimeState) => ({
      error: String(error),
      step_id: step.id,
      runtime,
    })),
    ...overrides,
  };

  return new DefaultWorkflowExecutionStrategy<TestPlan, TestStep>(options);
}

describe('DefaultWorkflowExecutionStrategy additional coverage', () => {
  it('returns operation errors for blocked runner states and invalid step requests', () => {
    const stopped = makeStrategy(makePlan({ runner_state: 'stopped' }));

    expect(stopped.prepareExecution({ planId: 'plan-1' }).response).toEqual({
      error: 'Loop runner is stopped',
    });

    const missingStep = makeStrategy(makePlan());
    expect(missingStep.prepareExecution({
      planId: 'plan-1',
      stepId: 'missing',
    }).response).toEqual({
      error: "Step 'missing' not found",
    });
  });

  it('blocks execution when dependencies are not complete', () => {
    const plan = makePlan({
      steps: [
        makeStep({ id: 'dep-1', status: 'planned' }),
        makeStep({ id: 'step-2', dependencies: ['dep-1'] }),
      ],
    });
    const strategy = makeStrategy(plan);

    expect(strategy.prepareExecution({
      planId: 'plan-1',
      stepId: 'step-2',
    }).response).toEqual({
      error: "Dependency 'dep-1' not completed",
    });
  });

  it('marks created plans running and returns executable context when gate allows execution', () => {
    const plan = makePlan({ status: 'created' });
    const strategy = makeStrategy(plan);

    const prepared = strategy.prepareExecution({ planId: 'plan-1' });

    expect(prepared.response).toBeUndefined();
    expect(prepared.context?.step.id).toBe('step-1');
    expect(prepared.context?.preflightExecutionMode).toBe('standard');
    expect(plan.status).toBe('running');
    expect(plan.gate_decision).toBe('allow');
  });

  it('delegates thrown execution errors to failExecutionStep with preflight runtime', async () => {
    const plan = makePlan();
    const step = plan.steps[0]!;
    const strategy = makeStrategy(plan, {
      executeStep: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const context: WorkflowExecutionContext<TestPlan, TestStep> = {
      plan,
      step,
      gate: allowedGate,
      preflightObservability: { aggregate: { completion_rate: 10 } },
      preflightBudgetGuardrail: { token_budget: 500 },
      preflightExecutionMode: 'guarded',
    };

    await expect(strategy.runExecution(context)).resolves.toMatchObject({
      error: 'Error: boom',
      step_id: 'step-1',
      runtime: {
        observability: { aggregate: { completion_rate: 10 } },
        budgetGuardrail: { token_budget: 500 },
        executionMode: 'guarded',
      },
    });
  });
});
