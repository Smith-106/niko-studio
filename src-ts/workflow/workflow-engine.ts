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

import { WorkflowLevel, WorkflowDecision, ensureContractPayload } from './types.js';
import type { WorkflowLevelValue } from './types.js';
import {
  type WorkflowAuthority,
} from './engine/authority.js';
import {
  buildWorkflowExecutionResponseContext,
  buildWorkflowLifecycleActionContract,
  buildWorkflowLifecycleStatusContract,
  buildWorkflowPersistedAuditContract,
  buildWorkflowPersistedStateSnapshot,
  buildWorkflowRuntimeResponseContext,
  buildWorkflowStateResumeContract,
  normalizeWorkflowExecuteRequest,
  normalizeWorkflowPlanRequest,
  normalizeWorkflowRouteRequest,
  normalizeWorkflowRunRequest,
  normalizeWorkflowRunStreamRequest,
  normalizeWorkflowRunStreamWithExecutionContextRequest,
  normalizeWorkflowRunWithExecutionContextRequest,
  type WorkflowCheckpointResult,
  type WorkflowCheckpointSummary,
  type WorkflowErrorResult,
  type WorkflowExecuteRequest,
  type WorkflowExecuteResult,
  type WorkflowExecutionContextPayload,
  type WorkflowExecutionResponseContext,
  type WorkflowLifecycleActionResult,
  type WorkflowLifecycleResult,
  type WorkflowPlanResult,
  type WorkflowPlanRuntimeResponseContext,
  type WorkflowPlanRuntimeState,
  type WorkflowPlanStatusResult,
  type WorkflowPlanRequest,
  type WorkflowQuickRollbackResult,
  type WorkflowRecommendationInput,
  type WorkflowRestoreCheckpointResult,
  type WorkflowRouteRequest,
  type WorkflowRouteResult,
  type WorkflowRunRequest,
  type WorkflowRunResult,
  type WorkflowRunStreamRequest,
  type WorkflowRunStreamWithExecutionContextRequest,
  type WorkflowRunWithExecutionContextRequest,
  type WorkflowStateResumeMetadata,
  type WorkflowStreamEvent,
  type WorkflowTemplateStep,
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
  resolveWorkflowPersistencePhase,
} from './engine/persistence.js';
import {
  buildWorkflowQualityMetrics,
  determineWorkflowLane,
  evaluateWorkflowRiskGate,
  hasValidWorkflowConfirmToken,
  isDestructiveWorkflowStep,
  resolveAdaptiveWorkflowLevel,
  resolveWorkflowGateProfile,
  restoreWorkflowCheckpoint,
  type WorkflowCheckpointLike,
} from './engine/risk.js';
import {
  buildWorkflowPlanResponse,
  buildWorkflowPlanStatusResponse,
  buildWorkflowRouteResponse,
} from './engine/responses.js';
import {
  buildWorkflowAllStepsCompletedResult,
  buildWorkflowCompletedStepResult,
  buildWorkflowExecutionFailureResult,
  buildWorkflowRunBlockedResult,
  buildWorkflowRunCompletedResult,
  buildWorkflowRunFailedResult,
  buildWorkflowStreamPlanBlockedEvent,
  buildWorkflowStreamPlanCompleteEvent,
  buildWorkflowStreamPlanCreatedEvent,
  buildWorkflowStreamPlanCreationErrorEvent,
  buildWorkflowStreamPlanErrorEvent,
  buildWorkflowStreamStepCompleteEvent,
  buildWorkflowStreamStepStartEvent,
  buildWorkflowWaitingConfirmationResult,
  syncWorkflowSessionContext,
  writeWorkflowStateArtifacts,
} from './engine/session-io.js';
import {
  areAllWorkflowStepsDone,
  buildWorkflowPauseReplayPayload,
  executeWorkflowLifecycleTransition,
  findIncompleteWorkflowDependency,
  normalizeWorkflowLifecycleAction,
  resolveExecutableWorkflowStep,
  resolveWorkflowLifecycleSessionStatus,
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
  executeWorkflowStepWithTransitions,
  remainingWorkflowSteps,
} from './engine/runtime-state.js';
import { SessionManager } from './session/session-manager.js';

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

export const DESTRUCTIVE_STEP_NAMES = new Set(['revise', 'checkpoint', 'final_review']);
export const AUTO_ROLLBACK_CONFIRM_TOKEN = '__auto_rollback__';
const RECOVERY_WORKSPACE_LOCK = 'checkpoint-recovery';
export const RECOVERY_CHAIN_STEPS = ['analyze-with-file', 'plan', 'plan-verify', 'execute'] as const;
export const OBSERVABILITY_MODES = ['Autopilot', 'Team', 'Pipeline/Ralph'] as const;
export const ECO_MODE_LABEL = 'EcoMode';
export const WAVE6_BUDGET_GUARDRAIL = { token_budget: 2400, time_budget_minutes: 20.0 };

