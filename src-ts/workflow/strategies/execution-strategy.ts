import type { WorkflowAuthority } from '../engine/authority.js';
import {
  applyWorkflowRecommendationRefresh,
  validateWorkflowRunnerState,
} from '../engine/preflight.js';
import {
  buildWorkflowExecutionTerminalResponse,
  buildWorkflowOperationError,
  buildWorkflowWaitingConfirmationResponse,
} from '../engine/responses.js';
import {
  findIncompleteWorkflowDependency,
  resolveExecutableWorkflowStep,
} from '../engine/flow-control.js';
import type {
  WorkflowExecuteRequest,
  WorkflowExecuteResult,
  WorkflowExecutionResponseContext,
  WorkflowPlanRuntimeState,
  WorkflowRiskGateResult,
} from '../engine/engine-contracts.js';

export interface WorkflowStepLike {
  id: string;
  name: string;
  status: string;
  dependencies: string[];
}

export interface WorkflowExecutionPlanLike {
  id: string;
  level: string;
  status: string;
  runner_state: string;
  recommendations: Record<string, unknown>[];
  recommendations_frozen: boolean;
  template_meta: Record<string, unknown>;
  gate_decision: string;
  plan_hash: string;
  steps: WorkflowStepLike[];
}

export interface WorkflowExecutionContext<TPlan extends WorkflowExecutionPlanLike, TStep extends WorkflowStepLike> {
  plan: TPlan;
  step: TStep;
  gate: WorkflowRiskGateResult;
  preflightObservability: Record<string, unknown>;
  preflightBudgetGuardrail: Record<string, unknown>;
  preflightExecutionMode: string;
}

export interface WorkflowPreparedExecution<TPlan extends WorkflowExecutionPlanLike, TStep extends WorkflowStepLike> {
  response?: WorkflowExecuteResult;
  context?: WorkflowExecutionContext<TPlan, TStep>;
}

export interface WorkflowExecutionStrategy<
  TPlan extends WorkflowExecutionPlanLike,
  TStep extends WorkflowStepLike,
> {
  prepareExecution(request: WorkflowExecuteRequest): WorkflowPreparedExecution<TPlan, TStep>;
  runExecution(context: WorkflowExecutionContext<TPlan, TStep>): Promise<WorkflowExecuteResult>;
}

type WorkflowContractWrapper = <T extends Record<string, unknown>>(payload: T) => T;

interface DefaultWorkflowExecutionStrategyOptions<
  TPlan extends WorkflowExecutionPlanLike,
  TStep extends WorkflowStepLike,
> {
  resolveManagedPlan: (
    planId: string,
    authority?: Partial<WorkflowAuthority> | null,
    extraErrorFields?: Record<string, unknown>,
  ) => { response?: WorkflowExecuteResult; context?: { plan: TPlan } };
  setRunnerState: (plan: TPlan, targetState: string, checkpointId?: string, transitionReason?: string) => Record<string, unknown>;
  canonicalizeRecommendations: (recommendations?: unknown[]) => Record<string, unknown>[];
  computePlanHash: (plan: TPlan) => string;
  freezeRecommendations: (plan: TPlan) => void;
  refreshPlanRuntime: (plan: TPlan) => {
    observability: Record<string, unknown>;
    budgetGuardrail: Record<string, unknown>;
    executionMode: string;
  };
  canonicalStepStatus: (status: string) => string;
  persistPlanState: (plan: TPlan, currentPhase?: string | null, checkpointId?: string) => Record<string, unknown>;
  executionResponseContext: (
    plan: TPlan,
    runtime?: WorkflowPlanRuntimeState,
  ) => WorkflowExecutionResponseContext;
  levelFromLabel: (label: string) => number;
  evaluateRiskGate: (
    level: number,
    step: TStep,
    recommendations?: Record<string, unknown>[],
    confirmToken?: string | null,
  ) => WorkflowRiskGateResult;
  withContract: WorkflowContractWrapper;
  transitionStepState: (plan: TPlan, step: TStep, targetStatus: string, reason: string) => void;
  executeStep: (plan: TPlan, step: TStep) => Promise<unknown>;
  completeExecutionStep: (
    plan: TPlan,
    step: TStep,
    gate: WorkflowRiskGateResult,
    result: unknown,
  ) => WorkflowExecuteResult;
  failExecutionStep: (
    plan: TPlan,
    step: TStep,
    error: unknown,
    runtime: WorkflowPlanRuntimeState,
  ) => WorkflowExecuteResult;
}

export class DefaultWorkflowExecutionStrategy<
  TPlan extends WorkflowExecutionPlanLike,
  TStep extends WorkflowStepLike,
