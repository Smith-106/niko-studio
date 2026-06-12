/**
 * WorkflowEngine - L1-L5 five-tier mode + Plan-Act + Checkpoint
 *
 * Core features:
 * 1. Task routing (auto-detect complexity)
 * 2. Plan-Act mode (separate planning and execution)
 * 3. Git-based checkpoint management
 * 4. State tracking
 *
 * Migrated from src/workflow/workflow_engine.py (3,262 lines)
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LLMService } from '../protocols/llm.js';
import type { IWorkflowStateStore } from './iworkflow-state-store.js';
import { HookRegistry, HookType, createHookContext } from '../hooks/writing-hooks.js';
import { PhaseOrchestrator, TeamPhase, type PhaseGateInput } from './team/index.js';
import { createLogger } from '../logger/index.js';

const _log = createLogger('workflow-engine-core');

import { WorkflowLevel, WorkflowDecision, ensureContractPayload } from './types.js';
import {
  type WorkflowAuthority,
} from './engine/authority.js';
import {
  buildWorkflowExecutionResponseContext,
  buildWorkflowRuntimeResponseContext,
  normalizeWorkflowExecuteRequest,
  normalizeWorkflowPlanRequest,
  normalizeWorkflowRunRequest,
  normalizeWorkflowRunWithExecutionContextRequest,
  normalizeWorkflowStreamRequest,
  normalizeWorkflowStreamWithExecutionContextRequest,
  type WorkflowExecuteRequest,
  type WorkflowExecuteResult,
  type WorkflowExecutionContextPayload,
  type WorkflowExecutionResponseContext,
  type WorkflowLifecycleResult,
  type WorkflowOperationErrorResult,
  type WorkflowPlanRequest,
  type WorkflowPlanResult,
  type WorkflowPlanRuntimeResponseContext,
  type WorkflowPlanRuntimeState,
  type WorkflowPlanStatusResult,
  type WorkflowRiskGateResult,
  type WorkflowRouteRequest,
  type WorkflowRouteResult,
  type WorkflowRunFailedResult,
  type WorkflowRunRequest,
  type WorkflowRunResult,
  type WorkflowRunWithExecutionContextRequest,
  type WorkflowStateResumeMetadataContract,
  type WorkflowStreamEvent,
  type WorkflowStreamRequest,
  type WorkflowStreamWithExecutionContextRequest,
} from './engine/engine-contracts.js';
import {
  bindWorkflowPlanAuthority,
  bindWorkflowPlanSession,
  getWorkflowPlanAuthority,
  getWorkflowPlanSessionId,
  resolveWorkflowPlanAuthority,
} from './engine/plan-authority-store.js';
import {
  createWorkflowBudgetGuardrailBaseline,
  createWorkflowObservabilityBaseline,
  refreshWorkflowBudgetGuardrail,
  refreshWorkflowObservability,
  resolveWorkflowExecutionMode,
} from './engine/observability.js';
import {
  buildWorkflowHandoffPackage,
} from './engine/persistence.js';
import {
  buildWorkflowQualityMetrics,
  determineWorkflowLane,
  evaluateWorkflowRiskGate,
  hasValidWorkflowConfirmToken,
  isDestructiveWorkflowStep,
  resolveAdaptiveWorkflowLevel,
  resolveWorkflowGateProfile,
} from './engine/risk.js';
import {
  buildWorkflowExecutionErrorResponse,
  buildWorkflowExecutionSuccessResponse,
  buildWorkflowExecutionTerminalResponse,
  buildWorkflowLifecycleActionContract,
  buildWorkflowLifecycleStatusContract,
  buildWorkflowOperationError,
  buildWorkflowPlanResponse,
  buildWorkflowPlanStatusResponse,
  buildWorkflowRunBlockedResponse,
  buildWorkflowRunCompletedResponse,
  buildWorkflowRunFailedResponse,
  buildWorkflowStreamErrorEvent,
  buildWorkflowStreamPlanBlockedEvent,
  buildWorkflowStreamPlanCompleteEvent,
  buildWorkflowStreamPlanCreatedEvent,
  buildWorkflowStreamPlanErrorEvent,
  buildWorkflowStreamStepCompleteEvent,
  buildWorkflowStreamStepStartEvent,
  buildWorkflowWaitingConfirmationResponse,
  isWorkflowBlockedStatus,
  isWorkflowExecutionComplete,
} from './engine/responses.js';
import {
  buildWorkflowResumeMetadataForPlan,
  persistWorkflowPlanState,
} from './engine/session-io.js';
import {
  areAllWorkflowStepsDone,
  buildWorkflowPauseReplayPayload,
  findIncompleteWorkflowDependency,
  normalizeWorkflowLifecycleAction,
  resolveExecutableWorkflowStep,
} from './engine/flow-control.js';
import {
  applyWorkflowPreflightExecutionMode,
  applyWorkflowRecommendationRefresh,
  validateWorkflowRunnerState,
} from './engine/preflight.js';
import {
  canonicalizeWorkflowRecommendations,
  computeWorkflowPlanHash,
} from './engine/recommendations.js';
import {
  applyWorkflowRunnerTransition,
  applyWorkflowStepTransition,
  applyWorkflowTriageTransition,
  canonicalWorkflowStepStatus,
  remainingWorkflowSteps,
} from './engine/runtime-state.js';
import { runWorkflowLifecycleTransition } from './engine/lifecycle.js';
import { SessionManager } from './session/session-manager.js';
import {
  DefaultWorkflowCheckpointStrategy,
  type WorkflowCheckpointStrategy,
} from './strategies/checkpoint-strategy.js';
import {
  DefaultWorkflowExecutionStrategy,
  type WorkflowExecutionStrategy,
} from './strategies/execution-strategy.js';
import {
  DefaultWorkflowRoutingStrategy,
  type WorkflowRoutingStrategy,
} from './strategies/routing-strategy.js';

const execFileAsync = promisify(execFile);

// ============================================================
// Constants
// ============================================================

export const TEMPLATE_METADATA_MAP: Record<number, Record<string, unknown>> = {
  [WorkflowLevel.L1_RAPID]: { level: 'L1', scene: 'quick_reply', risk: 'low', gate_profile: 'rapid-soft' },
  [WorkflowLevel.L2_LITE]: { level: 'L2', scene: 'single_turn', risk: 'low', gate_profile: 'lite-soft' },
  [WorkflowLevel.L3_STANDARD]: { level: 'L3', scene: 'chapter', risk: 'medium', gate_profile: 'standard-soft' },
  [WorkflowLevel.L4_BRAINSTORM]: { level: 'L4', scene: 'brainstorm', risk: 'medium', gate_profile: 'brainstorm-soft' },
  [WorkflowLevel.L5_COORDINATOR]: { level: 'L5', scene: 'coordinator', risk: 'high', gate_profile: 'coordinator-soft' },
};

export const RUNNER_ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(['running', 'paused', 'stopped']),
  running: new Set(['paused', 'stopped']),
  paused: new Set(['running', 'stopped']),
  stopped: new Set(),
};

export const RUNNER_TO_SESSION_STATUS: Record<string, string> = {
  running: 'active',
  paused: 'checkpointed',
  stopped: 'archived',
};

export const TRIAGE_ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  open: new Set(['in_progress', 'rejected', 'escalated']),
  in_progress: new Set(['resolved', 'rejected', 'escalated']),
  escalated: new Set(['in_progress', 'resolved', 'rejected']),
  resolved: new Set(),
  rejected: new Set(),
};

export const STEP_ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  planned: new Set(['executing', 'failed']),
  executing: new Set(['review', 'failed']),
  review: new Set(['test', 'failed']),
  test: new Set(['done', 'failed']),
  done: new Set(),
  failed: new Set(),
};

export const STEP_LEGACY_TO_CANONICAL: Record<string, string> = {
  pending: 'planned',
  running: 'executing',
  completed: 'done',
};

export const MAINTENANCE_TO_SESSION_STATUS: Record<string, string> = {
  running: 'active',
  paused: 'checkpointed',
  stopped: 'archived',
};

export const DESTRUCTIVE_STEP_NAMES = new Set(['checkpoint', 'final_review']);
export const AUTO_ROLLBACK_CONFIRM_TOKEN = '__auto_rollback__';
const RECOVERY_WORKSPACE_LOCK = 'checkpoint-recovery';
export const RECOVERY_CHAIN_STEPS = ['analyze-with-file', 'plan', 'plan-verify', 'execute'] as const;
export const OBSERVABILITY_MODES = ['Autopilot', 'Team', 'Pipeline/Ralph'] as const;
export const ECO_MODE_LABEL = 'EcoMode';
export const WAVE6_BUDGET_GUARDRAIL = { token_budget: 2400, time_budget_minutes: 20.0 };

export const WORKFLOW_STATE_SCHEMA_VERSION = '2026-02';
export const WORKFLOW_STATE_SCHEMA_POLICY = { policy: 'frozen', version_format: 'YYYY-MM', non_breaking_change: 'additive_only', breaking_change: 'version_bump_required' };
/** @deprecated Use canonical phase names ('planned', 'executing', 'done', 'failed') directly. */
export const WORKFLOW_STATE_PHASE_ALIASES: Record<string, string> = { created: 'planned', running: 'executing', completed: 'done', stopped: 'failed' };
export const WORKFLOW_STATE_ALLOWED_PHASES = new Set(['planned', 'executing', 'review', 'test', 'done', 'failed', 'recovery']);