export const WORKFLOW_STATE_SCHEMA_VERSION = '2026-02';
export const WORKFLOW_STATE_SCHEMA_POLICY = { policy: 'frozen', version_format: 'YYYY-MM', non_breaking_change: 'additive_only', breaking_change: 'version_bump_required' };
export const WORKFLOW_STATE_PHASE_ALIASES: Record<string, string> = { created: 'planned', running: 'executing', completed: 'done', stopped: 'failed' };
export const WORKFLOW_STATE_ALLOWED_PHASES = new Set(['planned', 'executing', 'review', 'test', 'done', 'failed', 'recovery']);

export const ENGINE_PUBLIC_ENTRY_API = ['route', 'plan', 'execute', 'run', 'run_stream'] as const;
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
  gate: Record<string, unknown>;
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
// LevelRouter (lightweight feature-based routing)
// ============================================================

class LevelRouter {
  private getLevelIndicators(): Record<number, string[]> {
    return {
      [WorkflowLevel.L1_RAPID]: ['回答', '解释', '什么是', '告诉我', '简单'],
      [WorkflowLevel.L2_LITE]: ['写一段', '描写', '生成段落', '扩写'],
      [WorkflowLevel.L3_STANDARD]: ['写一章', '创作章节', '完成场景', '第.*章'],
      [WorkflowLevel.L4_BRAINSTORM]: ['连续写', '多章', '接着写', '继续'],
      [WorkflowLevel.L5_COORDINATOR]: ['规划全书', '大纲', '整体设计', '完整故事'],
    };
  }

  private getRoutingFeatureModel(): Record<string, unknown> {
    return {
      weights: { keyword: 3, structure: 2, history: 2, long_text_escalation: 2 },
      thresholds: {
        min_structured_score: 1,
        long_text_escalation_min_length: 100,
        long_text_target_floor: 'L3',
        default_level: 'L2',
      },
      category_explanations: {
        keyword: '命中层级关键词',
        structure: '命中结构信号',
        history: '命中历史反馈信号',
        long_text_escalation: '长文本任务自动升级',
      },
      levels: {
        [WorkflowLevel.L1_RAPID]: {
          keyword: ['回答', '解释', '什么是', '告诉我', '简单'],
          structure: [/\?|？/, /如何/, /为什么/, /一句话/, /简述/, /速答/].map(r => r.source),
          history: [],
        },
        [WorkflowLevel.L2_LITE]: {
          keyword: ['写一段', '描写', '生成段落', '扩写'],
          structure: [/段落/, /片段/, /短文/, /示例/].map(r => r.source),
          history: [],
        },
        [WorkflowLevel.L3_STANDARD]: {
          keyword: ['写一章', '创作章节', '完成场景', '第.*章'],
          structure: [/章节/, /第\s*\d+\s*章/, /场景/].map(r => r.source),
          history: [/根据反馈/, /上次/, /继续修改/, /迭代/].map(r => r.source),
        },
        [WorkflowLevel.L4_BRAINSTORM]: {
          keyword: ['连续写', '多章', '接着写', '继续'],
          structure: [/同时/, /并且/, /先.*再/, /多线/].map(r => r.source),
          history: [/汇总反馈/, /多轮/, /讨论/].map(r => r.source),
        },
        [WorkflowLevel.L5_COORDINATOR]: {
          keyword: ['规划全书', '大纲', '整体设计', '完整故事'],
          structure: [/全书/, /世界观/, /角色设定/, /路线图/, /里程碑/].map(r => r.source),
          history: [/跨章节/, /长期/, /版本/].map(r => r.source),
        },
      },
    };
  }

