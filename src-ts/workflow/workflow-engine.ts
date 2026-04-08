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
import { SessionManager, ContentType } from './session/session-manager.js';

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

interface WorkflowAuthority {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
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
    const normalizedPlanId = String(planId ?? '').trim();
    if (!normalizedPlanId) {
      throw new Error('planId is required');
    }

    const normalizedSessionId = String(sessionId ?? '').trim();
    if (!normalizedSessionId) {
      return this._sessionIdForPlan(normalizedPlanId);
    }

    this.planSessions.set(normalizedPlanId, normalizedSessionId);
    const currentAuthority = this.planAuthorities.get(normalizedPlanId);
    this.planAuthorities.set(normalizedPlanId, {
      sessionId: normalizedSessionId,
      workspaceId: currentAuthority?.workspaceId ?? null,
      projectId: currentAuthority?.projectId ?? null,
    });
    const plan = this.plans.get(normalizedPlanId);
    if (plan) {
      this._persistPlanState(
        plan,
        String(plan.template_meta['current_phase'] ?? plan.status),
        String(plan.template_meta['last_checkpoint_id'] ?? ''),
      );
    }
    return normalizedSessionId;
  }

  getPlanSessionId(planId: string): string {
    const normalizedPlanId = String(planId ?? '').trim();
    if (!normalizedPlanId) {
      throw new Error('planId is required');
    }
    return this._sessionIdForPlan(normalizedPlanId);
  }

  bindPlanAuthority(planId: string, authority: WorkflowAuthority): WorkflowAuthority {
    const normalizedPlanId = String(planId ?? '').trim();
    if (!normalizedPlanId) {
      throw new Error('planId is required');
    }

    const normalizedAuthority = this._normalizeAuthority(authority);
    const currentAuthority = this.planAuthorities.get(normalizedPlanId);
    const mergedAuthority: WorkflowAuthority = {
      sessionId:
        normalizedAuthority?.sessionId
        ?? currentAuthority?.sessionId
        ?? this._sessionIdForPlan(normalizedPlanId),
      workspaceId:
        normalizedAuthority?.workspaceId
        ?? currentAuthority?.workspaceId
        ?? null,
      projectId:
        normalizedAuthority?.projectId
        ?? currentAuthority?.projectId
        ?? null,
    };

    this.planAuthorities.set(normalizedPlanId, mergedAuthority);
    if (mergedAuthority.sessionId) {
      this.planSessions.set(normalizedPlanId, mergedAuthority.sessionId);
    }
    const plan = this.plans.get(normalizedPlanId);
    if (plan) {
      this._persistPlanState(
        plan,
        String(plan.template_meta['current_phase'] ?? plan.status),
        String(plan.template_meta['last_checkpoint_id'] ?? ''),
      );
    }
    return { ...mergedAuthority };
  }

  getPlanAuthority(planId: string): WorkflowAuthority {
    const normalizedPlanId = String(planId ?? '').trim();
    if (!normalizedPlanId) {
      throw new Error('planId is required');
    }

    const storedAuthority = this.planAuthorities.get(normalizedPlanId);
    if (storedAuthority) {
      return { ...storedAuthority };
    }

    return {
      sessionId: this._sessionIdForPlan(normalizedPlanId),
      workspaceId: null,
      projectId: null,
    };
  }

  private _normalizeAuthority(authority?: Partial<WorkflowAuthority> | null): WorkflowAuthority | null {
    if (!authority) return null;

    const sessionId =
      typeof authority.sessionId === 'string' && authority.sessionId.trim()
        ? authority.sessionId.trim()
        : null;
    const workspaceId =
      typeof authority.workspaceId === 'string' && authority.workspaceId.trim()
        ? authority.workspaceId.trim()
        : null;
    const projectId =
      typeof authority.projectId === 'string' && authority.projectId.trim()
        ? authority.projectId.trim()
        : null;

    if (!sessionId && !workspaceId && !projectId) {
      return null;
    }

    return {
      sessionId,
      workspaceId,
      projectId,
    };
  }

  private _authorityMismatchError(
    planId: string,
    dimension: 'workflow session' | 'workspace' | 'project',
    expected: string,
    received: string,
  ): string {
    return `Plan '${planId}' is bound to ${dimension} '${expected}' and cannot be used with '${received}'`;
  }

  private _resolvePlanAuthority(
    planId: string,
    requestAuthority?: Partial<WorkflowAuthority> | null,
  ): { authority: WorkflowAuthority; error?: never } | { authority: null; error: string } {
    const normalizedPlanId = String(planId ?? '').trim();
    if (!normalizedPlanId) {
      return { authority: null, error: 'planId is required' };
    }

    const storedAuthority = this.getPlanAuthority(normalizedPlanId);
    const normalizedRequest = this._normalizeAuthority(requestAuthority);

    if (
      storedAuthority.sessionId
      && normalizedRequest?.sessionId
      && storedAuthority.sessionId !== normalizedRequest.sessionId
    ) {
      return {
        authority: null,
        error: this._authorityMismatchError(
          normalizedPlanId,
          'workflow session',
          storedAuthority.sessionId,
          normalizedRequest.sessionId,
        ),
      };
    }

    if (
      storedAuthority.workspaceId
      && normalizedRequest?.workspaceId
      && storedAuthority.workspaceId !== normalizedRequest.workspaceId
    ) {
      return {
        authority: null,
        error: this._authorityMismatchError(
          normalizedPlanId,
          'workspace',
          storedAuthority.workspaceId,
          normalizedRequest.workspaceId,
        ),
      };
    }

    if (
      storedAuthority.projectId
      && normalizedRequest?.projectId
      && storedAuthority.projectId !== normalizedRequest.projectId
    ) {
      return {
        authority: null,
        error: this._authorityMismatchError(
          normalizedPlanId,
          'project',
          storedAuthority.projectId,
          normalizedRequest.projectId,
        ),
      };
    }

    return {
      authority: this.bindPlanAuthority(normalizedPlanId, {
        sessionId: normalizedRequest?.sessionId ?? storedAuthority.sessionId,
        workspaceId: normalizedRequest?.workspaceId ?? storedAuthority.workspaceId,
        projectId: normalizedRequest?.projectId ?? storedAuthority.projectId,
      }),
    };
  }

  // ---- Public API ----

  async run(task: string, level?: string, recommendations?: unknown[]): Promise<Record<string, unknown>> {
    const plan = await this.plan(task, level, recommendations);
    const planId = String(plan['plan_id'] ?? '');
    if (!planId) return { error: 'Plan creation failed' };

    const maxIterations = Math.max(Number(plan['total_steps'] ?? 0) + 5, 5);
    let latestResult: Record<string, unknown> = {};

    for (let i = 0; i < maxIterations; i++) {
      latestResult = await this.execute(planId);
      if ('error' in latestResult) {
        return this._withContract({ status: 'failed', plan_id: planId, plan, error: latestResult['error'] });
      }
      if (['waiting_confirmation', 'preflight_blocked', 'gate_blocked'].includes(String(latestResult['status']))) {
        return this._withContract({ status: 'blocked', plan_id: planId, plan, last_step: latestResult, final_status: this.getPlanStatus(planId) });
      }
      if (latestResult['plan_status'] === 'completed' || latestResult['status'] === 'completed') break;
    }

    const finalStatus = this.getPlanStatus(planId);
    return this._withContract({ status: 'completed', plan_id: planId, plan, last_step: latestResult, final_status: finalStatus });
  }

  async *runStream(task: string, level?: string, recommendations?: unknown[]): AsyncGenerator<Record<string, unknown>> {
    const plan = await this.plan(task, level, recommendations);
    const planId = String(plan['plan_id'] ?? '');
    if (!planId) {
      yield this._withContract({ type: 'error', status: 'failed', error: 'Plan creation failed' });
      return;
    }

    yield this._withContract({ type: 'plan_created', plan_id: planId, plan });

    const maxIterations = Math.max(Number(plan['total_steps'] ?? 0) + 5, 5);
    let latestResult: Record<string, unknown> = {};

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const currentPlan = this.plans.get(planId);
      if (currentPlan && currentPlan.steps.length > 0) {
        const currentStep = currentPlan.steps[currentPlan.steps.length - 1];
        yield this._withContract({ type: 'step_start', plan_id: planId, step_id: currentStep.id, step_name: currentStep.name, iteration });
      }

      latestResult = await this.execute(planId);
      yield this._withContract({ type: 'step_complete', plan_id: planId, ...latestResult });

      if ('error' in latestResult) {
        yield this._withContract({ type: 'plan_error', plan_id: planId, error: latestResult['error'] });
        return;
      }
      if (['waiting_confirmation', 'preflight_blocked', 'gate_blocked'].includes(String(latestResult['status']))) {
        yield this._withContract({ type: 'plan_blocked', plan_id: planId, status: latestResult['status'], last_step: latestResult });
        return;
      }
      if (latestResult['plan_status'] === 'completed' || latestResult['status'] === 'completed') break;
    }

    const finalStatus = this.getPlanStatus(planId);
    yield this._withContract({ type: 'plan_complete', plan_id: planId, status: 'completed', plan, last_step: latestResult, final_status: finalStatus });
  }

  private _withContract(payload: Record<string, unknown>): Record<string, unknown> {
    return ensureContractPayload(payload);
  }

  // ---- Routing ----

  async route(task: string): Promise<Record<string, unknown>> {
    const routingScore = this.router.scoreRouteFeatures(task);
    const matchedLevel = routingScore.matched_level as number;

    const levelDescriptions: Record<number, string> = {
      [WorkflowLevel.L1_RAPID]: '简单问答模式 - 直接回答，无需规划',
      [WorkflowLevel.L2_LITE]: '段落生成模式 - 单次生成，可能需要技能包',
      [WorkflowLevel.L3_STANDARD]: '章节创作模式 - Plan-Act 模式，需要检查点',
      [WorkflowLevel.L4_BRAINSTORM]: '多章连续模式 - 状态管理，跨章节一致性',
      [WorkflowLevel.L5_COORDINATOR]: '全书规划模式 - 完整工作流，大纲到成稿',
    };

    return {
      level: levelToLabel(matchedLevel),
      description: levelDescriptions[matchedLevel],
      suggested_workflow: this._getWorkflowTemplate(matchedLevel),
      reason: `匹配关键词得分: ${routingScore.legacy_top_score} | 结构化得分: ${routingScore.structured_top_score}`,
      matched_features: routingScore.matched_features,
      score: routingScore.structured_top_score,
      final_level: levelToLabel(matchedLevel),
      routing_diagnostics: routingScore,
    };
  }

  private _getWorkflowTemplate(level: number): Record<string, string>[] {
    const templates: Record<number, Record<string, string>[]> = {
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

  async plan(task: string, level?: string, recommendations?: unknown[]): Promise<Record<string, unknown>> {
    if (!level) {
      const routing = await this.route(task);
      level = routing['level'] as string;
    }

    const workflowLevel = this._levelFromLabel(level);
    const qualityMetrics = this._buildQualityMetrics(task);
    const lane = this._determineLane(qualityMetrics);
    const adaptiveLevel = this._resolveAdaptiveLevel(workflowLevel, lane, qualityMetrics);

    const template = this._getWorkflowTemplate(adaptiveLevel);
    const templateMeta: Record<string, unknown> = {
      ...(TEMPLATE_METADATA_MAP[adaptiveLevel] ?? {}),
      lane,
      quality_metrics: qualityMetrics,
      gate_profile: this._resolveGateProfile(adaptiveLevel, lane, qualityMetrics),
    };
    if (adaptiveLevel !== workflowLevel) (templateMeta as Record<string, unknown>)['adaptive_from_level'] = levelToLabel(workflowLevel);

    const planId = generateId();
    const steps: WorkflowStep[] = template.map((t, i) => new WorkflowStep({
      id: `${planId}-${i}`,
      name: t.name,
      description: t.description,
      dependencies: i > 0 ? [`${planId}-${i - 1}`] : [],
    }));

    const canonicalRecommendations = this._canonicalizeRecommendations(recommendations);

    const planObj = new WorkflowPlan({
      id: planId,
      task,
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

    const observability = this._refreshObservability(planObj);
    const budgetGuardrail = this._refreshBudgetGuardrail(planObj);
    const executionMode = this._resolveExecutionMode(planObj, observability['mode'] as string);
    planObj.template_meta['execution_mode'] = executionMode;
    planObj.plan_hash = this._computePlanHash(planObj);

    this.plans.set(planId, planObj);
    this._persistPlanState(planObj, 'planned');

    return this._withContract({
      plan_id: planId,
      level: levelToLabel(adaptiveLevel),
      template_meta: templateMeta,
      gate_decision: planObj.gate_decision,
      recommendations: planObj.recommendations,
      recommendations_frozen: planObj.recommendations_frozen,
      plan_hash: planObj.plan_hash,
      execution_mode: executionMode,
      observability_metrics: observability['aggregate'],
      budget_guardrail: budgetGuardrail,
      steps: steps.map(s => ({ id: s.id, name: s.name, description: s.description, dependencies: s.dependencies, status: s.status })),
      total_steps: steps.length,
    });
  }

  // ---- Execution ----

  async execute(
    planId: string,
    stepId?: string,
    recommendations?: unknown[],
    confirmToken?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>> {
    const plan = this.plans.get(planId);
    if (!plan) return { error: `Plan '${planId}' not found` };
    const authorityResolution = this._resolvePlanAuthority(planId, authority);
    if (authorityResolution.error) {
      return { error: authorityResolution.error, plan_id: planId };
    }
    if (plan.runner_state === 'stopped') return { error: 'Loop runner is stopped' };
    if (plan.runner_state === 'paused') return { error: 'Loop runner is paused' };
    if (plan.runner_state === 'pending') this._setRunnerState(plan, 'running');

    if (recommendations) {
      plan.recommendations = this._canonicalizeRecommendations(recommendations);
      plan.recommendations_frozen = false;
      plan.plan_hash = this._computePlanHash(plan);
    }

    this._freezeRecommendations(plan);
    if (!plan.plan_hash) plan.plan_hash = this._computePlanHash(plan);

    const preflightObservability = this._refreshObservability(plan);
    const preflightBudgetGuardrail = this._refreshBudgetGuardrail(plan);
    const preflightExecutionMode = this._resolveExecutionMode(plan, preflightObservability['mode'] as string);
    plan.template_meta['execution_mode'] = preflightExecutionMode;

    let step: WorkflowStep | undefined;
    if (stepId) {
      step = plan.steps.find(s => s.id === stepId);
      if (!step) return { error: `Step '${stepId}' not found` };
      if (this._canonicalStepStatus(step.status) !== 'planned') {
        return { error: `Step '${stepId}' is not planned (current status: ${this._canonicalStepStatus(step.status)})` };
      }
    } else {
      step = plan.steps.find(s => this._canonicalStepStatus(s.status) === 'planned');
    }

    if (!step) {
      this._persistPlanState(plan, 'done');
      return { status: 'completed', message: 'All steps completed', execution_mode: preflightExecutionMode, observability_metrics: preflightObservability['aggregate'], budget_guardrail: preflightBudgetGuardrail, ...this._stateResumeMetadata(plan) };
    }

    for (const depId of step.dependencies) {
      const depStep = plan.steps.find(s => s.id === depId);
      if (depStep && this._canonicalStepStatus(depStep.status) !== 'done') {
        return { error: `Dependency '${depId}' not completed` };
      }
    }

    if (plan.status === 'created') plan.status = 'running';

    const levelEnum = this._levelFromLabel(plan.level);
    const gate = this._evaluateRiskGate(levelEnum, step, plan.recommendations, confirmToken);
    plan.gate_decision = gate['decision'] as string;

    if (gate['confirm_required'] && !gate['confirmed']) {
      this._persistPlanState(plan, 'planned');
      return this._withContract({ step_id: step.id, step_name: step.name, status: 'waiting_confirmation', gate, plan_status: plan.status, runner_state: plan.runner_state, remaining_steps: this._remainingSteps(plan), execution_mode: preflightExecutionMode, observability_metrics: preflightObservability['aggregate'], budget_guardrail: preflightBudgetGuardrail, ...this._stateResumeMetadata(plan) });
    }

    try {
      this._transitionStepState(plan, step, 'executing', 'execution_started');
      const result = await this._executeStep(plan, step);
      this._transitionStepState(plan, step, 'review', 'execution_review');
      this._transitionStepState(plan, step, 'test', 'execution_test');
      this._transitionStepState(plan, step, 'done', 'execution_completed');
      step.output = result;

      if (plan.steps.every(s => this._canonicalStepStatus(s.status) === 'done')) {
        plan.status = 'completed';
        plan.completed_at = new Date().toISOString();
      }

      const observability = this._refreshObservability(plan);
      const budgetGuardrail = this._refreshBudgetGuardrail(plan);
      const executionMode = this._resolveExecutionMode(plan, observability['mode'] as string);

      return this._withContract({
        step_id: step.id,
        step_name: step.name,
        status: 'completed',
        result,
        gate,
        plan_status: plan.status,
        runner_state: plan.runner_state,
        remaining_steps: this._remainingSteps(plan),
        execution_mode: executionMode,
        observability_metrics: observability['aggregate'],
        budget_guardrail: budgetGuardrail,
        ...this._stateResumeMetadata(plan),
      });
    } catch (e) {
      this._transitionStepState(plan, step, 'failed', 'execution_error');
      plan.status = 'failed';
      return {
        error: String(e),
        step_id: step.id,
        failure: { phase: 'executing', reason: String(e) },
        execution_mode: preflightExecutionMode,
        observability_metrics: preflightObservability['aggregate'],
        budget_guardrail: preflightBudgetGuardrail,
        ...this._stateResumeMetadata(plan),
      };
    }
  }

  // ---- Lifecycle ----

  async lifecycle(
    planId: string,
    action: string,
    triageState?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>> {
    const plan = this.plans.get(planId);
    if (!plan) return { error: `Plan '${planId}' not found` };
    const authorityResolution = this._resolvePlanAuthority(planId, authority);
    if (authorityResolution.error) {
      return { error: authorityResolution.error, plan_id: planId };
    }

    const normalizedAction = (action ?? '').trim().toLowerCase();
    if (normalizedAction === 'status') {
      this._persistPlanState(
        plan,
        String(plan.template_meta['current_phase'] ?? plan.status),
        String(plan.template_meta['last_checkpoint_id'] ?? ''),
      );
      const observability = this._refreshObservability(plan);
      const budgetGuardrail = this._refreshBudgetGuardrail(plan);
      const executionMode = this._resolveExecutionMode(plan, observability['mode'] as string);
      plan.template_meta['execution_mode'] = executionMode;
      return this._withContract({
        plan_id: plan.id, action: 'status', runner_state: plan.runner_state,
        triage_state: plan.triage_state, fix_status: plan.fix_status, fix_owner: plan.fix_owner,
        plan_status: plan.status, lane: plan.lane, quality_metrics: plan.quality_metrics,
        execution_mode: executionMode, observability_metrics: observability['aggregate'],
        budget_guardrail: budgetGuardrail,
        handoff_package: plan.handoff_package,
        session_status: plan.template_meta['session_status'] ?? null,
      });
    }

    const targetByAction: Record<string, string> = { start: 'running', pause: 'paused', resume: 'running', stop: 'stopped' };
    if (!(normalizedAction in targetByAction)) return { error: `Unsupported lifecycle action: ${action}` };

    let checkpointId: string | undefined;
    if (normalizedAction === 'pause') {
      const checkpoint = await this.createCheckpoint(
        `loop-pause:${plan.id}`,
        false,
        plan.id,
        undefined,
        { plan_id: plan.id, plan_hash: plan.plan_hash, recommendations: structuredClone(plan.recommendations), recommendations_frozen: plan.recommendations_frozen },
      );
      checkpointId = checkpoint['checkpoint_id'] as string;
    }

    let sessionLifecycle: Record<string, unknown> = {};
    try {
      sessionLifecycle = this._setRunnerState(
        plan,
        targetByAction[normalizedAction],
        checkpointId,
        `lifecycle:${normalizedAction}`,
      );
      if (triageState) {
        this._setTriageState(plan, triageState.trim().toLowerCase(), `lifecycle:${normalizedAction}`);
      }
    } catch (exc) {
      return { error: String(exc) };
    }

    if (['pause', 'stop'].includes(normalizedAction)) {
      this._persistHandoffPackage(plan, normalizedAction);
    }

    const observability = this._refreshObservability(plan);
    const budgetGuardrail = this._refreshBudgetGuardrail(plan);
    const executionMode = this._resolveExecutionMode(plan, observability['mode'] as string);
    plan.template_meta['execution_mode'] = executionMode;

    return this._withContract({
      plan_id: plan.id, action: normalizedAction, runner_state: plan.runner_state,
      triage_state: plan.triage_state, fix_status: plan.fix_status, fix_owner: plan.fix_owner,
      plan_status: plan.status, checkpoint_id: checkpointId, lane: plan.lane,
      quality_metrics: plan.quality_metrics, execution_mode: executionMode,
      observability_metrics: observability['aggregate'], budget_guardrail: budgetGuardrail,
      handoff_package: plan.handoff_package,
      session_status: sessionLifecycle['status'] ?? plan.template_meta['session_status'] ?? null,
    });
  }

  // ---- Checkpoints ----

  async createCheckpoint(
    description: string = '',
    autoCommit: boolean = true,
    planId?: string,
    stepId?: string,
    replayPayload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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

    return { checkpoint_id: checkpointId, commit_hash: commitHash, description, plan_id: checkpoint.plan_id, step_id: checkpoint.step_id, replay_payload: checkpoint.replay_payload, created_at: checkpoint.created_at };
  }

  async restoreCheckpoint(checkpointId: string, confirmToken?: string): Promise<Record<string, unknown>> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return { error: `Checkpoint '${checkpointId}' not found` };

    const destructive = Object.keys(checkpoint.replay_payload).length > 0;
    const confirmed = !destructive || this._hasValidConfirmToken(confirmToken);

    if (destructive && !confirmed) {
      return this._withContract({
        status: 'waiting_confirmation',
        error: 'destructive restore requires secondary confirmation',
        checkpoint_id: checkpointId,
        plan_id: checkpoint.plan_id,
        step_id: checkpoint.step_id,
        gate: { decision: WorkflowDecision.NO_GO, reason: 'destructive restore requires secondary confirmation', blocking: true },
      });
    }

    const replayResult = this._applyReplayPayload(checkpoint);

    if (checkpoint.commit_hash) {
      try {
        await execFileAsync('git', ['checkout', checkpoint.commit_hash], { cwd: this.workspace });
        return this._withContract({ status: 'restored', checkpoint_id: checkpointId, commit_hash: checkpoint.commit_hash, plan_id: checkpoint.plan_id, step_id: checkpoint.step_id, replay: replayResult });
      } catch (e) {
        return { error: `Git restore failed: ${e}`, replay: replayResult };
      }
    }

    return { error: 'No commit hash available for this checkpoint', plan_id: checkpoint.plan_id, step_id: checkpoint.step_id, replay: replayResult };
  }

  async quickRollback(
    planId: string,
    checkpointId: string,
    reason: string = '',
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>> {
    const plan = this.plans.get(planId);
    if (!plan) return { error: `Plan '${planId}' not found` };
    const authorityResolution = this._resolvePlanAuthority(planId, authority);
    if (authorityResolution.error) {
      return { error: authorityResolution.error, plan_id: planId, checkpoint_id: checkpointId };
    }

    const restoreResult = await this.restoreCheckpoint(checkpointId, AUTO_ROLLBACK_CONFIRM_TOKEN);
    this._persistPlanState(
      plan,
      String(plan.template_meta['current_phase'] ?? plan.status),
      checkpointId,
    );
    return { plan_id: planId, checkpoint_id: checkpointId, restored: restoreResult['status'] === 'restored', restore: restoreResult };
  }

  async listCheckpoints(limit: number = 10): Promise<Record<string, unknown>[]> {
    return Array.from(this.checkpoints.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map(c => ({ id: c.id, description: c.description, commit_hash: c.commit_hash, created_at: c.created_at }));
  }

  getPlanStatus(planId: string): Record<string, unknown> {
    const plan = this.plans.get(planId);
    if (!plan) return { error: `Plan '${planId}' not found` };

    const observability = this._refreshObservability(plan);
    const budgetGuardrail = this._refreshBudgetGuardrail(plan);
    const executionMode = this._resolveExecutionMode(plan, observability['mode'] as string);
    plan.template_meta['execution_mode'] = executionMode;

    return this._withContract({
      plan_id: plan.id, task: plan.task, level: plan.level, status: plan.status,
      runner_state: plan.runner_state, triage_state: plan.triage_state, fix_status: plan.fix_status,
      fix_owner: plan.fix_owner, template_meta: plan.template_meta, gate_decision: plan.gate_decision,
      recommendations: plan.recommendations, recommendations_frozen: plan.recommendations_frozen,
      plan_hash: plan.plan_hash, execution_mode: executionMode,
      observability_metrics: observability['aggregate'], budget_guardrail: budgetGuardrail,
      handoff_package: plan.handoff_package,
      steps: plan.steps.map(s => ({ id: s.id, name: s.name, status: s.status, output: s.output })),
      progress: `${plan.steps.filter(s => this._canonicalStepStatus(s.status) === 'done').length}/${plan.steps.length}`,
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
    return { draft, source_task: plan.task, section_count: sections.length };
  }

  private _runGenerate(plan: WorkflowPlan): Record<string, unknown> {
    const skillsOutput = this._getStepOutput(plan, 'match_skills') ?? {};
    const skills = (skillsOutput['skills'] as string[]).join(', ');
    return { content: `任务：${plan.task}\n采用技能：${skills || 'scene-builder'}`, task: plan.task };
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
    return { answer: `已接收任务：${plan.task}。建议按步骤执行并在关键节点创建检查点。`, task: plan.task };
  }

  // ---- Observability ----

  private _createObservabilityBaseline(): Record<string, unknown> {
    return {
      wave: 5, mode: OBSERVABILITY_MODES[0], upgrade_target: OBSERVABILITY_MODES[0],
      upgrade_reason: 'baseline', mode_changed: false, threshold_triggered: false,
      aggregate: { completed_steps: 0, failed_steps: 0, retry_count: 0, convergence_rounds: 0, mttr: 0.0, completion_rate: 0.0, failure_rate: 0.0 },
    };
  }

  private _refreshObservability(plan: WorkflowPlan): Record<string, unknown> {
    const current = { ...(plan.observability as Record<string, unknown> || this._createObservabilityBaseline()) };
    const completedSteps = plan.steps.filter(s => this._canonicalStepStatus(s.status) === 'done').length;
    const failedSteps = plan.steps.filter(s => this._canonicalStepStatus(s.status) === 'failed').length;
    const totalSteps = plan.steps.length || 1;
    const completionRate = Math.round((completedSteps / totalSteps) * 10000) / 100;
    const failureRate = Math.round((failedSteps / totalSteps) * 10000) / 100;

    const aggregate = { completed_steps: completedSteps, failed_steps: failedSteps, retry_count: Math.max(0, failedSteps - 1), convergence_rounds: completedSteps + Math.max(0, failedSteps - 1), mttr: 0.0, completion_rate: completionRate, failure_rate: failureRate };
    current['aggregate'] = aggregate;
    current['mode'] = OBSERVABILITY_MODES[0];
    plan.observability = current;
    return current;
  }

  // ---- Budget Guardrail ----

  private _createBudgetGuardrailBaseline(): Record<string, unknown> {
    return { token_budget: WAVE6_BUDGET_GUARDRAIL.token_budget, time_budget_minutes: WAVE6_BUDGET_GUARDRAIL.time_budget_minutes, token_used: 0, elapsed_minutes: 0.0, threshold_triggered: false, degraded: false, degrade_mode: '', reason: 'within budget' };
  }

  private _refreshBudgetGuardrail(plan: WorkflowPlan): Record<string, unknown> {
    const current = { ...(plan.budget_guardrail as Record<string, unknown> || this._createBudgetGuardrailBaseline()) };
    const tokenUsed = plan.steps.reduce((sum, s) => sum + (s.description?.length ?? 0), 0) + (plan.task?.length ?? 0);
    const createdAt = new Date(plan.created_at);
    const elapsedMinutes = Math.round(Math.max((Date.now() - createdAt.getTime()) / 60000, 0) * 100) / 100;
    const tokenBudget = Number(current['token_budget'] ?? WAVE6_BUDGET_GUARDRAIL.token_budget);
    const timeBudget = Number(current['time_budget_minutes'] ?? WAVE6_BUDGET_GUARDRAIL.time_budget_minutes);
    const overBudget = tokenUsed >= tokenBudget || elapsedMinutes >= timeBudget;

    current['token_used'] = tokenUsed;
    current['elapsed_minutes'] = elapsedMinutes;
    current['threshold_triggered'] = overBudget;
    current['degraded'] = overBudget;
    current['degrade_mode'] = overBudget ? ECO_MODE_LABEL : '';
    current['reason'] = overBudget ? 'budget threshold breached' : 'within budget';

    plan.budget_guardrail = current;
    if (overBudget) plan.template_meta['execution_mode'] = ECO_MODE_LABEL;
    return current;
  }

  private _resolveExecutionMode(plan: WorkflowPlan, observabilityMode: string): string {
    if ((plan.budget_guardrail as Record<string, unknown>)?.['degraded']) return ECO_MODE_LABEL;
    return observabilityMode;
  }

  // ---- Quality Metrics ----

  private _buildQualityMetrics(task: string): Record<string, number> {
    const taskLength = (task ?? '').length;
    const passRate = taskLength < 80 ? 92.0 : 86.0;
    const riskScore = /维护|maintenance|回收|修复/i.test(task ?? '') ? 0.82 : 0.38;
    const recoveryLatency = taskLength >= 100 ? 280.0 : 120.0;
    return { pass_rate: Math.round(passRate * 100) / 100, risk_score: Math.round(riskScore * 100) / 100, recovery_latency: Math.round(recoveryLatency * 100) / 100 };
  }

  private _determineLane(metrics: Record<string, number>): string {
    if ((metrics['risk_score'] ?? 0) >= 0.75 || (metrics['recovery_latency'] ?? 0) >= 240.0 || (metrics['pass_rate'] ?? 100) < 88.0) return 'maintenance';
    return 'default';
  }

  private _resolveAdaptiveLevel(level: number, lane: string, metrics: Record<string, number>): number {
    if (lane !== 'maintenance') return level;
    if ((metrics['risk_score'] ?? 0) >= 0.9 || (metrics['pass_rate'] ?? 100) < 80.0) return WorkflowLevel.L5_COORDINATOR;
    if ((metrics['risk_score'] ?? 0) >= 0.75 || (metrics['recovery_latency'] ?? 0) >= 240.0) return WorkflowLevel.L4_BRAINSTORM;
    if ((metrics['pass_rate'] ?? 100) < 88.0) return WorkflowLevel.L3_STANDARD;
    return level;
  }

  private _resolveGateProfile(level: number, lane: string, metrics: Record<string, number>): string {
    if (lane === 'maintenance') {
      if ((metrics['risk_score'] ?? 0) >= 0.9) return 'maintenance-hard';
      if ((metrics['risk_score'] ?? 0) >= 0.75 || (metrics['recovery_latency'] ?? 0) >= 240.0) return 'maintenance-selective-hard';
      return 'maintenance-soft';
    }
    return (TEMPLATE_METADATA_MAP[level] as Record<string, unknown>)?.['gate_profile'] as string ?? 'default-soft';
  }

  // ---- State Transitions ----

  private _canonicalStepStatus(status: string): string {
    return STEP_LEGACY_TO_CANONICAL[status] ?? status;
  }

  private _remainingSteps(plan: WorkflowPlan): number {
    return plan.steps.filter(s => this._canonicalStepStatus(s.status) !== 'done').length;
  }

  private _transitionStepState(plan: WorkflowPlan, step: WorkflowStep, targetStatus: string, reason: string): void {
    const current = this._canonicalStepStatus(step.status);
    const target = this._canonicalStepStatus(targetStatus);
    if (target !== current && !(STEP_ALLOWED_TRANSITIONS[current]?.has(target))) {
      throw new Error(`Invalid step transition: ${current} -> ${target}`);
    }
    step.status = target;
    const now = new Date().toISOString();
    if (target === 'executing' && !step.started_at) step.started_at = now;
    if (['done', 'failed'].includes(target)) step.completed_at = now;
    this._persistPlanState(plan, target);
  }

  private _setRunnerState(plan: WorkflowPlan, targetState: string, checkpointId?: string, transitionReason: string = ''): Record<string, unknown> {
    const currentState = plan.runner_state;
    const allowed = RUNNER_ALLOWED_TRANSITIONS[currentState];
    if (targetState !== currentState && !allowed?.has(targetState)) {
      throw new Error(`Invalid runner transition: ${currentState} -> ${targetState}`);
    }
    plan.runner_state = targetState;
    if (targetState === 'running' && plan.status === 'created') plan.status = 'running';
    if (targetState === 'stopped' && !['completed', 'failed'].includes(plan.status)) plan.status = 'failed';
    if (transitionReason) {
      plan.template_meta['runner_transition_reason'] = transitionReason;
    }
    return this._persistPlanState(
      plan,
      String(plan.template_meta['current_phase'] ?? plan.status),
      checkpointId,
    );
  }

  private _setTriageState(plan: WorkflowPlan, targetState: string, transitionReason: string = '', actor: string = 'workflow_engine'): void {
    const currentState = plan.triage_state;
    const allowed = TRIAGE_ALLOWED_TRANSITIONS[currentState];
    if (targetState !== currentState && !allowed?.has(targetState)) {
      throw new Error(`Invalid triage transition: ${currentState} -> ${targetState}`);
    }
    if (targetState === currentState) return;
    plan.triage_state = targetState;
    if (['in_progress', 'escalated'].includes(targetState)) { plan.fix_status = 'in_progress'; if (!plan.fix_owner) plan.fix_owner = plan.id; }
    else if (targetState === 'resolved') { plan.fix_status = 'fixed'; if (!plan.fix_owner) plan.fix_owner = plan.id; }
    else if (targetState === 'rejected') { plan.fix_status = 'wont_fix'; if (!plan.fix_owner) plan.fix_owner = plan.id; }
  }

  // ---- Risk Gate ----

  private _evaluateRiskGate(level: number, step: WorkflowStep, recommendations?: Record<string, unknown>[], confirmToken?: string | null): Record<string, unknown> {
    const templateMeta = TEMPLATE_METADATA_MAP[level] ?? {};
    const risk = (templateMeta as Record<string, unknown>)['risk'] as string ?? 'low';
    const needsSoftReview = ['checkpoint', 'final_review'].includes(step.name) && ['medium', 'high'].includes(risk);
    const destructive = this._isDestructiveStep(step, recommendations);

    if (destructive) {
      const confirmed = this._hasValidConfirmToken(confirmToken ?? null);
      return { decision: confirmed ? WorkflowDecision.GO : WorkflowDecision.NO_GO, reason: confirmed ? 'destructive write confirmed, hard gate passed' : 'destructive write requires secondary confirmation', risk: 'high', blocking: !confirmed, destructive: true, confirm_required: true, confirmed };
    }
    if (needsSoftReview) {
      return { decision: WorkflowDecision.SOFT_GO, reason: `${step.name} requires soft gate review under ${risk} risk`, risk, blocking: false, destructive: false, confirm_required: false, confirmed: true };
    }
    return { decision: WorkflowDecision.GO, reason: 'soft gate passed', risk, blocking: false, destructive: false, confirm_required: false, confirmed: true };
  }

  private _isDestructiveStep(step: WorkflowStep, recommendations?: Record<string, unknown>[]): boolean {
    if (DESTRUCTIVE_STEP_NAMES.has(step.name)) return true;
    const destructiveTokens = ['overwrite', 'delete', 'remove', 'destructive', '覆盖', '删除', '移除', '破坏'];
    for (const item of recommendations ?? []) {
      const action = String(item['action'] ?? '').toLowerCase();
      const title = String(item['title'] ?? '').toLowerCase();
      if (destructiveTokens.some(t => action.includes(t) || title.includes(t))) return true;
    }
    return false;
  }

  private _hasValidConfirmToken(confirmToken: string | null | undefined): boolean {
    return typeof confirmToken === 'string' && confirmToken.trim().length > 0;
  }

  // ---- Recommendations ----

  private _canonicalizeRecommendations(recommendations?: unknown[]): Record<string, unknown>[] {
    const normalized: Record<string, unknown>[] = [];
    for (let index = 0; index < (recommendations ?? []).length; index++) {
      const raw = (recommendations ?? [])[index];
      if (typeof raw === 'object' && raw !== null) {
        const r = raw as Record<string, unknown>;
        normalized.push({
          id: `rec-${String(index + 1).padStart(2, '0')}`,
          title: String(r['title'] ?? r['name'] ?? r['recommendation'] ?? '').trim(),
          reason: String(r['reason'] ?? r['rationale'] ?? '').trim(),
          action: String(r['action'] ?? r['suggestion'] ?? r['title'] ?? `recommendation-${index + 1}`).trim(),
          target: String(r['target'] ?? '').trim(),
          params: (typeof r['params'] === 'object' ? structuredClone(r['params']) : {}) as Record<string, unknown>,
          index,
        });
      } else {
        const text = String(raw ?? '').trim();
        if (!text) continue;
        normalized.push({ id: `rec-${String(index + 1).padStart(2, '0')}`, title: text, reason: '', action: text, target: '', params: {}, index });
      }
    }
    return normalized;
  }

  private _freezeRecommendations(plan: WorkflowPlan): void {
    if (plan.recommendations_frozen) return;
    plan.recommendations = structuredClone(plan.recommendations);
    plan.recommendations_frozen = true;
  }

  // ---- Hash & Replay ----

  private _computePlanHash(plan: WorkflowPlan): string {
    const payload = JSON.stringify({
      task: plan.task,
      level: plan.level,
      steps: plan.steps.map(s => ({ name: s.name, description: s.description, dependencies: s.dependencies })),
      template_meta: plan.template_meta,
      recommendations: plan.recommendations.map(r => ({ id: r['id'], title: r['title'], action: r['action'] })),
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
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

    plan.recommendations = this._canonicalizeRecommendations(payload['recommendations'] as unknown[]);
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
    const phase = currentPhase ?? 'planned';
    plan.template_meta['current_phase'] = phase;
    const lastCheckpointId =
      checkpointId
      ?? (typeof plan.template_meta['last_checkpoint_id'] === 'string'
        ? String(plan.template_meta['last_checkpoint_id']).trim()
        : '');
    if (lastCheckpointId) {
      plan.template_meta['last_checkpoint_id'] = lastCheckpointId;
    }

    const authority = this.getPlanAuthority(plan.id);
    const sessionId = authority.sessionId ?? this.getPlanSessionId(plan.id);
    const sessionLifecycle = this.sessionManager.syncLifecycle(
      sessionId,
      plan.runner_state,
      lastCheckpointId || undefined,
    );
    plan.template_meta['session_id'] = sessionId;
    plan.template_meta['session_status'] = sessionLifecycle['status'] ?? null;

    const sessionBase =
      String(sessionLifecycle['status'] ?? '') === 'archived'
        ? this.sessionManager.archivedPath
        : this.sessionManager.activePath;
    const sessionRoot = path.join(sessionBase, sessionId);

    const checkpointTrace = Array.from(this.checkpoints.values())
      .filter((checkpoint) => checkpoint.plan_id === plan.id)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((checkpoint) => ({
        checkpoint_id: checkpoint.id,
        step_id: checkpoint.step_id,
        description: checkpoint.description,
        created_at: checkpoint.created_at,
      }));

    const snapshot: WorkflowStateSnapshot = {
      schema_version: WORKFLOW_STATE_SCHEMA_VERSION,
      schema_policy: WORKFLOW_STATE_SCHEMA_POLICY,
      plan_id: plan.id,
      task: plan.task,
      level: plan.level,
      plan_status: plan.status,
      runner_state: plan.runner_state,
      current_phase: phase,
      last_checkpoint_id: lastCheckpointId,
      state_trace_id: sessionId,
      updated_at: new Date().toISOString(),
      metadata: {
        lane: plan.lane,
        execution_mode: String(plan.template_meta['execution_mode'] ?? ''),
        quality_metrics: structuredClone(plan.quality_metrics),
        template_meta: structuredClone(plan.template_meta),
        recommendations_frozen: plan.recommendations_frozen,
        plan_hash: plan.plan_hash,
        triage_state: plan.triage_state,
        fix_status: plan.fix_status,
        fix_owner: plan.fix_owner,
        workspace_authority: {
          session_id: sessionId,
          workspace_id: authority.workspaceId,
          project_id: authority.projectId,
        },
      },
      artifacts: {
        state: path.join(sessionRoot, '.data', 'state.json'),
        handoff: path.join(sessionRoot, 'HANDOFF.md'),
        audit: path.join(sessionRoot, '.data', 'audit.jsonl'),
        snapshot_index: path.join(sessionRoot, '.data', 'snapshot-index.json'),
      },
      observability: structuredClone(plan.observability),
      budget_guardrail: structuredClone(plan.budget_guardrail),
      handoff_package: structuredClone(plan.handoff_package),
      steps: plan.steps.map((step) => ({
        id: step.id,
        name: step.name,
        status: this._canonicalStepStatus(step.status),
        started_at: step.started_at,
        completed_at: step.completed_at,
      })),
      checkpoint_trace: checkpointTrace,
    };

    this.sessionManager.write(
      sessionId,
      ContentType.STATE,
      JSON.stringify(snapshot, null, 2),
    );
    this.sessionManager.appendAudit(sessionId, {
      event: 'workflow_state_persisted',
      plan_id: plan.id,
      runner_state: plan.runner_state,
      current_phase: phase,
      checkpoint_id: lastCheckpointId || null,
      session_status: sessionLifecycle['status'] ?? null,
      workspace_authority: {
        session_id: sessionId,
        workspace_id: authority.workspaceId,
        project_id: authority.projectId,
      },
      recorded_at: snapshot.updated_at,
    });
    return sessionLifecycle;
  }

  private _stateResumeMetadata(plan: WorkflowPlan): Record<string, unknown> {
    const authority = this.getPlanAuthority(plan.id);
    const sessionId = authority.sessionId ?? this.getPlanSessionId(plan.id);
    return {
      current_phase: plan.template_meta['current_phase'] ?? plan.status,
      state_trace_id: sessionId,
      can_resume_from_checkpoint: !!plan.template_meta['last_checkpoint_id'],
      observability: plan.observability,
      budget_guardrail: plan.budget_guardrail,
      handoff_package: plan.handoff_package,
      session_status: plan.template_meta['session_status'] ?? null,
      workspace_authority: {
        session_id: sessionId,
        workspace_id: authority.workspaceId,
        project_id: authority.projectId,
      },
    };
  }

  private _persistHandoffPackage(plan: WorkflowPlan, trigger: string): Record<string, unknown> {
    const pendingSteps = plan.steps
      .filter(s => this._canonicalStepStatus(s.status) !== 'done')
      .map(s => ({ id: s.id, name: s.name, status: this._canonicalStepStatus(s.status) }));
    const blockedBy = pendingSteps.filter(s => s.status === 'failed').map(s => s.id);

    const handoff = {
      generated_at: new Date().toISOString(), trigger, plan_id: plan.id, status: plan.status,
      runner_state: plan.runner_state, triage_state: plan.triage_state, fix_status: plan.fix_status,
      fix_owner: plan.fix_owner, execution_mode: plan.template_meta['execution_mode'],
      pending_steps: pendingSteps, blocked_by: blockedBy,
      next_command: `workflow_execute(plan_id='${plan.id}')`,
    };
    plan.handoff_package = handoff;
    return handoff;
  }

  // ---- Helpers ----

  private _levelFromLabel(label: string): number {
    const map: Record<string, number> = { 'L1': 1, 'L2': 2, 'L3': 3, 'L4': 4, 'L5': 5 };
    return map[label] ?? 3;
  }
}