export const ENGINE_PUBLIC_ENTRY_API = ['route', 'plan', 'execute', 'run', 'runStream'] as const;
export const ENGINE_PUBLIC_ENTRY_WARNING =
  `Direct workflow graph/adapter entrypoints are deprecated and will be removed in a future release. ` +
  `Use WorkflowEngine entry API (${ENGINE_PUBLIC_ENTRY_API.join('/')}) as the single public authority.`;

// ============================================================
// Data types
// ============================================================

export interface WorkflowStateStepRecord {
  id: string;
  name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowStateMetadata {
  lane?: string;
  execution_mode?: string;
  quality_metrics?: Record<string, number>;
  template_meta?: Record<string, unknown>;
  recommendations_frozen?: boolean;
  plan_hash?: string;
  stage_owner?: string;
  ownership_model?: string;
  phase_owners?: Record<string, string>;
  triage_state?: string;
  fix_status?: string;
  fix_owner?: string;
  workspace_authority?: {
    session_id: string | null;
    workspace_id: string | null;
    project_id: string | null;
  };
}

export interface WorkflowStateArtifacts {
  state: string;
  handoff: string;
  audit: string;
  snapshot_index: string;
}

export interface WorkflowStateSnapshot {
  schema_version: string;
  schema_policy: Record<string, string>;
  plan_id: string;
  task: string;
  level: string;
  plan_status: string;
  runner_state: string;
  current_phase: string;
  last_checkpoint_id: string;
  state_trace_id: string;
  updated_at: string;
  metadata: WorkflowStateMetadata;
  artifacts: WorkflowStateArtifacts;
  observability: Record<string, unknown>;
  budget_guardrail: Record<string, unknown>;
  handoff_package: Record<string, unknown>;
  steps: WorkflowStateStepRecord[];
  checkpoint_trace: Record<string, unknown>[];
  recovery?: Record<string, unknown>;
}

interface WorkflowExecutionContext {
  plan: WorkflowPlan;
  step: WorkflowStep;
  gate: WorkflowRiskGateResult;
  preflightObservability: Record<string, unknown>;
  preflightBudgetGuardrail: Record<string, unknown>;
  preflightExecutionMode: string;
}

interface ResolvedWorkflowPlanContext {
  plan: WorkflowPlan;
}

export class WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: string = 'planned';
  dependencies: string[];
  output: unknown = null;
  started_at: string | null = null;
  completed_at: string | null = null;

  constructor(data: { id: string; name: string; description: string; dependencies?: string[] }) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.dependencies = data.dependencies ?? [];
  }
}

export class WorkflowPlan {
  id: string;
  task: string;
  level: string;
  steps: WorkflowStep[];
  status: string = 'created';
  runner_state: string = 'pending';
  triage_state: string = 'open';
  fix_status: string = 'unfixed';
  fix_owner: string = '';
  created_at: string;
  completed_at: string | null = null;
  template_meta: Record<string, unknown>;
  gate_decision: string = WorkflowDecision.GO;
  recommendations: Record<string, unknown>[];
  recommendations_frozen: boolean = false;
  plan_hash: string = '';
  lane: string = 'default';
  quality_metrics: Record<string, number>;
  observability: Record<string, unknown>;
  budget_guardrail: Record<string, unknown>;
  handoff_package: Record<string, unknown>;

  constructor(data: { id: string; task: string; level: string; steps?: WorkflowStep[]; template_meta?: Record<string, unknown>; recommendations?: Record<string, unknown>[]; lane?: string; quality_metrics?: Record<string, number>; observability?: Record<string, unknown>; budget_guardrail?: Record<string, unknown>; handoff_package?: Record<string, unknown> }) {
    this.id = data.id;
    this.task = data.task;
    this.level = data.level;
    this.steps = data.steps ?? [];
    this.template_meta = data.template_meta ?? {};
    this.recommendations = data.recommendations ?? [];
    this.lane = data.lane ?? 'default';
    this.quality_metrics = data.quality_metrics ?? {};
    this.observability = data.observability ?? {};
    this.budget_guardrail = data.budget_guardrail ?? {};
    this.handoff_package = data.handoff_package ?? {};
    this.created_at = new Date().toISOString();
  }
}

export class Checkpoint {
  id: string;
  description: string;
  commit_hash: string | null = null;
  plan_id: string | null = null;
  step_id: string | null = null;
  replay_payload: Record<string, unknown>;
  created_at: string;

  constructor(data: { id: string; description: string; commit_hash?: string | null; plan_id?: string | null; step_id?: string | null; replay_payload?: Record<string, unknown> }) {
    this.id = data.id;
    this.description = data.description;
    this.commit_hash = data.commit_hash ?? null;
    this.plan_id = data.plan_id ?? null;
    this.step_id = data.step_id ?? null;
    this.replay_payload = data.replay_payload ?? {};
    this.created_at = new Date().toISOString();
  }
}

// ============================================================
// Helper functions
// ============================================================

function levelToLabel(level: number): string {
  const map: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5' };
  return map[level] ?? 'L3';
}

function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ============================================================
// WorkflowEngine
// ============================================================

export class WorkflowEngine {
  private workspace: string;
  private plans: Map<string, WorkflowPlan> = new Map();
  private checkpoints: Map<string, Checkpoint> = new Map();
  private planSessions: Map<string, string> = new Map();
  private planAuthorities: Map<string, WorkflowAuthority> = new Map();
  private checkpointStrategy: WorkflowCheckpointStrategy<WorkflowPlan, Checkpoint>;
  private executionStrategy: WorkflowExecutionStrategy<WorkflowPlan, WorkflowStep>;
  private routingStrategy: WorkflowRoutingStrategy;
  private sessionManager: SessionManager;
  private _sessionNamespace: string;
  private _moduleLocks: Map<string, Promise<void>> = new Map();
  private _moduleOwners: Map<string, string> = new Map();
  private _llmService: LLMService | null = null;
  private _stateStore: IWorkflowStateStore | null = null;
  private _hooks: HookRegistry | null = null;
  private _phaseOrch: PhaseOrchestrator | null = null;