  scoreRouteFeatures(task: string): Record<string, unknown> {
    const taskLower = (task ?? '').toLowerCase();
    const model = this.getRoutingFeatureModel();
    const weights = model.weights as Record<string, number>;
    const thresholds = model.thresholds as Record<string, unknown>;

    const structuredLevels = [
      WorkflowLevel.L1_RAPID,
      WorkflowLevel.L2_LITE,
      WorkflowLevel.L3_STANDARD,
      WorkflowLevel.L4_BRAINSTORM,
      WorkflowLevel.L5_COORDINATOR,
    ];

    const structuredScores: Record<number, number> = {};
    const legacyScores: Record<number, number> = {};
    for (const level of structuredLevels) {
      structuredScores[level] = 0;
      legacyScores[level] = 0;
    }
    const matchedFeatures: Record<string, unknown>[] = [];

    const levels = model.levels as Record<number, Record<string, string[]>>;
    for (const level of structuredLevels) {
      const levelFeatures = levels[level] ?? {};
      for (const category of ['keyword', 'structure', 'history'] as const) {
        for (const pattern of levelFeatures[category] ?? []) {
          try {
            if (new RegExp(pattern).test(taskLower)) {
              const weight = weights[category] ?? 0;
              structuredScores[level] += weight;
              matchedFeatures.push({
                level: levelToLabel(level),
                category,
                signal: pattern,
                weight,
                explanation: (model.category_explanations as Record<string, string>)[category] ?? '',
              });
            }
          } catch { /* skip invalid regex */ }
        }
      }
    }

    for (const [level, indicators] of Object.entries(this.getLevelIndicators())) {
      const lv = Number(level);
      if (lv === 4) continue; // skip L5_BRAINSTORM alias
      legacyScores[lv] = indicators.filter(pattern => {
        try { return new RegExp(pattern).test(taskLower); } catch { return false; }
      }).length;
    }

    const defaultLevel = WorkflowLevel.L3_STANDARD;

    function pickLevel(scores: Record<number, number>, fallback: number): [number, number] {
      const ordered = Object.entries(scores).sort((a, b) => {
        const scoreDiff = b[1] - a[1];
        if (scoreDiff !== 0) return scoreDiff;
        return (legacyScores[Number(b[0])] ?? 0) - (legacyScores[Number(a[0])] ?? 0);
      });
      const [topLevelStr, topScore] = ordered[0];
      const topLevel = Number(topLevelStr);
      const minScore = Number(thresholds.min_structured_score ?? 1);
      if (topScore < minScore) return [fallback, 0];
      return [topLevel, topScore];
    }

    const [legacyLevel, legacyTopScore] = pickLevel(legacyScores, defaultLevel);
    const [matchedLevel, structuredTopScore] = pickLevel(structuredScores, legacyLevel);

    const escalationMinLength = Number(thresholds.long_text_escalation_min_length ?? 100);
    const escalationFloor = WorkflowLevel.L3_STANDARD;
    let finalMatchedLevel = matchedLevel;
    let finalStructuredTopScore = structuredTopScore;

    if ((task ?? '').length > escalationMinLength && matchedLevel < escalationFloor) {
      finalMatchedLevel = escalationFloor;
      const escalationWeight = weights.long_text_escalation ?? 0;
      structuredScores[finalMatchedLevel] += escalationWeight;
      matchedFeatures.push({
        level: levelToLabel(finalMatchedLevel),
        category: 'long_text_escalation',
        signal: `len>${escalationMinLength}`,
        weight: escalationWeight,
        explanation: (model.category_explanations as Record<string, string>).long_text_escalation ?? '',
      });
      finalStructuredTopScore = Math.max(finalStructuredTopScore, structuredScores[finalMatchedLevel]);
    }

    return {
      matched_level: finalMatchedLevel,
      structured_scores: Object.fromEntries(Object.entries(structuredScores).map(([k, v]) => [levelToLabel(Number(k)), v])),
      legacy_scores: Object.fromEntries(Object.entries(legacyScores).map(([k, v]) => [levelToLabel(Number(k)), v])),
      matched_features: matchedFeatures,
      structured_top_score: finalStructuredTopScore,
      legacy_level: legacyLevel,
      legacy_top_score: legacyTopScore,
      feature_model: {
        categories: ['keyword', 'structure', 'history', 'long_text_escalation'],
        weights,
        thresholds,
        category_explanations: model.category_explanations,
      },
    };
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
  private router: LevelRouter;
  private sessionManager: SessionManager;
  private _sessionNamespace: string;
  private _moduleLocks: Map<string, Promise<void>> = new Map();
  private _moduleOwners: Map<string, string> = new Map();

  constructor(workspace?: string, sessionNamespace?: string) {
    this.workspace = workspace ?? process.cwd();
    this.router = new LevelRouter();
    this.sessionManager = new SessionManager(path.join(this.workspace, '.writing', 'sessions'));
    this._sessionNamespace = this._deriveSessionNamespace(sessionNamespace);
  }

  static publicEntryApi(): readonly string[] {
    return ENGINE_PUBLIC_ENTRY_API;
  }

  private _deriveSessionNamespace(explicit?: string): string {
    const candidate = (explicit ?? path.basename(this.workspace) ?? 'workflow').trim().toLowerCase();
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
        const plan = this.plans.get(String(planId ?? '').trim());
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
        const plan = this.plans.get(String(planId ?? '').trim());
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
    recommendations?: WorkflowRecommendationInput,
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
      return buildWorkflowRunFailedResult({
        planId: '',
        plan: plan as WorkflowPlanResult,
        error: 'Plan creation failed',
      });
    }

    const maxIterations = Math.max(plan.total_steps + 5, 5);
    let latestResult: WorkflowExecuteResult = { error: 'Workflow did not execute' };

    for (let i = 0; i < maxIterations; i++) {
      latestResult = await this.execute(planId);
      if ('error' in latestResult) {
        return buildWorkflowRunFailedResult({
          planId,
          plan,
          error: latestResult.error,
        });
      }
      if (['waiting_confirmation', 'preflight_blocked', 'gate_blocked'].includes(String(latestResult.status))) {
        const finalStatus = this.getPlanStatus(planId);
        if ('error' in finalStatus) {
          return buildWorkflowRunFailedResult({
            planId,
            plan,
            error: finalStatus.error,
          });
        }
        return buildWorkflowRunBlockedResult({
          planId,
          plan,
          lastStep: latestResult,
          finalStatus,
        });
      }
      if (latestResult.status === 'completed') {
        if (!('remaining_steps' in latestResult) || Number(latestResult.remaining_steps ?? 0) === 0) {
          break;
        }
      }
    }

    const finalStatus = this.getPlanStatus(planId);
    if ('error' in finalStatus) {
      return buildWorkflowRunFailedResult({
        planId,
        plan,
        error: finalStatus.error,
      });
    }

    return buildWorkflowRunCompletedResult({
      planId,
      plan,
      lastStep: latestResult,
      finalStatus,
    });
  }