> implements WorkflowExecutionStrategy<TPlan, TStep> {
  constructor(private readonly options: DefaultWorkflowExecutionStrategyOptions<TPlan, TStep>) {}

  prepareExecution(request: WorkflowExecuteRequest): WorkflowPreparedExecution<TPlan, TStep> {
    const managedPlan = this.options.resolveManagedPlan(request.planId, request.authority);
    if (managedPlan.response) {
      return { response: managedPlan.response };
    }
    const { plan } = managedPlan.context!;
    const runnerStateError = validateWorkflowRunnerState(plan.runner_state);
    if (runnerStateError) {
      return { response: buildWorkflowOperationError({ error: runnerStateError }) };
    }
    if (plan.runner_state === 'pending') {
      this.options.setRunnerState(plan, 'running');
    }

    applyWorkflowRecommendationRefresh(
      plan,
      request.recommendations,
      (items) => this.options.canonicalizeRecommendations(items),
      () => this.options.computePlanHash(plan),
    );
    this.options.freezeRecommendations(plan);

    const {
      observability: preflightObservability,
      budgetGuardrail: preflightBudgetGuardrail,
      executionMode: preflightExecutionMode,
    } = this.options.refreshPlanRuntime(plan);
    const preflightRuntime: WorkflowPlanRuntimeState = {
      observability: preflightObservability,
      budgetGuardrail: preflightBudgetGuardrail,
      executionMode: preflightExecutionMode,
    };

    const stepResolution = resolveExecutableWorkflowStep(
      plan.steps,
      request.stepId,
      (status) => this.options.canonicalStepStatus(status),
    );
    if (stepResolution.error) {
      return { response: buildWorkflowOperationError({ error: stepResolution.error }) };
    }
    const step = stepResolution.step as unknown as TStep | null;

    if (!step) {
      this.options.persistPlanState(plan, 'done');
      const responseContext = this.options.executionResponseContext(plan, preflightRuntime);
      return {
        response: this.options.withContract(
          buildWorkflowExecutionTerminalResponse({
            ...responseContext,
            message: 'All steps completed',
          }),
        ) as WorkflowExecuteResult,
      };
    }

    const incompleteDependencyId = findIncompleteWorkflowDependency(
      plan.steps,
      step,
      (status) => this.options.canonicalStepStatus(status),
    );
    if (incompleteDependencyId) {
      return {
        response: buildWorkflowOperationError({
          error: `Dependency '${incompleteDependencyId}' not completed`,
        }),
      };
    }

    if (plan.status === 'created') {
      plan.status = 'running';
    }

    const levelEnum = this.options.levelFromLabel(plan.level);
    const gate = this.options.evaluateRiskGate(
      levelEnum,
      step,
      plan.recommendations,
      request.confirmToken,
    );
    plan.gate_decision = gate['decision'] as string;

    if (gate['confirm_required'] && !gate['confirmed']) {
      this.options.persistPlanState(plan, 'planned');
      const responseContext = this.options.executionResponseContext(plan, preflightRuntime);
      return {
        response: this.options.withContract(
          buildWorkflowWaitingConfirmationResponse({
            stepId: step.id,
            stepName: step.name,
            gate,
            planStatus: plan.status,
            runnerState: plan.runner_state,
            remainingSteps: responseContext.remainingSteps,
            executionMode: responseContext.executionMode,
            observabilityMetrics: responseContext.observabilityMetrics,
            budgetGuardrail: responseContext.budgetGuardrail,
            stateResumeMetadata: responseContext.stateResumeMetadata,
          }),
        ) as WorkflowExecuteResult,
      };
    }

    return {
      context: {
        plan,
        step,
        gate,
        preflightObservability,
        preflightBudgetGuardrail,
        preflightExecutionMode,
      },
    };
  }

  async runExecution(context: WorkflowExecutionContext<TPlan, TStep>): Promise<WorkflowExecuteResult> {
    const {
      plan,
      step,
      gate,
      preflightObservability,
      preflightBudgetGuardrail,
      preflightExecutionMode,
    } = context;

    try {
      this.options.transitionStepState(plan, step, 'executing', 'execution_started');
      const result = await this.options.executeStep(plan, step);
      this.options.transitionStepState(plan, step, 'review', 'execution_review');
      this.options.transitionStepState(plan, step, 'test', 'execution_test');
      this.options.transitionStepState(plan, step, 'done', 'execution_completed');
      return this.options.completeExecutionStep(plan, step, gate, result);
    } catch (error) {
      return this.options.failExecutionStep(plan, step, error, {
        observability: preflightObservability,
        budgetGuardrail: preflightBudgetGuardrail,
        executionMode: preflightExecutionMode,
      });
    }
  }
}