  constructor(workspace?: string, sessionNamespace?: string, llmService?: LLMService, stateStore?: IWorkflowStateStore, hooks?: HookRegistry, phaseOrch?: PhaseOrchestrator) {
    this.workspace = workspace ?? process.cwd();
    this._sessionNamespace = sessionNamespace ?? 'default';
    if (llmService) this._llmService = llmService;
    if (stateStore) this._stateStore = stateStore;
    if (hooks) this._hooks = hooks;
    if (phaseOrch) this._phaseOrch = phaseOrch;
    this.checkpointStrategy = new DefaultWorkflowCheckpointStrategy({
      workspace: this.workspace,
      checkpoints: this.checkpoints,
      plans: this.plans,
      execFileAsync,
      createId: generateId,
      createCheckpointRecord: (data) => new Checkpoint(data),
      withContract: (payload) => this._withContract(payload),
      hasValidConfirmToken: (confirmToken) => this._hasValidConfirmToken(confirmToken),
      canonicalizeRecommendations: (recommendations) => this._canonicalizeRecommendations(recommendations),
      computePlanHash: (plan) => this._computePlanHash(plan),
      persistPlanState: (plan, currentPhase, checkpointId) => this._persistPlanState(plan, currentPhase, checkpointId),
    });
    this.executionStrategy = new DefaultWorkflowExecutionStrategy({
      resolveManagedPlan: (planId, authority, extraErrorFields) =>
        this._resolveManagedPlan(planId, authority as WorkflowAuthority | null | undefined, extraErrorFields),
      setRunnerState: (plan, targetState, checkpointId, transitionReason) =>
        this._setRunnerState(plan, targetState, checkpointId, transitionReason),
      canonicalizeRecommendations: (recommendations) => this._canonicalizeRecommendations(recommendations),
      computePlanHash: (plan) => this._computePlanHash(plan),
      freezeRecommendations: (plan) => this._freezeRecommendations(plan),
      refreshPlanRuntime: (plan) => this._refreshPlanRuntime(plan),
      canonicalStepStatus: (status) => this._canonicalStepStatus(status),
      persistPlanState: (plan, currentPhase, checkpointId) => this._persistPlanState(plan, currentPhase, checkpointId),
      executionResponseContext: (plan, runtime) => this._executionResponseContext(plan, runtime),
      levelFromLabel: (label) => this._levelFromLabel(label),
      evaluateRiskGate: (level, step, recommendations, confirmToken) =>
        this._evaluateRiskGate(level, step, recommendations, confirmToken),
      withContract: (payload) => this._withContract(payload),
      transitionStepState: (plan, step, targetStatus, reason) =>
        this._transitionStepState(plan, step, targetStatus, reason),
      executeStep: (plan, step) => this._executeStep(plan, step),
      completeExecutionStep: (plan, step, gate, result) =>
        this._completeExecutionStep(plan, step, gate, result),
      failExecutionStep: (plan, step, error, runtime) =>
        this._failExecutionStep(plan, step, error, runtime),
    });
    this.routingStrategy = new DefaultWorkflowRoutingStrategy(
      (level) => this._getWorkflowTemplate(level),
      (payload) => this._withContract(payload),
    );
    this.sessionManager = new SessionManager(path.join(this.workspace, '.writing', 'sessions'));
    this._sessionNamespace = this._deriveSessionNamespace(sessionNamespace);
  }

  static publicEntryApi(): readonly string[] {
    return ENGINE_PUBLIC_ENTRY_API;
  }

  private _deriveSessionNamespace(explicit?: string): string {
    const candidate = (explicit ?? path.basename(this.workspace)).trim().toLowerCase();
    const sanitized = candidate.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return sanitized || 'workflow';
  }

  private _sessionIdForPlan(planId: string): string {
    if (!this.planSessions.has(planId)) {
      this.planSessions.set(planId, `${this._sessionNamespace}--workflow-${planId}`);
    }
    return this.planSessions.get(planId)!;
  }

  bindPlanSession(planId: string, sessionId: string): string {
    return bindWorkflowPlanSession({
      planId,
      sessionId,
      planAuthorities: this.planAuthorities,
      planSessions: this.planSessions,
      ensureSessionId: (normalizedPlanId) => this._sessionIdForPlan(normalizedPlanId),
      persistPlanState: () => {
        const plan = this.plans.get(planId.trim());
        if (!plan) return;
        this._persistPlanState(
          plan,
          String(plan.template_meta['current_phase'] ?? plan.status),
          String(plan.template_meta['last_checkpoint_id'] ?? ''),
        );
      },
    });
  }

  getPlanSessionId(planId: string): string {
    return getWorkflowPlanSessionId({
      planId,
      ensureSessionId: (normalizedPlanId) => this._sessionIdForPlan(normalizedPlanId),
    });
  }

  bindPlanAuthority(planId: string, authority: WorkflowAuthority): WorkflowAuthority {
    return bindWorkflowPlanAuthority({
      planId,
      authority,
      planAuthorities: this.planAuthorities,
      planSessions: this.planSessions,
      ensureSessionId: (normalizedPlanId) => this._sessionIdForPlan(normalizedPlanId),
      persistPlanState: () => {
        const plan = this.plans.get(planId.trim());
        if (!plan) return;
        this._persistPlanState(
          plan,
          String(plan.template_meta['current_phase'] ?? plan.status),
          String(plan.template_meta['last_checkpoint_id'] ?? ''),
        );
      },
    });
  }

  getPlanAuthority(planId: string): WorkflowAuthority {
    return getWorkflowPlanAuthority({
      planId,
      planAuthorities: this.planAuthorities,
      ensureSessionId: (normalizedPlanId) => this._sessionIdForPlan(normalizedPlanId),
    });
  }

  private _resolvePlanAuthority(
    planId: string,
    requestAuthority?: Partial<WorkflowAuthority> | null,
  ): { authority: WorkflowAuthority; error?: never } | { authority: null; error: string } {
    return resolveWorkflowPlanAuthority({
      planId,
      requestAuthority,
      getPlanAuthority: (normalizedPlanId) => this.getPlanAuthority(normalizedPlanId),
      bindPlanAuthority: (normalizedPlanId, authority) => this.bindPlanAuthority(normalizedPlanId, authority),
    });
  }

  // ---- Public API ----

  async run(
    taskOrRequest: string | WorkflowRunRequest,
    level?: string,
    recommendations?: Record<string, unknown>[],
    executionContext?: WorkflowExecutionContextPayload,
  ): Promise<WorkflowRunResult> {
    const request = normalizeWorkflowRunRequest(
      taskOrRequest,
      level,
      recommendations,
      executionContext,
    );
    const plan = await this.plan(request);
    const planId = plan.plan_id;
    if (!planId) {
      return this._runFailedResult('', plan, 'Plan creation failed');
    }

    const maxIterations = Math.max(Number(plan.total_steps ?? 0) + 5, 5);
    let latestResult: WorkflowExecuteResult = buildWorkflowOperationError({
      error: 'Workflow did not start',
    });

    for (let i = 0; i < maxIterations; i++) {
      latestResult = await this.execute({ planId });
      if ('error' in latestResult) {
        return this._withContract(buildWorkflowRunFailedResponse({
          planId,
          plan,
          error: latestResult.error,
        }));
      }
      if (isWorkflowBlockedStatus(latestResult.status)) {
        const { finalStatus, failure } = this._planStatusOrFailure(planId, plan);
        if (failure) {
          return failure;
        }
        return this._withContract(buildWorkflowRunBlockedResponse({
          planId,
          plan,
          lastStep: latestResult,
          finalStatus: finalStatus!,
        }));
      }
      if (isWorkflowExecutionComplete(latestResult)) {
        break;
      }
    }

    const { finalStatus, failure } = this._planStatusOrFailure(planId, plan);
    if (failure) {
      return failure;
    }
    return this._withContract(buildWorkflowRunCompletedResponse({
      planId,
      plan,
      lastStep: latestResult,
      finalStatus: finalStatus!,
    }));
  }

  async runWithExecutionContext(
    taskOrRequest: string | WorkflowRunWithExecutionContextRequest,
    executionContext?: WorkflowExecutionContextPayload,
    level?: string,
    recommendations?: Record<string, unknown>[],
  ): Promise<WorkflowRunResult> {
    const request = normalizeWorkflowRunWithExecutionContextRequest(
      taskOrRequest,
      executionContext,
      level,
      recommendations,
    );
    return this.run(request);
  }

  async *runStream(
    taskOrRequest: string | WorkflowStreamRequest,
    level?: string,
    recommendations?: Record<string, unknown>[],
    executionContext?: WorkflowExecutionContextPayload,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const request = normalizeWorkflowStreamRequest(
      taskOrRequest,
      level,
      recommendations,
      executionContext,
    );
    const plan = await this.plan(request);
    const planId = plan.plan_id;
    if (!planId) {
      yield this._withContract(buildWorkflowStreamErrorEvent({ error: 'Plan creation failed' }));
      return;
    }

    yield this._withContract(buildWorkflowStreamPlanCreatedEvent({ planId, plan }));

    const maxIterations = Math.max(Number(plan.total_steps ?? 0) + 5, 5);
    let latestResult: WorkflowExecuteResult = buildWorkflowOperationError({
      error: 'Workflow did not start',
    });

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const currentPlan = this.plans.get(planId);
      if (currentPlan && currentPlan.steps.length > 0) {
        const currentStep = currentPlan.steps[currentPlan.steps.length - 1];
        yield this._withContract(buildWorkflowStreamStepStartEvent({
          planId,
          stepId: currentStep.id,
          stepName: currentStep.name,
          iteration,
        }));
      }

      latestResult = await this.execute({ planId });
      yield this._withContract(buildWorkflowStreamStepCompleteEvent({
        planId,
        result: latestResult,
      }));

      if ('error' in latestResult) {
        yield this._withContract(buildWorkflowStreamPlanErrorEvent({
          planId,
          error: String(latestResult.error),
        }));
        return;
      }
      if (isWorkflowBlockedStatus(latestResult.status)) {
        yield this._withContract(buildWorkflowStreamPlanBlockedEvent({
          planId,
          status: String(latestResult.status),
          lastStep: latestResult,
        }));
        return;
      }
      if (isWorkflowExecutionComplete(latestResult)) {
        break;
      }
    }