  async runWithExecutionContext(
    taskOrRequest: string | WorkflowRunWithExecutionContextRequest,
    executionContext?: WorkflowExecutionContextPayload,
    level?: string,
    recommendations?: WorkflowRecommendationInput,
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
    taskOrRequest: string | WorkflowRunStreamRequest,
    level?: string,
    recommendations?: WorkflowRecommendationInput,
    executionContext?: WorkflowExecutionContextPayload,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const request = normalizeWorkflowRunStreamRequest(
      taskOrRequest,
      level,
      recommendations,
      executionContext,
    );
    const plan = await this.plan(request);
    const planId = plan.plan_id;
    if (!planId) {
      yield buildWorkflowStreamPlanCreationErrorEvent('Plan creation failed');
      return;
    }

    yield buildWorkflowStreamPlanCreatedEvent(planId, plan);

    const maxIterations = Math.max(plan.total_steps + 5, 5);
    let latestResult: WorkflowExecuteResult = { error: 'Workflow did not execute' };

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const currentPlan = this.plans.get(planId);
      const currentStep = currentPlan?.steps.find(
        (step) => this._canonicalStepStatus(step.status) === 'planned',
      );
      if (currentStep) {
        yield buildWorkflowStreamStepStartEvent(planId, currentStep.id, currentStep.name, iteration);
      }

      latestResult = await this.execute(planId);
      yield buildWorkflowStreamStepCompleteEvent(planId, latestResult);

      if ('error' in latestResult) {
        yield buildWorkflowStreamPlanErrorEvent(planId, latestResult.error);
        return;
      }
      if (['waiting_confirmation', 'preflight_blocked', 'gate_blocked'].includes(String(latestResult.status))) {
        yield buildWorkflowStreamPlanBlockedEvent(planId, String(latestResult.status), latestResult);
        return;
      }
      if (latestResult.status === 'completed') {
        if (!('remaining_steps' in latestResult) || Number(latestResult.remaining_steps ?? 0) === 0) {
          break;
        }
      }
    }

    const finalStatus = this.getPlanStatus(planId);
    if ('error' in finalStatus) {
      yield buildWorkflowStreamPlanErrorEvent(planId, finalStatus.error);
      return;
    }

    yield buildWorkflowStreamPlanCompleteEvent(planId, plan, latestResult, finalStatus);
  }

  async *runStreamWithExecutionContext(
    taskOrRequest: string | WorkflowRunStreamWithExecutionContextRequest,
    executionContext?: WorkflowExecutionContextPayload,
    level?: string,
    recommendations?: WorkflowRecommendationInput,
  ): AsyncGenerator<WorkflowStreamEvent> {
    const request = normalizeWorkflowRunStreamWithExecutionContextRequest(
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
    const request = normalizeWorkflowRouteRequest(taskOrRequest);
    const routingScore = this.router.scoreRouteFeatures(request.task);
    const matchedLevel = routingScore.matched_level as number;

    const levelDescriptions: Record<number, string> = {
      [WorkflowLevel.L1_RAPID]: '简单问答模式 - 直接回答，无需规划',
      [WorkflowLevel.L2_LITE]: '段落生成模式 - 单次生成，可能需要技能包',
      [WorkflowLevel.L3_STANDARD]: '章节创作模式 - Plan-Act 模式，需要检查点',
      [WorkflowLevel.L4_BRAINSTORM]: '多章连续模式 - 状态管理，跨章节一致性',
      [WorkflowLevel.L5_COORDINATOR]: '全书规划模式 - 完整工作流，大纲到成稿',
    };

    return buildWorkflowRouteResponse({
      level: levelToLabel(matchedLevel),
      description: levelDescriptions[matchedLevel],
      suggested_workflow: this._getWorkflowTemplate(matchedLevel),
      reason: `匹配关键词得分: ${routingScore.legacy_top_score} | 结构化得分: ${routingScore.structured_top_score}`,
      matched_features: routingScore.matched_features as Record<string, unknown>[],
      score: routingScore.structured_top_score as number,
      final_level: levelToLabel(matchedLevel),
      routing_diagnostics: routingScore,
    });
  }

  private _getWorkflowTemplate(level: number): WorkflowTemplateStep[] {
    const templates: Record<number, WorkflowTemplateStep[]> = {
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
    recommendations?: WorkflowRecommendationInput,
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
      const routing = await this.route(request.task);
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
      templateMeta.execution_context = structuredClone(request.executionContext);
    }
    if (adaptiveLevel !== workflowLevel) {
      templateMeta.adaptive_from_level = levelToLabel(workflowLevel);
    }

    const planId = generateId();
    const steps: WorkflowStep[] = template.map((t, i) => new WorkflowStep({
      id: `${planId}-${i}`,
      name: t.name,
      description: t.description,
      dependencies: i > 0 ? [`${planId}-${i - 1}`] : [],
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
    this._persistPlanState(planObj, 'planned');

    return buildWorkflowPlanResponse({
      plan_id: planId,
      level: levelToLabel(adaptiveLevel),
      template_meta: templateMeta,
      gate_decision: planObj.gate_decision,
      recommendations: planObj.recommendations,
      recommendations_frozen: planObj.recommendations_frozen,
      plan_hash: planObj.plan_hash,
      execution_mode: executionMode,
      observability_metrics: observability.aggregate,
      budget_guardrail: budgetGuardrail,
      steps: steps.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        dependencies: s.dependencies,
        status: s.status,
      })),
      total_steps: steps.length,
    });
  }

  // ---- Execution ----

  private _resolveManagedPlan(
    planId: string,
    authority?: WorkflowAuthority | null,
    extraErrorFields: Record<string, unknown> = {},
  ): { response?: WorkflowErrorResult; context?: ResolvedWorkflowPlanContext } {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { response: { error: `Plan '${planId}' not found`, ...extraErrorFields } };
    }
    const authorityResolution = this._resolvePlanAuthority(planId, authority);
    if (authorityResolution.error) {
      return {
        response: {
          error: authorityResolution.error,
          plan_id: planId,
          ...extraErrorFields,
        },
      };
    }
    return { context: { plan } };
  }

  private _prepareExecutionContext(
    request: WorkflowExecuteRequest,
  ): { response?: WorkflowExecuteResult; context?: WorkflowExecutionContext } {
    const managedPlan = this._resolveManagedPlan(request.planId, request.authority);
    if (managedPlan.response) {
      return { response: managedPlan.response };
    }
    const { plan } = managedPlan.context!;
    const runnerStateError = validateWorkflowRunnerState(plan.runner_state);
    if (runnerStateError) return { response: { error: runnerStateError } };
    if (plan.runner_state === 'pending') this._setRunnerState(plan, 'running');

    applyWorkflowRecommendationRefresh(
      plan,
      request.recommendations,
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
      request.stepId,
      (status) => this._canonicalStepStatus(status),
    );
    if (stepResolution.error) {
      return { response: { error: stepResolution.error } };
    }
    const step = stepResolution.step;

    if (!step) {
      this._persistPlanState(plan, 'done');
      const responseContext = this._executionResponseContext(plan, preflightRuntime);
      return {
        response: buildWorkflowAllStepsCompletedResult({
          message: 'All steps completed',
          executionMode: responseContext.executionMode,
          observabilityMetrics: responseContext.observabilityMetrics,
          budgetGuardrail: responseContext.budgetGuardrail,
          stateResumeMetadata: responseContext.stateResumeMetadata,
        }),
      };
    }

    const incompleteDependencyId = findIncompleteWorkflowDependency(
      plan.steps,
      step,
      (status) => this._canonicalStepStatus(status),
    );
    if (incompleteDependencyId) {
      return { response: { error: `Dependency '${incompleteDependencyId}' not completed` } };
    }

    if (plan.status === 'created') plan.status = 'running';

    const levelEnum = this._levelFromLabel(plan.level);
    const gate = this._evaluateRiskGate(levelEnum, step, plan.recommendations, request.confirmToken);
    plan.gate_decision = String(gate.decision ?? WorkflowDecision.GO);

    if (gate.confirm_required && !gate.confirmed) {
      // Hard guard: unconfirmed destructive/high-risk steps must stay NO_GO.
      plan.gate_decision = WorkflowDecision.NO_GO;
      this._persistPlanState(plan, 'planned');
      const responseContext = this._executionResponseContext(plan, preflightRuntime);
      return {
        response: buildWorkflowWaitingConfirmationResult({
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
    return executeWorkflowStepWithTransitions({
      plan: context.plan,
      step: context.step,
      gate: context.gate,
      executeStep: (plan, step) => this._executeStep(plan, step),
      transitionStepState: (plan, step, targetStatus, reason) => {
        this._transitionStepState(plan, step, targetStatus, reason);
      },
      completeExecutionStep: (plan, step, gate, result) => this._completeExecutionStep(plan, step, gate, result),
      failExecutionStep: (plan, step, error, runtime) => this._failExecutionStep(plan, step, error, runtime),
      runtime: {
        observability: context.preflightObservability,
        budgetGuardrail: context.preflightBudgetGuardrail,
        executionMode: context.preflightExecutionMode,
      },
    });
  }

  async execute(
    requestOrPlanId: string | WorkflowExecuteRequest,
    stepId?: string,
    recommendations?: WorkflowRecommendationInput,
    confirmToken?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<WorkflowExecuteResult> {
    const request = normalizeWorkflowExecuteRequest(
      requestOrPlanId,
      stepId,
      recommendations,
      confirmToken,
      authority,
    );
    const preparation = this._prepareExecutionContext(request);
    if (preparation.response) {
      return preparation.response;
    }
    return this._runExecutionStep(preparation.context!);
  }

  // ---- Lifecycle ----

  private _lifecycleStatus(plan: WorkflowPlan): WorkflowLifecycleResult {
    this._persistPlanState(
      plan,
      String(plan.template_meta.current_phase ?? plan.status),
      String(plan.template_meta.last_checkpoint_id ?? ''),
    );
    return this._buildLifecycleStatusResponse(plan);
  }

  private async _runLifecycleTransition(
    plan: WorkflowPlan,
    normalizedAction: string,
    triageState?: string,
  ): Promise<WorkflowLifecycleResult> {
    return executeWorkflowLifecycleTransition({
      plan,
      normalizedAction,
      triageState,
      createPauseCheckpoint: async (targetPlan) => {
        const checkpoint = await this.createCheckpoint(
          `loop-pause:${targetPlan.id}`,
          false,
          targetPlan.id,
          undefined,
          buildWorkflowPauseReplayPayload(targetPlan),
        );
        return checkpoint.checkpoint_id;
      },
      setRunnerState: (targetPlan, targetState, checkpointId, transitionReason) => this._setRunnerState(
        targetPlan,
        targetState,
        checkpointId,
        transitionReason,
      ),
      setTriageState: (targetPlan, targetState, transitionReason) => {
        this._setTriageState(targetPlan, targetState, transitionReason);
      },
      persistHandoff: (targetPlan, trigger) => {
        this._persistHandoffPackage(targetPlan, trigger);
      },
      buildActionResponse: (targetPlan, action, checkpointId, sessionStatus) => this._buildLifecycleActionResponse(
        targetPlan,
        action,
        checkpointId,
        sessionStatus,
      ),
    });
  }

  async lifecycle(
    planId: string,
    action: string,
    triageState?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<WorkflowLifecycleResult> {
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
  ): Promise<WorkflowCheckpointResult> {
    const checkpointId = generateId();
    let commitHash: string | null = null;

    if (autoCommit) {
      try {
        await execFileAsync('git', ['add', this.workspace], { cwd: this.workspace });
        const { stdout: commitOut } = await execFileAsync('git', ['commit', '-m', `[checkpoint:${checkpointId}] ${description || 'Auto checkpoint'}`], { cwd: this.workspace });
        if (commitOut) {
          const { stdout: hashOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: this.workspace });
          commitHash = hashOut.trim();
        }
      } catch {
        // Git not available or no changes to commit
      }
    }

    const checkpoint = new Checkpoint({ id: checkpointId, description, commit_hash: commitHash, plan_id: planId, step_id: stepId, replay_payload: replayPayload ? structuredClone(replayPayload) : {} });
    this.checkpoints.set(checkpointId, checkpoint);

    if (planId && this.plans.has(planId)) {
      this._persistPlanState(this.plans.get(planId)!, undefined, checkpointId);
    }

    return {
      checkpoint_id: checkpointId,
      commit_hash: commitHash,
      description,
      plan_id: checkpoint.plan_id,
      step_id: checkpoint.step_id,
      replay_payload: checkpoint.replay_payload,
      created_at: checkpoint.created_at,
    };
  }

  async restoreCheckpoint(checkpointId: string, confirmToken?: string): Promise<WorkflowRestoreCheckpointResult> {
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
  ): Promise<WorkflowQuickRollbackResult | WorkflowErrorResult> {
    return this._withModuleLock(RECOVERY_WORKSPACE_LOCK, async () => {
      const managedPlan = this._resolveManagedPlan(planId, authority, { checkpoint_id: checkpointId });
      if (managedPlan.response) {
        return managedPlan.response;
      }
      const { plan } = managedPlan.context!;

      const restoreResult = await this._restoreCheckpointInternal(checkpointId, AUTO_ROLLBACK_CONFIRM_TOKEN);
      const restored = restoreResult.status === 'restored';
      if (restored) {
        this._persistPlanState(
          plan,
          String(plan.template_meta.current_phase ?? plan.status),
          checkpointId,
        );
      }
      return { plan_id: planId, checkpoint_id: checkpointId, reason, restored, restore: restoreResult };
    });
  }


  async listCheckpoints(limit: number = 10): Promise<WorkflowCheckpointSummary[]> {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((c) => ({ id: c.id, description: c.description, commit_hash: c.commit_hash, created_at: c.created_at }));
  }

  getPlanStatus(planId: string): WorkflowPlanStatusResult | WorkflowErrorResult {
    const plan = this.plans.get(planId);
    if (!plan) return { error: `Plan '${planId}' not found` };

    const runtime = this._planRuntimeContext(plan);

    return buildWorkflowPlanStatusResponse({
      plan_id: plan.id,
      task: plan.task,
      level: plan.level,
      status: plan.status,
      runner_state: plan.runner_state,
      triage_state: plan.triage_state,
      fix_status: plan.fix_status,
      fix_owner: plan.fix_owner,
      template_meta: plan.template_meta,
      gate_decision: plan.gate_decision,
      recommendations: plan.recommendations,
      recommendations_frozen: plan.recommendations_frozen,
      plan_hash: plan.plan_hash,
      execution_mode: runtime.executionMode,
      observability_metrics: runtime.observabilityMetrics,
      budget_guardrail: runtime.budgetGuardrail,
      handoff_package: runtime.handoffPackage,
      steps: plan.steps.map((s) => ({ id: s.id, name: s.name, status: s.status, output: s.output })),
      progress: `${plan.steps.filter((s) => this._canonicalStepStatus(s.status) === 'done').length}/${plan.steps.length}`,
    });
  }

  // ---- Step Execution ----

  private async _executeStep(plan: WorkflowPlan, step: WorkflowStep): Promise<unknown> {
    switch (step.name) {
      case 'analyze': return this._runAnalyze(plan);
      case 'match_skills': return this._runMatchSkills(plan);
      case 'load_context': return this._runLoadContext(plan);
      case 'plan_structure': return this._runPlanStructure(plan);
      case 'generate_draft': return this._runGenerateDraft(plan);
      case 'generate': return this._runGenerate(plan);
      case 'evaluate': return this._runEvaluate(plan);
      case 'revise': return this._runRevise(plan);
      case 'checkpoint': {
        const cp = await this.createCheckpoint(`plan:${plan.id} step:${step.id}`, false, plan.id, step.id, {
          plan_id: plan.id, plan_hash: plan.plan_hash, recommendations: structuredClone(plan.recommendations), recommendations_frozen: plan.recommendations_frozen,
        });
        return { checkpoint_id: cp['checkpoint_id'], created_at: cp['created_at'], replay_payload: cp['replay_payload'] };
      }
      case 'answer': return this._runAnswer(plan);
      default: throw new Error(`Unsupported workflow step: ${step.name}`);
    }
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

  private _runGenerateDraft(plan: WorkflowPlan): Record<string, unknown> {
    const structureOutput = this._getStepOutput(plan, 'plan_structure') ?? {};
    const sections = (structureOutput['structure'] as string[]) ?? ['开场', '发展', '结尾'];
    const draft = sections.map((section, idx) => `${idx + 1}. ${section}`).join('\n');
    return { draft, source_task: this._getExecutionTask(plan), section_count: sections.length };
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
  ): Promise<WorkflowRestoreCheckpointResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return { error: `Checkpoint '${checkpointId}' not found` };

    return restoreWorkflowCheckpoint({
      checkpoint: checkpoint as WorkflowCheckpointLike,
      confirmToken,
      hasValidConfirmToken: (token) => this._hasValidConfirmToken(token),
      applyReplayPayload: (targetCheckpoint) => this._applyReplayPayload(targetCheckpoint as Checkpoint),
      checkoutCommit: async (commitHash) => {
        await execFileAsync('git', ['checkout', commitHash], { cwd: this.workspace });
      },
    });
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
    gate: Record<string, unknown>,
    result: unknown,
  ): WorkflowExecuteResult {
    step.output = result;

    if (areAllWorkflowStepsDone(plan.steps, (status) => this._canonicalStepStatus(status))) {
      plan.status = 'completed';
      plan.completed_at = new Date().toISOString();
    }

    const responseContext = this._executionResponseContext(plan);

    return buildWorkflowCompletedStepResult({
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
    });
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
    return buildWorkflowExecutionFailureResult({
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
    const payload = buildWorkflowLifecycleStatusContract({
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
    });
    payload.last_checkpoint_id = String(plan.template_meta['last_checkpoint_id'] ?? '');
    return payload;
  }

  private _buildLifecycleActionResponse(
    plan: WorkflowPlan,
    action: string,
    checkpointId: string | undefined,
    sessionStatus: string | null,
  ): WorkflowLifecycleActionResult {
    const runtime = this._planRuntimeContext(plan, undefined, sessionStatus);
    const payload = buildWorkflowLifecycleActionContract({
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
    });
    payload.last_checkpoint_id = String(plan.template_meta['last_checkpoint_id'] ?? '');
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

  private _evaluateRiskGate(level: number, step: WorkflowStep, recommendations?: Record<string, unknown>[], confirmToken?: string | null): Record<string, unknown> {
    return evaluateWorkflowRiskGate(
      level,
      step.name,
      recommendations,
      confirmToken,
      TEMPLATE_METADATA_MAP,
      DESTRUCTIVE_STEP_NAMES,
    );
  }

  private _isDestructiveStep(step: WorkflowStep, recommendations?: Record<string, unknown>[]): boolean {
    return isDestructiveWorkflowStep(step.name, recommendations, DESTRUCTIVE_STEP_NAMES);
  }

  private _hasValidConfirmToken(confirmToken: string | null | undefined): boolean {
    return hasValidWorkflowConfirmToken(confirmToken);
  }

  // ---- Recommendations ----

  private _canonicalizeRecommendations(recommendations?: WorkflowRecommendationInput): Record<string, unknown>[] {
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
    const payload = checkpoint.replay_payload;
    if (!payload || Object.keys(payload).length === 0) return { applied: false, reason: 'no_replay_payload' };

    const planId = (payload['plan_id'] as string) ?? checkpoint.plan_id;
    if (!planId) return { applied: false, reason: 'no_plan_id' };

    const plan = this.plans.get(planId);
    if (!plan) return { applied: false, reason: `plan_not_found:${planId}` };

    const expectedHash = payload['plan_hash'] as string;
    if (expectedHash) {
      const currentHash = this._computePlanHash(plan);
      if (currentHash !== expectedHash) return { applied: false, reason: 'plan_hash_mismatch', expected_plan_hash: expectedHash, current_plan_hash: currentHash };
    }

    plan.recommendations = this._canonicalizeRecommendations(payload['recommendations'] as WorkflowRecommendationInput);
    plan.recommendations_frozen = Boolean(payload['recommendations_frozen'] ?? true);
    plan.plan_hash = expectedHash || this._computePlanHash(plan);

    return { applied: true, plan_id: planId, plan_hash: plan.plan_hash, recommendation_count: plan.recommendations.length };
  }

  // ---- State Persistence ----

  private _persistPlanState(
    plan: WorkflowPlan,
    currentPhase?: string | null,
    checkpointId?: string,
  ): Record<string, unknown> {
    const { phase, lastCheckpointId } = resolveWorkflowPersistencePhase({
      currentPhase,
      templateMeta: plan.template_meta,
      checkpointId,
    });
    plan.template_meta['current_phase'] = phase;
    if (lastCheckpointId) {
      plan.template_meta['last_checkpoint_id'] = lastCheckpointId;
    }

    const authority = this.getPlanAuthority(plan.id);
    const sessionId = authority.sessionId ?? this.getPlanSessionId(plan.id);
    const { sessionLifecycle, sessionRoot } = syncWorkflowSessionContext({
      sessionManager: this.sessionManager,
      sessionId,
      runnerState: plan.runner_state,
      checkpointId: lastCheckpointId || undefined,
    });
    plan.template_meta['session_id'] = sessionId;
    plan.template_meta['session_status'] = sessionLifecycle['status'] ?? null;
    const authoritySnapshot = {
      sessionId,
      workspaceId: authority.workspaceId,
      projectId: authority.projectId,
    };
    const snapshot = buildWorkflowPersistedStateSnapshot<WorkflowStateSnapshot>({
      schemaVersion: WORKFLOW_STATE_SCHEMA_VERSION,
      schemaPolicy: WORKFLOW_STATE_SCHEMA_POLICY,
      planId: plan.id,
      task: plan.task,
      level: plan.level,
      planStatus: plan.status,
      runnerState: plan.runner_state,
      currentPhase: phase,
      lastCheckpointId: lastCheckpointId,
      sessionId,
      lane: plan.lane,
      executionMode: String(plan.template_meta['execution_mode'] ?? ''),
      qualityMetrics: plan.quality_metrics,
      templateMeta: plan.template_meta,
      recommendationsFrozen: plan.recommendations_frozen,
      planHash: plan.plan_hash,
      triageState: plan.triage_state,
      fixStatus: plan.fix_status,
      fixOwner: plan.fix_owner,
      authority: authoritySnapshot,
      sessionRoot,
      observability: plan.observability,
      budgetGuardrail: plan.budget_guardrail,
      handoffPackage: plan.handoff_package,
      steps: plan.steps.map((step) => ({
        id: step.id,
        name: step.name,
        status: this._canonicalStepStatus(step.status),
        started_at: step.started_at,
        completed_at: step.completed_at,
      })),
      checkpoints: Array.from(this.checkpoints.values()),
    });

    writeWorkflowStateArtifacts({
      sessionManager: this.sessionManager,
      sessionId,
      snapshot,
      auditEvent: buildWorkflowPersistedAuditContract({
        planId: plan.id,
        runnerState: plan.runner_state,
        currentPhase: phase,
        checkpointId: lastCheckpointId || null,
        sessionStatus: (sessionLifecycle['status'] as string | null | undefined) ?? null,
        authority: authoritySnapshot,
        recordedAt: snapshot.updated_at,
      }),
    });
    return sessionLifecycle;
  }

  private _stateResumeMetadata(plan: WorkflowPlan): WorkflowStateResumeMetadata {
    const authority = this.getPlanAuthority(plan.id);
    const sessionId = authority.sessionId ?? this.getPlanSessionId(plan.id);
    return buildWorkflowStateResumeContract({
      currentPhase: String(plan.template_meta['current_phase'] ?? plan.status),
      sessionId,
      canResumeFromCheckpoint: !!plan.template_meta['last_checkpoint_id'],
      observability: plan.observability,
      budgetGuardrail: plan.budget_guardrail,
      handoffPackage: plan.handoff_package,
      sessionStatus: (plan.template_meta['session_status'] as string | null | undefined) ?? null,
      authority: {
        sessionId,
        workspaceId: authority.workspaceId,
        projectId: authority.projectId,
      },
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
}