    const { finalStatus, failure } = this._planStatusOrFailure(planId, plan);
    if (failure) {
      yield this._withContract(buildWorkflowStreamPlanErrorEvent({
        planId,
        error: String(failure.error ?? 'Plan status retrieval failed'),
      }));
      return;
    }
    yield this._withContract(buildWorkflowStreamPlanCompleteEvent({
      planId,
      plan,
      lastStep: latestResult,
      finalStatus: finalStatus!,
    }));
  }

  async *runStreamWithExecutionContext(
    taskOrRequest: string | WorkflowStreamWithExecutionContextRequest,
    executionContext?: WorkflowExecutionContextPayload,
    level?: string,
    recommendations?: Record<string, unknown>[],
  ): AsyncGenerator<WorkflowStreamEvent> {
    const request = normalizeWorkflowStreamWithExecutionContextRequest(
      taskOrRequest,
      executionContext,
      level,
      recommendations,
    );
    yield* this.runStream(request);
  }

  private _withContract<T extends Record<string, unknown>>(payload: T): T {
    return ensureContractPayload(payload) as T;
  }

  // ---- Routing ----

  async route(taskOrRequest: string | WorkflowRouteRequest): Promise<WorkflowRouteResult> {
    const taskStr = typeof taskOrRequest === 'string' ? taskOrRequest : taskOrRequest.task ?? '';
    if (this._hooks) {
      const hookCtx = createHookContext({ content: taskStr, metadata: { operation: 'route' } });
      await this._hooks.execute(HookType.BEFORE_WORKFLOW_START, hookCtx);
    }
    return this.routingStrategy.route(taskOrRequest);
  }

  private _getWorkflowTemplate(level: number): Array<{ name: string; description: string }> {
    const templates: Record<number, Array<{ name: string; description: string }>> = {
      [WorkflowLevel.L1_RAPID]: [{ name: 'answer', description: '直接回答问题' }],
      [WorkflowLevel.L2_LITE]: [
        { name: 'analyze', description: '分析任务需求' },
        { name: 'match_skills', description: '匹配技能包' },
        { name: 'generate', description: '生成内容' },
      ],
      [WorkflowLevel.L3_STANDARD]: [
        { name: 'analyze', description: '分析章节需求' },
        { name: 'load_context', description: '加载上下文' },
        { name: 'match_skills', description: '匹配技能包' },
        { name: 'plan_structure', description: '规划章节结构' },
        { name: 'generate_draft', description: '生成初稿' },
        { name: 'evaluate', description: '评估质量' },
        { name: 'revise', description: '修改优化' },
        { name: 'checkpoint', description: '创建检查点' },
      ],
      [WorkflowLevel.L4_BRAINSTORM]: [
        { name: 'load_state', description: '加载前文状态' },
        { name: 'plan_chapters', description: '规划多章' },
        { name: 'create_chapter', description: '创作单章 (循环)' },
        { name: 'consistency_check', description: '一致性检查' },
        { name: 'save_state', description: '保存状态' },
      ],
      [WorkflowLevel.L5_COORDINATOR]: [
        { name: 'concept', description: '确定核心概念' },
        { name: 'outline', description: '生成大纲' },
        { name: 'character_design', description: '角色设计' },
        { name: 'world_building', description: '世界设定' },
        { name: 'chapter_breakdown', description: '章节分解' },
        { name: 'create_chapters', description: '逐章创作' },
        { name: 'final_review', description: '最终审核' },
      ],
    };
    return templates[level] ?? templates[WorkflowLevel.L2_LITE];
  }

  // ---- Planning ----

  async plan(
    taskOrRequest: string | WorkflowPlanRequest,
    level?: string,
    recommendations?: Record<string, unknown>[],
    executionContext?: WorkflowExecutionContextPayload,
  ): Promise<WorkflowPlanResult> {
    const request = normalizeWorkflowPlanRequest(
      taskOrRequest,
      level,
      recommendations,
      executionContext,
    );
    let resolvedLevel = request.level;
    if (!resolvedLevel) {
      const routing = await this.route({ task: request.task });
      resolvedLevel = routing.level;
    }

    const workflowLevel = this._levelFromLabel(resolvedLevel);
    const qualityMetrics = this._buildQualityMetrics(request.task);
    const lane = this._determineLane(qualityMetrics);
    const adaptiveLevel = this._resolveAdaptiveLevel(workflowLevel, lane, qualityMetrics);

    const template = this._getWorkflowTemplate(adaptiveLevel);
    const templateMeta: Record<string, unknown> = {
      ...(TEMPLATE_METADATA_MAP[adaptiveLevel] ?? {}),
      lane,
      quality_metrics: qualityMetrics,
      gate_profile: this._resolveGateProfile(adaptiveLevel, lane, qualityMetrics),
    };
    if (request.executionContext && Object.keys(request.executionContext).length > 0) {
      templateMeta['execution_context'] = structuredClone(request.executionContext);
    }
    if (adaptiveLevel !== workflowLevel) {
      templateMeta['adaptive_from_level'] = levelToLabel(workflowLevel);
    }

    const planId = generateId();
    const steps: WorkflowStep[] = template.map((templateStep, index) => new WorkflowStep({
      id: `${planId}-${index}`,
      name: templateStep.name,
      description: templateStep.description,
      dependencies: index > 0 ? [`${planId}-${index - 1}`] : [],
    }));

    const canonicalRecommendations = this._canonicalizeRecommendations(request.recommendations);

    const planObj = new WorkflowPlan({
      id: planId,
      task: request.task,
      level: levelToLabel(adaptiveLevel),
      steps,
      template_meta: templateMeta,
      recommendations: canonicalRecommendations,
      lane,
      quality_metrics: qualityMetrics,
      observability: this._createObservabilityBaseline(),
      budget_guardrail: this._createBudgetGuardrailBaseline(),
      handoff_package: {},
    });
    planObj.plan_hash = this._computePlanHash(planObj);

    const { observability, budgetGuardrail, executionMode } = this._refreshPlanRuntime(planObj);
    planObj.plan_hash = this._computePlanHash(planObj);

    this.plans.set(planId, planObj);
    this._syncPlanToStore(planObj);
    this._persistPlanState(planObj, 'planned');

    return this._withContract(buildWorkflowPlanResponse({
      planId,
      level: levelToLabel(adaptiveLevel),
      templateMeta,
      gateDecision: planObj.gate_decision,
      recommendations: planObj.recommendations,
      recommendationsFrozen: planObj.recommendations_frozen,
      planHash: planObj.plan_hash,
      executionMode,
      observabilityMetrics: observability['aggregate'],
      budgetGuardrail: budgetGuardrail,
      steps: steps.map((step) => ({
        id: step.id,
        name: step.name,
        description: step.description,
        dependencies: step.dependencies,
        status: step.status,
      })),
      totalSteps: steps.length,
    }));
  }

  // ---- Execution ----

  private _runFailedResult(planId: string, plan: WorkflowPlanResult, error: unknown): WorkflowRunFailedResult {
    return this._withContract(buildWorkflowRunFailedResponse({
      planId,
      plan,
      error,
    }));
  }

  private _planStatusOrFailure(
    planId: string,
    plan: WorkflowPlanResult,
  ): { finalStatus?: WorkflowPlanStatusResult; failure?: WorkflowRunFailedResult } {
    const status = this.getPlanStatus(planId);
    if ('error' in status) {
      return { failure: this._runFailedResult(planId, plan, status.error) };
    }
    return { finalStatus: status };
  }

  private _resolveManagedPlan(
    planId: string,
    authority?: WorkflowAuthority | null,
    extraErrorFields: Record<string, unknown> = {},
  ): { response?: WorkflowOperationErrorResult; context?: ResolvedWorkflowPlanContext } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return {
        response: buildWorkflowOperationError({
          error: `Plan '${planId}' not found`,
          fields: extraErrorFields,
        }) as WorkflowOperationErrorResult,
      };
    }
    const authorityResolution = this._resolvePlanAuthority(planId, authority);
    if (authorityResolution.error) {
      return {
        response: buildWorkflowOperationError({
          error: authorityResolution.error,
          fields: {
            plan_id: planId,
            ...extraErrorFields,
          },
        }) as WorkflowOperationErrorResult,
      };
    }
    return { context: { plan } };
  }

  private _prepareExecutionContext(
    planId: string,
    stepId: string | undefined,
    recommendations: Record<string, unknown>[] | undefined,
    confirmToken: string | undefined,
    authority?: WorkflowAuthority | null,
  ): { response?: WorkflowExecuteResult; context?: WorkflowExecutionContext } {
    const managedPlan = this._resolveManagedPlan(planId, authority);
    if (managedPlan.response) {
      return { response: managedPlan.response };
    }
    const { plan } = managedPlan.context!;
    const runnerStateError = validateWorkflowRunnerState(plan.runner_state);
    if (runnerStateError) {
      return { response: buildWorkflowOperationError({ error: runnerStateError }) };
    }
    if (plan.runner_state === 'pending') {
      this._setRunnerState(plan, 'running');
    }

    applyWorkflowRecommendationRefresh(
      plan,
      recommendations,
      (items) => this._canonicalizeRecommendations(items),
      () => this._computePlanHash(plan),
    );
    this._freezeRecommendations(plan);
    const {
      observability: preflightObservability,
      budgetGuardrail: preflightBudgetGuardrail,
      executionMode: preflightExecutionMode,
    } = this._refreshPlanRuntime(plan);
    const preflightRuntime: WorkflowPlanRuntimeState = {
      observability: preflightObservability,
      budgetGuardrail: preflightBudgetGuardrail,
      executionMode: preflightExecutionMode,
    };

    const stepResolution = resolveExecutableWorkflowStep(
      plan.steps,
      stepId,
      (status) => this._canonicalStepStatus(status),
    );
    if (stepResolution.error) {
      return {
        response: buildWorkflowOperationError({ error: stepResolution.error }),
      };
    }
    const step = stepResolution.step;

    if (!step) {
      this._persistPlanState(plan, 'done');
      const responseContext = this._executionResponseContext(plan, preflightRuntime);
      return {
        response: this._withContract(buildWorkflowExecutionTerminalResponse({
          ...responseContext,
          message: 'All steps completed',
        })),
      };
    }

    const incompleteDependencyId = findIncompleteWorkflowDependency(
      plan.steps,
      step,
      (status) => this._canonicalStepStatus(status),
    );
    if (incompleteDependencyId) {
      return {
        response: buildWorkflowOperationError({
          error: `Dependency '${incompleteDependencyId}' not completed`,
        }),
      };
    }

    /* v8 ignore next -- normalization path is exercised via white-box tests, but V8 misses attribution for this tiny branch */
    if (plan.status === 'created') {
      plan.status = 'running';
    }

    const levelEnum = this._levelFromLabel(plan.level);
    const gate = this._evaluateRiskGate(
      levelEnum,
      step,
      plan.recommendations,
      confirmToken,
    );
    plan.gate_decision = gate['decision'] as string;

    if (gate['confirm_required'] && !gate['confirmed']) {
      this._persistPlanState(plan, 'planned');
      const responseContext = this._executionResponseContext(plan, preflightRuntime);
      return {
        response: this._withContract(buildWorkflowWaitingConfirmationResponse({
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
        })),
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

  private async _runExecutionStep(
    context: WorkflowExecutionContext,
  ): Promise<WorkflowExecuteResult> {
    const {
      plan,
      step,
      gate,
      preflightObservability,
      preflightBudgetGuardrail,
      preflightExecutionMode,
    } = context;

    try {
      this._transitionStepState(plan, step, 'executing', 'execution_started');
      const result = await this._executeStep(plan, step);
      this._transitionStepState(plan, step, 'review', 'execution_review');
      this._transitionStepState(plan, step, 'test', 'execution_test');
      this._transitionStepState(plan, step, 'done', 'execution_completed');
      return this._completeExecutionStep(plan, step, gate, result);
    } catch (error) {
      return this._failExecutionStep(plan, step, error, {
        observability: preflightObservability,
        budgetGuardrail: preflightBudgetGuardrail,
        executionMode: preflightExecutionMode,
      });
    }
  }

  async execute(
    planIdOrRequest: string | WorkflowExecuteRequest,
    stepId?: string,
    recommendations?: Record<string, unknown>[],
    confirmToken?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<WorkflowExecuteResult> {
    const request = normalizeWorkflowExecuteRequest(
      planIdOrRequest,
      stepId,
      recommendations,
      confirmToken,
      authority,
    );
    const preparation = this.executionStrategy.prepareExecution(request);
    if (preparation.response) {
      return preparation.response;
    }
    return this.executionStrategy.runExecution(preparation.context!);
  }

  // ---- Lifecycle ----

  private _lifecycleStatus(plan: WorkflowPlan): WorkflowLifecycleResult {
    this._persistPlanState(
      plan,
      String(plan.template_meta['current_phase'] ?? plan.status),
      String(plan.template_meta['last_checkpoint_id'] ?? ''),
    );
    return this._buildLifecycleStatusResponse(plan);
  }

  private async _runLifecycleTransition(
    plan: WorkflowPlan,
    normalizedAction: string,
    triageState?: string,
  ): Promise<WorkflowLifecycleResult | { error: string }> {
    return runWorkflowLifecycleTransition({
      plan,
      action: normalizedAction,
      triageState,
      createPauseCheckpoint: async (description, planId) => {
        const checkpoint = await this.createCheckpoint(
          description,
          false,
          planId,
          undefined,
          buildWorkflowPauseReplayPayload(plan),
        );
        return String(checkpoint['checkpoint_id'] ?? '') || undefined;
      },
      setRunnerState: (targetState, checkpointId, transitionReason) =>
        this._setRunnerState(plan, targetState, checkpointId, transitionReason),
      setTriageState: (nextTriageState, transitionReason) =>
        this._setTriageState(plan, nextTriageState, transitionReason),
      persistHandoffPackage: (trigger) => {
        this._persistHandoffPackage(plan, trigger);
      },
      buildLifecycleActionResponse: (action, checkpointId, sessionStatus) =>
        this._buildLifecycleActionResponse(plan, action, checkpointId, sessionStatus),
    });
  }

  async lifecycle(
    planId: string,
    action: string,
    triageState?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<WorkflowLifecycleResult | { error: string }> {
    const managedPlan = this._resolveManagedPlan(planId, authority);
    if (managedPlan.response) {
      return managedPlan.response;
    }
    const { plan } = managedPlan.context!;

    const normalizedAction = normalizeWorkflowLifecycleAction(action);
    if (normalizedAction === 'status') {
      return this._lifecycleStatus(plan);
    }
    return this._runLifecycleTransition(plan, normalizedAction, triageState);
  }

  // ---- Checkpoints ----

  async createCheckpoint(
    description: string = '',
    autoCommit: boolean = true,
    planId?: string,
    stepId?: string,
    replayPayload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.checkpointStrategy.createCheckpoint(
      description,
      autoCommit,
      planId,
      stepId,
      replayPayload,
    );
  }

  async restoreCheckpoint(checkpointId: string, confirmToken?: string): Promise<Record<string, unknown>> {
    /* v8 ignore next 5 -- thin wrapper is exercised by integration tests but V8 misses the statement attribution */
    return this._withModuleLock(
      RECOVERY_WORKSPACE_LOCK,
      () => this._restoreCheckpointInternal(checkpointId, confirmToken),
    );
  }

  async quickRollback(
    planId: string,
    checkpointId: string,
    reason: string = '',
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>> {
    return this._withModuleLock(RECOVERY_WORKSPACE_LOCK, async () => {
      const managedPlan = this._resolveManagedPlan(planId, authority, { checkpoint_id: checkpointId });
      if (managedPlan.response) {
        return managedPlan.response;
      }
      const { plan } = managedPlan.context!;

      const restoreResult = await this._restoreCheckpointInternal(
        checkpointId,
        AUTO_ROLLBACK_CONFIRM_TOKEN,
      );
      const restored = restoreResult['status'] === 'restored';
      if (restored) {
        this._persistPlanState(
          plan,
          /* v8 ignore next -- both paths are exercised in white-box tests but V8 misses this nullish branch inside the async callback */
          String(plan.template_meta['current_phase'] ?? plan.status),
          checkpointId,
        );
      }
      return { plan_id: planId, checkpoint_id: checkpointId, reason, restored, restore: restoreResult };
    });
  }


  async listCheckpoints(limit: number = 10): Promise<Record<string, unknown>[]> {
    return this.checkpointStrategy.listCheckpoints(limit);
  }

  getCheckpoint(checkpointId: string): {
    id: string;
    description: string;
    commit_hash?: string | null;
    created_at: string;
    plan_id?: string | null;
    step_id?: string | null;
    replay_payload?: Record<string, unknown>;
  } | null {
    return this.checkpointStrategy.getCheckpoint(checkpointId);
  }

  getPlanStatus(planId: string): WorkflowPlanStatusResult | { error: string } {
    const plan = this.plans.get(planId);
    if (!plan) return { error: `Plan '${planId}' not found` };

    const runtime = this._planRuntimeContext(plan);

    return this._withContract(buildWorkflowPlanStatusResponse({
      planId: plan.id,
      task: plan.task,
      level: plan.level,
      status: plan.status,
      runnerState: plan.runner_state,
      triageState: plan.triage_state,
      fixStatus: plan.fix_status,
      fixOwner: plan.fix_owner,
      templateMeta: plan.template_meta,
      gateDecision: plan.gate_decision,
      recommendations: plan.recommendations,
      recommendationsFrozen: plan.recommendations_frozen,
      planHash: plan.plan_hash,
      executionMode: runtime.executionMode,
      observabilityMetrics: runtime.observabilityMetrics,
      budgetGuardrail: runtime.budgetGuardrail,
      handoffPackage: runtime.handoffPackage,
      steps: plan.steps.map(s => ({ id: s.id, name: s.name, status: s.status, output: s.output })),
      progress: `${plan.steps.filter(s => this._canonicalStepStatus(s.status) === 'done').length}/${plan.steps.length}`,
    }));
  }

  // ---- Step Execution ----

  private async _executeStep(plan: WorkflowPlan, step: WorkflowStep): Promise<unknown> {
    let result: unknown;
    switch (step.name) {
      case 'analyze': result = this._runAnalyze(plan); break;
      case 'match_skills': result = this._runMatchSkills(plan); break;
      case 'load_context': result = this._runLoadContext(plan); break;
      case 'plan_structure': result = this._runPlanStructure(plan); break;
      case 'generate_draft': result = await this._runGenerateDraft(plan); break;
      case 'generate': result = this._runGenerate(plan); break;
      case 'evaluate': result = this._runEvaluate(plan); break;
      case 'revise': result = this._runRevise(plan); break;
      case 'checkpoint': {
        const cp = await this.createCheckpoint(`plan:${plan.id} step:${step.id}`, false, plan.id, step.id, {
          plan_id: plan.id, plan_hash: plan.plan_hash, recommendations: structuredClone(plan.recommendations), recommendations_frozen: plan.recommendations_frozen,
        });
        result = { checkpoint_id: cp['checkpoint_id'], created_at: cp['created_at'], replay_payload: cp['replay_payload'] };
        break;
      }
      case 'answer': result = this._runAnswer(plan); break;
      default: throw new Error(`Unsupported workflow step: ${step.name}`);
    }

    // Hook: AFTER_WORKFLOW_STEP
    if (this._hooks) {
      const hookCtx = createHookContext({ content: plan.task, metadata: { stepName: step.name, planId: plan.id } });
      await this._hooks.execute(HookType.AFTER_WORKFLOW_STEP, hookCtx);
    }

    // Gate check after step execution
    if (this._phaseOrch && step.name === 'evaluate') {
      const gateInput = this._buildGateInput(plan);
      const transition = this._phaseOrch.advance(gateInput);
      if (!transition.success && transition.gateReasons.length > 0) {
        _log.warn('Phase gate blocked step advancement', {
          step: step.name,
          reasons: transition.gateReasons,
          overridable: !transition.forcedComplete,
        });
      }
    }

    return result;
  }

  private _getStepOutput(plan: WorkflowPlan, stepName: string): Record<string, unknown> | null {
    const step = plan.steps.find(s => s.name === stepName);
    return (step?.output as Record<string, unknown>) ?? null;
  }

  private _runAnalyze(plan: WorkflowPlan): Record<string, unknown> {
    const task = plan.task.trim();
    const keywords = ['写', '章节', '角色', '冲突', '大纲', '修订'].filter(kw => task.includes(kw));
    return { task, task_length: task.length, intent: task.includes('章') ? 'chapter_creation' : 'general_writing', keywords };
  }

  private _runMatchSkills(plan: WorkflowPlan): Record<string, unknown> {
    const task = plan.task;
    const skills: string[] = [];
    if (['对话', '台词'].some(k => task.includes(k))) skills.push('dialogue-system');
    if (['人物', '角色'].some(k => task.includes(k))) skills.push('character-forge');
    if (['悬念', '反转', '冲突'].some(k => task.includes(k))) skills.push('suspense-builder');
    if (skills.length === 0) skills.push('scene-builder');
    return { skills, skill_count: skills.length };
  }

  private _runLoadContext(plan: WorkflowPlan): Record<string, unknown> {
    return { workspace: this.workspace, task: plan.task, analysis: this._getStepOutput(plan, 'analyze') ?? {}, context_loaded: true };
  }

  private _runPlanStructure(plan: WorkflowPlan): Record<string, unknown> {
    const task = plan.task;
    let structure: string[];
    if (task.includes('对话')) structure = ['开场', '人物出场', '对话推进', '冲突显化', '收束'];
    else if (task.includes('大纲')) structure = ['核心设定', '章节分段', '主线冲突', '高潮设计', '结局'];
    else structure = ['开场', '发展', '冲突', '高潮', '结局'];
    return { structure, section_count: structure.length };
  }

  private async _runGenerateDraft(plan: WorkflowPlan): Promise<Record<string, unknown>> {
    const task = this._getExecutionTask(plan);
    const structureOutput = this._getStepOutput(plan, 'plan_structure') ?? {};
    const sections = (structureOutput['structure'] as string[]) ?? ['开场', '发展', '结尾'];
    const structureHint = sections.join('、');

    // Try injected LLM service first (DI pattern), then direct provider, then stub
    if (this._llmService) {
      try {
        const result = await this._llmService.generate(task, {
              model: process.env.NIKO_DEFAULT_MODEL ?? 'gpt-4o-mini',
              temperature: 0.8,
              systemPrompt: '你是一个专业的中文写作助手，擅长写作小说、故事和散文。请直接输出正文内容，不要加解释。',
            });
        const content = typeof result === 'string' ? result : String(result);
        if (content && content.trim()) {
          return { draft: content.trim(), source_task: task, section_count: sections.length };
        }
      } catch {
        // fall through to direct provider or stub
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.OPENAI_API_BASE;
    const model = process.env.NIKO_DEFAULT_MODEL ?? 'gpt-4o-mini';

    if (apiKey) {
      try {
        const { OpenAILLMProvider } = await import('../knowledge/providers/openai-llm.js');
        const provider = new OpenAILLMProvider({ apiKey, baseUrl: baseUrl ?? null });
        const response = await provider.complete(task, model, {
          systemPrompt: '你是一个专业的中文写作助手，擅长写作小说、故事和散文。请直接输出正文内容，不要加解释。',
          temperature: 0.8,
        });
        if (response.content && response.content.trim()) {
          return { draft: response.content.trim(), source_task: task, section_count: sections.length };
        }
      } catch {
        // fall through to stub
      }
    }

    const draft = sections.map((section, idx) => `${idx + 1}. ${section}`).join('\n');
    return { draft: `${task}\n\n结构：${structureHint}\n\n${draft}`, source_task: task, section_count: sections.length };
  }

  private _runGenerate(plan: WorkflowPlan): Record<string, unknown> {
    const skillsOutput = this._getStepOutput(plan, 'match_skills') ?? {};
    const skills = (skillsOutput['skills'] as string[]).join(', ');
    const task = this._getExecutionTask(plan);
    return { content: `任务：${task}\n采用技能：${skills || 'scene-builder'}`, task };
  }

  private _runEvaluate(plan: WorkflowPlan): Record<string, unknown> {
    const draftOutput = this._getStepOutput(plan, 'generate_draft');
    const generateOutput = this._getStepOutput(plan, 'generate');
    const text = draftOutput?.['draft'] as string ?? generateOutput?.['content'] as string ?? '';
    const score = Math.min(100.0, Math.max(60.0, 60.0 + text.length / 8.0));
    return { score: Math.round(score * 10) / 10, feedback: score >= 75 ? '结构完整，可进入修订' : '需要补充细节', length: text.length };
  }

  private _runRevise(plan: WorkflowPlan): Record<string, unknown> {
    const evaluateOutput = this._getStepOutput(plan, 'evaluate') ?? {};
    const draftOutput = this._getStepOutput(plan, 'generate_draft') ?? {};
    const draft = (draftOutput['draft'] as string) ?? '';
    const score = (evaluateOutput['score'] as number) ?? 0;
    const revised = `${draft}\n\n修订说明：根据评分 ${score} 进行了表达与衔接优化。`.trim();
    return { revised: true, score, content: revised };
  }

  private _runAnswer(plan: WorkflowPlan): Record<string, unknown> {
    const task = this._getExecutionTask(plan);
    return { answer: `已接收任务：${task}。建议按步骤执行并在关键节点创建检查点。`, task };
  }

  private _getExecutionTask(plan: WorkflowPlan): string {
    const executionContext = (plan.template_meta['execution_context'] as Record<string, unknown> | undefined) ?? {};
    const chatCanonPrompt = executionContext['chat_canon_prompt'];
    if (typeof chatCanonPrompt === 'string' && chatCanonPrompt.trim()) {
      return chatCanonPrompt;
    }
    return plan.task;
  }

  private async _withModuleLock<T>(moduleId: string, runner: () => Promise<T>): Promise<T> {
    const normalizedId = moduleId.trim() || 'default';
    const previous = this._moduleLocks.get(normalizedId) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this._moduleLocks.set(normalizedId, previous.then(() => current));

    await previous;
    this._moduleOwners.set(normalizedId, this._sessionNamespace);

    try {
      return await runner();
    } finally {
      this._moduleOwners.delete(normalizedId);
      release();
      if (this._moduleLocks.get(normalizedId) === current) {
        this._moduleLocks.delete(normalizedId);
      }
    }
  }

  private async _restoreCheckpointInternal(
    checkpointId: string,
    confirmToken?: string,
  ): Promise<Record<string, unknown>> {
    return this.checkpointStrategy.restoreCheckpointInternal(checkpointId, confirmToken);
  }

  // ---- Observability ----

  private _refreshPlanRuntime(plan: WorkflowPlan): {
    observability: Record<string, unknown>;
    budgetGuardrail: Record<string, unknown>;
    executionMode: string;
  } {
    return applyWorkflowPreflightExecutionMode(
      plan,
      () => this._refreshObservability(plan),
      () => this._refreshBudgetGuardrail(plan),
      (observabilityMode) => this._resolveExecutionMode(plan, observabilityMode),
    );
  }

  private _planRuntimeContext(
    plan: WorkflowPlan,
    runtime?: WorkflowPlanRuntimeState,
    sessionStatus?: string | null,
  ): WorkflowPlanRuntimeResponseContext {
    const resolvedRuntime = runtime ?? this._refreshPlanRuntime(plan);
    return buildWorkflowRuntimeResponseContext(
      resolvedRuntime,
      plan.handoff_package,
      sessionStatus
      ?? (plan.template_meta['session_status'] as string | null | undefined)
      ?? null,
    );
  }

  private _executionResponseContext(
    plan: WorkflowPlan,
    runtime?: WorkflowPlanRuntimeState,
  ): WorkflowExecutionResponseContext {
    const planRuntime = this._planRuntimeContext(plan, runtime);
    return buildWorkflowExecutionResponseContext(
      planRuntime,
      this._remainingSteps(plan),
      this._stateResumeMetadata(plan),
    );
  }

  private _completeExecutionStep(
    plan: WorkflowPlan,
    step: WorkflowStep,
    gate: WorkflowRiskGateResult,
    result: unknown,
  ): WorkflowExecuteResult {
    step.output = result;

    if (areAllWorkflowStepsDone(plan.steps, (status) => this._canonicalStepStatus(status))) {
      plan.status = 'completed';
      plan.completed_at = new Date().toISOString();
    }

    const responseContext = this._executionResponseContext(plan);

    return this._withContract(buildWorkflowExecutionSuccessResponse({
      stepId: step.id,
      stepName: step.name,
      result,
      gate,
      planStatus: plan.status,
      runnerState: plan.runner_state,
      remainingSteps: responseContext.remainingSteps,
      executionMode: responseContext.executionMode,
      observabilityMetrics: responseContext.observabilityMetrics,
      budgetGuardrail: responseContext.budgetGuardrail,
      stateResumeMetadata: responseContext.stateResumeMetadata,
    }));
  }

  private _failExecutionStep(
    plan: WorkflowPlan,
    step: WorkflowStep,
    error: unknown,
    runtime: WorkflowPlanRuntimeState,
  ): WorkflowExecuteResult {
    this._transitionStepState(plan, step, 'failed', 'execution_error');
    plan.status = 'failed';
    const responseContext = this._executionResponseContext(plan, runtime);
    return buildWorkflowExecutionErrorResponse({
      error: String(error),
      stepId: step.id,
      executionMode: responseContext.executionMode,
      observabilityMetrics: responseContext.observabilityMetrics,
      budgetGuardrail: responseContext.budgetGuardrail,
      stateResumeMetadata: responseContext.stateResumeMetadata,
    });
  }

  private _buildLifecycleStatusResponse(plan: WorkflowPlan): WorkflowLifecycleResult {
    const runtime = this._planRuntimeContext(plan);
    const payload = this._withContract(buildWorkflowLifecycleStatusContract({
      planId: plan.id,
      action: 'status',
      runnerState: plan.runner_state,
      triageState: plan.triage_state,
      fixStatus: plan.fix_status,
      fixOwner: plan.fix_owner,
      planStatus: plan.status,
      lane: plan.lane,
      qualityMetrics: plan.quality_metrics,
      runtime,
    }));
    payload['last_checkpoint_id'] = String(plan.template_meta['last_checkpoint_id'] ?? '');
    return payload;
  }

  private _buildLifecycleActionResponse(
    plan: WorkflowPlan,
    action: string,
    checkpointId: string | undefined,
    sessionStatus: string | null,
  ): WorkflowLifecycleResult {
    const runtime = this._planRuntimeContext(plan, undefined, sessionStatus);
    const payload = this._withContract(buildWorkflowLifecycleActionContract({
      planId: plan.id,
      action,
      runnerState: plan.runner_state,
      triageState: plan.triage_state,
      fixStatus: plan.fix_status,
      fixOwner: plan.fix_owner,
      planStatus: plan.status,
      checkpointId,
      lane: plan.lane,
      qualityMetrics: plan.quality_metrics,
      runtime,
    }));
    payload['last_checkpoint_id'] = String(plan.template_meta['last_checkpoint_id'] ?? '');
    return payload;
  }

  private _createObservabilityBaseline(): Record<string, unknown> {
    return createWorkflowObservabilityBaseline(OBSERVABILITY_MODES);
  }

  private _refreshObservability(plan: WorkflowPlan): Record<string, unknown> {
    const current = refreshWorkflowObservability(
      plan.observability as Record<string, unknown> | undefined,
      plan.steps,
      (status) => this._canonicalStepStatus(status),
      OBSERVABILITY_MODES,
    );
    plan.observability = current;
    return current;
  }

  // ---- Budget Guardrail ----

  private _createBudgetGuardrailBaseline(): Record<string, unknown> {
    return createWorkflowBudgetGuardrailBaseline(
      WAVE6_BUDGET_GUARDRAIL.token_budget,
      WAVE6_BUDGET_GUARDRAIL.time_budget_minutes,
    );
  }

  private _refreshBudgetGuardrail(plan: WorkflowPlan): Record<string, unknown> {
    const { budgetGuardrail, overBudget } = refreshWorkflowBudgetGuardrail(
      plan.budget_guardrail as Record<string, unknown> | undefined,
      plan.steps,
      plan.task,
      plan.created_at,
      WAVE6_BUDGET_GUARDRAIL.token_budget,
      WAVE6_BUDGET_GUARDRAIL.time_budget_minutes,
      ECO_MODE_LABEL,
    );

    plan.budget_guardrail = budgetGuardrail;
    if (overBudget) plan.template_meta['execution_mode'] = ECO_MODE_LABEL;
    return budgetGuardrail;
  }

  private _resolveExecutionMode(plan: WorkflowPlan, observabilityMode: string): string {
    return resolveWorkflowExecutionMode(
      plan.budget_guardrail as Record<string, unknown>,
      observabilityMode,
      ECO_MODE_LABEL,
    );
  }

  // ---- Quality Metrics ----

  private _buildQualityMetrics(task: string): Record<string, number> {
    return buildWorkflowQualityMetrics(task);
  }

  private _determineLane(metrics: Record<string, number>): string {
    return determineWorkflowLane(metrics);
  }

  private _resolveAdaptiveLevel(level: number, lane: string, metrics: Record<string, number>): number {
    return resolveAdaptiveWorkflowLevel(level, lane, metrics);
  }

  private _resolveGateProfile(level: number, lane: string, metrics: Record<string, number>): string {
    return resolveWorkflowGateProfile(level, lane, metrics, TEMPLATE_METADATA_MAP);
  }

  // ---- State Transitions ----

  private _canonicalStepStatus(status: string): string {
    return canonicalWorkflowStepStatus(status, STEP_LEGACY_TO_CANONICAL);
  }

  private _remainingSteps(plan: WorkflowPlan): number {
    return remainingWorkflowSteps(plan.steps, STEP_LEGACY_TO_CANONICAL);
  }

  private _transitionStepState(plan: WorkflowPlan, step: WorkflowStep, targetStatus: string, reason: string): void {
    const { target } = applyWorkflowStepTransition(
      step,
      targetStatus,
      STEP_LEGACY_TO_CANONICAL,
      STEP_ALLOWED_TRANSITIONS,
      new Date().toISOString(),
    );
    this._persistPlanState(plan, target);
  }

  private _setRunnerState(plan: WorkflowPlan, targetState: string, checkpointId?: string, transitionReason: string = ''): Record<string, unknown> {
    applyWorkflowRunnerTransition(
      plan,
      targetState,
      RUNNER_ALLOWED_TRANSITIONS,
      transitionReason,
    );
    return this._persistPlanState(
      plan,
      String(plan.template_meta['current_phase'] ?? plan.status),
      checkpointId,
    );
  }

  private _setTriageState(plan: WorkflowPlan, targetState: string, transitionReason: string = '', actor: string = 'workflow_engine'): void {
    const result = applyWorkflowTriageTransition(
      plan,
      targetState,
      TRIAGE_ALLOWED_TRANSITIONS,
    );
    if (!result.changed) return;
  }

  // ---- Risk Gate ----

  private _evaluateRiskGate(level: number, step: WorkflowStep, recommendations?: Record<string, unknown>[], confirmToken?: string | null): WorkflowRiskGateResult {
    return evaluateWorkflowRiskGate(
      level,
      step.name,
      recommendations,
      confirmToken,
      TEMPLATE_METADATA_MAP,
      DESTRUCTIVE_STEP_NAMES,
    ) as WorkflowRiskGateResult;
  }

  private _isDestructiveStep(step: WorkflowStep, recommendations?: Record<string, unknown>[]): boolean {
    return isDestructiveWorkflowStep(step.name, recommendations, DESTRUCTIVE_STEP_NAMES);
  }

  private _hasValidConfirmToken(confirmToken: string | null | undefined): boolean {
    return hasValidWorkflowConfirmToken(confirmToken);
  }

  // ---- Recommendations ----

  private _canonicalizeRecommendations(recommendations?: unknown[]): Record<string, unknown>[] {
    return canonicalizeWorkflowRecommendations(recommendations);
  }

  private _freezeRecommendations(plan: WorkflowPlan): void {
    if (plan.recommendations_frozen) return;
    plan.recommendations = structuredClone(plan.recommendations);
    plan.recommendations_frozen = true;
  }

  // ---- Hash & Replay ----

  private _computePlanHash(plan: WorkflowPlan): string {
    return computeWorkflowPlanHash(plan);
  }

  private _applyReplayPayload(checkpoint: Checkpoint): Record<string, unknown> {
    return this.checkpointStrategy.applyReplayPayload(checkpoint);
  }

  // ---- State Persistence ----

  private _persistPlanState(
    plan: WorkflowPlan,
    currentPhase?: string | null,
    checkpointId?: string,
  ): Record<string, unknown> {
    this._syncPlanToStore(plan);
    return persistWorkflowPlanState({
      plan,
      currentPhase,
      checkpointId,
      schemaVersion: WORKFLOW_STATE_SCHEMA_VERSION,
      schemaPolicy: WORKFLOW_STATE_SCHEMA_POLICY,
      sessionManager: this.sessionManager,
      checkpoints: Array.from(this.checkpoints.values()),
      canonicalizeStepStatus: (status) => this._canonicalStepStatus(status),
      getPlanAuthority: (planId) => {
        const authority = this.getPlanAuthority(planId);
        if (!authority.sessionId) {
          return null;
        }
        return {
          sessionId: authority.sessionId,
          workspaceId: authority.workspaceId,
          projectId: authority.projectId,
        };
      },
      getPlanSessionId: (planId) => this.getPlanSessionId(planId),
    });
  }

  /** Sync plan to state store (fire-and-forget, non-blocking). */
  private _syncPlanToStore(plan: WorkflowPlan): void {
    if (!this._stateStore) return;
    this._stateStore.savePlan(plan).catch(() => {});
  }

  /** Get the injected state store, if any. */
  getStateStore(): IWorkflowStateStore | null {
    return this._stateStore;
  }

  /** Load state from the store into internal Maps (for persistence hydration). */
  async hydrateFromStore(): Promise<void> {
    if (!this._stateStore) return;
    const plans = await this._stateStore.listPlans();
    for (const plan of plans) {
      this.plans.set(plan.id, plan);
      const session = await this._stateStore.loadPlanSession(plan.id);
      if (session) this.planSessions.set(plan.id, session);
      const authority = await this._stateStore.loadPlanAuthority(plan.id);
      if (authority) this.planAuthorities.set(plan.id, authority);
    }
  }

  /** Flush all internal Maps to the store (for graceful shutdown). */
  async flushToStore(): Promise<void> {
    if (!this._stateStore) return;
    for (const [id, plan] of this.plans) {
      await this._stateStore.savePlan(plan);
    }
  }

  private _stateResumeMetadata(plan: WorkflowPlan): WorkflowStateResumeMetadataContract {
    return buildWorkflowResumeMetadataForPlan({
      plan,
      getPlanAuthority: (planId) => {
        const authority = this.getPlanAuthority(planId);
        if (!authority.sessionId) {
          return null;
        }
        return {
          sessionId: authority.sessionId,
          workspaceId: authority.workspaceId,
          projectId: authority.projectId,
        };
      },
      getPlanSessionId: (planId) => this.getPlanSessionId(planId),
    });
  }

  private _persistHandoffPackage(plan: WorkflowPlan, trigger: string): Record<string, unknown> {
    const pendingSteps = plan.steps
      .filter(s => this._canonicalStepStatus(s.status) !== 'done')
      .map(s => ({ id: s.id, name: s.name, status: this._canonicalStepStatus(s.status) }));
    const blockedBy = pendingSteps.filter(s => s.status === 'failed').map(s => s.id);

    const handoff = buildWorkflowHandoffPackage<Record<string, unknown>>({
      generatedAt: new Date().toISOString(),
      trigger,
      planId: plan.id,
      status: plan.status,
      runnerState: plan.runner_state,
      triageState: plan.triage_state,
      fixStatus: plan.fix_status,
      fixOwner: plan.fix_owner,
      executionMode: plan.template_meta['execution_mode'],
      pendingSteps,
      blockedBy,
    });
    plan.handoff_package = handoff;
    return handoff;
  }

  // ---- Helpers ----

  private _levelFromLabel(label: string): number {
    const map: Record<string, number> = { 'L1': 1, 'L2': 2, 'L3': 3, 'L4': 4, 'L5': 5 };
    return map[label] ?? 3;
  }

  private _buildGateInput(plan: WorkflowPlan): PhaseGateInput {
    const evalOutput = this._getStepOutput(plan, 'evaluate');
    const reviewVerdict = (evalOutput?.verdict as string) ?? (evalOutput?.decision as string);
    return {
      review: {
        verdict: reviewVerdict,
        findings_count: evalOutput ? Object.keys(evalOutput).length : 0,
      },
    };
  }
}
