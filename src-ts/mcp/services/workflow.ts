/**
 * MCP Workflow Service
 *
 * Workflow service module with 9 tools for workflow operations.
 * Ported from src/mcp/services/workflow.py
 */

import { WorkflowEngine as WorkflowEngineRuntime } from '../../workflow/workflow-engine.js';
import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToWorkflowAuthority,
  type ProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import { normalizeWorkflowAuthority } from '../../workflow/engine/authority.js';

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface WorkflowEngine {
  bindPlanAuthority?(planId: string, authority: WorkflowAuthority): WorkflowAuthority;
  getPlanAuthority?(planId: string): WorkflowAuthority;
  getCheckpoint?(checkpointId: string): WorkflowCheckpointRecord | null;
  route(task: string): Promise<Record<string, unknown>>;
  plan(
    task: string,
    level?: string | null,
    params?: { recommendations?: unknown[] | null }
  ): Promise<Record<string, unknown>>;
  execute(
    planId: string,
    stepId?: string | null,
    params?: { recommendations?: unknown[] | null; confirmToken?: string | null },
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  quickRollback(params: {
    planId: string;
    checkpointId: string;
    reason: string;
  }, authority?: WorkflowAuthority | null): Promise<Record<string, unknown>>;
  lifecycle(
    planId: string,
    action: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  createCheckpoint(
    description: string,
    autoCommit: boolean
  ): Promise<Record<string, unknown>>;
  restoreCheckpoint(
    checkpointId: string,
    params?: { confirmToken?: string | null }
  ): Promise<Record<string, unknown>>;
  listCheckpoints(limit: number): Promise<unknown[]>;
  bindPlanSession(planId: string, sessionId: string): string;
}

let workflowEngineInstance: WorkflowEngine | null = null;
const checkpointAuthorityBindings = new Map<string, WorkflowAuthority>();
const schedulerEntries = new Map<string, WorkflowSchedulerTaskRecord>();

interface WorkflowAuthority {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

interface WorkflowCheckpointSummary {
  id: string;
  description: string;
  commit_hash?: string | null;
  created_at: string;
}

interface WorkflowCheckpointRecord extends WorkflowCheckpointSummary {
  plan_id: string | null;
  step_id: string | null;
  replay_payload: Record<string, unknown>;
}

interface WorkflowEngineAuthorityBridge {
  bindPlanAuthority?: (planId: string, authority: WorkflowAuthority) => WorkflowAuthority;
  getPlanAuthority?: (planId: string) => WorkflowAuthority;
  checkpoints?: Map<string, WorkflowCheckpointRecord>;
}

type WorkflowExecutionStatus = 'completed' | 'waiting_confirmation' | 'gate_blocked';
type WorkflowSchedulerStatus = 'active' | 'paused';

interface WorkflowSchedulerTaskDefinition {
  task_id: string;
  title: string;
  task: string;
  level?: string | null;
  schedule_rule?: Record<string, unknown>;
  trigger_rule: Record<string, unknown>;
  backend_mode_policy: Record<string, unknown>;
  progression_policy: Record<string, unknown>;
}

interface WorkflowSchedulerTaskRecord extends WorkflowSchedulerTaskDefinition {
  status: WorkflowSchedulerStatus;
  created_at: string;
  updated_at: string;
  authority: WorkflowAuthority | null;
  last_run_id?: string | null;
  last_plan_id?: string | null;
  last_trigger?: 'cron' | 'event' | 'manual_run_now' | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function utcNowIso(): string {
  return new Date().toISOString();
}

function resolveWorkflowWorkspace(): string {
  const override = String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim();
  return override || process.cwd();
}

function resolveWorkflowAuthority(
  workspace?: ProjectWorkspaceContext | null,
): WorkflowAuthority | null {
  if (!workspace) return null;
  const scope = projectWorkspaceToWorkflowAuthority(workspace);
  const sessionId =
    typeof scope.sessionId === 'string' && scope.sessionId.trim()
      ? scope.sessionId.trim()
      : null;
  const workspaceId =
    typeof scope.workspaceId === 'string' && scope.workspaceId.trim()
      ? scope.workspaceId.trim()
      : null;
  const projectId =
    typeof scope.projectId === 'string' && scope.projectId.trim()
      ? scope.projectId.trim()
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

function cloneWorkflowAuthority(
  authority?: Partial<WorkflowAuthority> | null,
): WorkflowAuthority | null {
  const normalized = normalizeWorkflowAuthority(authority);
  return normalized ? { ...normalized } : null;
}

function resolveCheckpointAuthority(
  workspace?: ProjectWorkspaceContext | null,
): WorkflowAuthority | null {
  return resolveWorkflowAuthority(
    workspace
    ?? normalizeProjectWorkspaceContext({}, { workspaceRoot: resolveWorkflowWorkspace() }),
  );
}

function checkpointAuthorityMismatchError(
  checkpointId: string,
  dimension: 'workflow session' | 'workspace' | 'project',
  expected: string,
  received: string,
): string {
  return `Checkpoint '${checkpointId}' is bound to ${dimension} '${expected}' and cannot be used with '${received}'`;
}

function resolveCheckpointRequestAuthority(params: {
  checkpoint: WorkflowCheckpointRecord;
  storedAuthority: WorkflowAuthority | null;
  requestAuthority?: WorkflowAuthority | null;
}): { authority: WorkflowAuthority | null; error?: string } {
  const normalizedRequest = cloneWorkflowAuthority(params.requestAuthority);
  const storedAuthority = cloneWorkflowAuthority(params.storedAuthority);

  if (!storedAuthority) {
    if (!normalizedRequest) {
      return { authority: null };
    }
    return {
      authority: null,
      error: `Checkpoint '${params.checkpoint.id}' is not bound to workspace authority and cannot be restored from a different scope`,
    };
  }

  if (
    storedAuthority.sessionId
    && normalizedRequest?.sessionId
    && storedAuthority.sessionId !== normalizedRequest.sessionId
  ) {
    return {
      authority: null,
      error: checkpointAuthorityMismatchError(
        params.checkpoint.id,
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
      error: checkpointAuthorityMismatchError(
        params.checkpoint.id,
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
      error: checkpointAuthorityMismatchError(
        params.checkpoint.id,
        'project',
        storedAuthority.projectId,
        normalizedRequest.projectId,
      ),
    };
  }

  return {
    authority: {
      sessionId: normalizedRequest?.sessionId ?? storedAuthority.sessionId,
      workspaceId: normalizedRequest?.workspaceId ?? storedAuthority.workspaceId,
      projectId: normalizedRequest?.projectId ?? storedAuthority.projectId,
    },
  };
}

function resolveStoredCheckpointAuthority(
  engine: WorkflowEngine,
  checkpoint: WorkflowCheckpointRecord,
): WorkflowAuthority | null {
  if (checkpoint.plan_id && typeof engine.getPlanAuthority === 'function') {
    return cloneWorkflowAuthority(engine.getPlanAuthority(checkpoint.plan_id));
  }
  return cloneWorkflowAuthority(checkpointAuthorityBindings.get(checkpoint.id));
}

function normalizeSchedulerTrigger(value: unknown): 'cron' | 'event' | 'manual_run_now' | null {
  if (value === 'cron' || value === 'event' || value === 'manual_run_now') {
    return value;
  }
  return null;
}

function schedulerAuthorityMismatchError(
  taskId: string,
  dimension: 'workflow session' | 'workspace' | 'project',
  expected: string,
  received: string,
): string {
  return `Scheduler task '${taskId}' is bound to ${dimension} '${expected}' and cannot be used with '${received}'`;
}

function resolveSchedulerRequestAuthority(params: {
  taskId: string;
  storedAuthority: WorkflowAuthority | null;
  requestAuthority?: WorkflowAuthority | null;
}): { authority: WorkflowAuthority | null; error?: string } {
  const normalizedRequest = cloneWorkflowAuthority(params.requestAuthority);
  const storedAuthority = cloneWorkflowAuthority(params.storedAuthority);

  if (!storedAuthority) {
    if (!normalizedRequest) {
      return { authority: null };
    }
    return {
      authority: null,
      error: `Scheduler task '${params.taskId}' is not bound to workspace authority and cannot be used from a different scope`,
    };
  }

  if (
    storedAuthority.sessionId
    && normalizedRequest?.sessionId
    && storedAuthority.sessionId !== normalizedRequest.sessionId
  ) {
    return {
      authority: null,
      error: schedulerAuthorityMismatchError(
        params.taskId,
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
      error: schedulerAuthorityMismatchError(
        params.taskId,
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
      error: schedulerAuthorityMismatchError(
        params.taskId,
        'project',
        storedAuthority.projectId,
        normalizedRequest.projectId,
      ),
    };
  }

  return {
    authority: {
      sessionId: normalizedRequest?.sessionId ?? storedAuthority.sessionId,
      workspaceId: normalizedRequest?.workspaceId ?? storedAuthority.workspaceId,
      projectId: normalizedRequest?.projectId ?? storedAuthority.projectId,
    },
  };
}

function schedulerTaskMatchesAuthority(
  taskRecord: WorkflowSchedulerTaskRecord,
  requestAuthority: WorkflowAuthority | null,
): boolean {
  const resolved = resolveSchedulerRequestAuthority({
    taskId: taskRecord.task_id,
    storedAuthority: taskRecord.authority,
    requestAuthority,
  });
  return !resolved.error;
}

function ensureSchedulerTaskAccess(params: {
  taskId: string;
  requestAuthority: WorkflowAuthority | null;
}): { task: WorkflowSchedulerTaskRecord; authority: WorkflowAuthority | null } | { error: string } {
  const task = schedulerEntries.get(params.taskId);
  if (!task) {
    return { error: `Scheduler task '${params.taskId}' not found` };
  }

  const resolved = resolveSchedulerRequestAuthority({
    taskId: params.taskId,
    storedAuthority: task.authority,
    requestAuthority: params.requestAuthority,
  });

  if (resolved.error) {
    return { error: resolved.error };
  }

  return {
    task,
    authority: resolved.authority,
  };
}

function parseSchedulerTaskDefinition(input: unknown): WorkflowSchedulerTaskDefinition | null {
  const record = asRecord(input);
  if (!record) return null;

  const taskId = readString(record.task_id);
  const title = readString(record.title);
  const task = readString(record.task);

  const triggerRule = asRecord(record.trigger_rule);
  const backendModePolicy = asRecord(record.backend_mode_policy);
  const progressionPolicy = asRecord(record.progression_policy);

  if (!taskId || !title || !task || !triggerRule || !backendModePolicy || !progressionPolicy) {
    return null;
  }

  const scheduleRule = asRecord(record.schedule_rule);
  const level = readString(record.level);

  return {
    task_id: taskId,
    title,
    task,
    level,
    schedule_rule: scheduleRule ?? undefined,
    trigger_rule: { ...triggerRule },
    backend_mode_policy: { ...backendModePolicy },
    progression_policy: { ...progressionPolicy },
  };
}

function getEngine(): WorkflowEngine | null {
  if (!workflowEngineInstance) {
    const engine = new WorkflowEngineRuntime(resolveWorkflowWorkspace(), 'mcp-workflow');
    const engineWithAuthority = engine as unknown as WorkflowEngineAuthorityBridge;
    workflowEngineInstance = {
      bindPlanAuthority(planId: string, authority: WorkflowAuthority) {
        if (typeof engineWithAuthority.bindPlanAuthority === 'function') {
          return engineWithAuthority.bindPlanAuthority(planId, authority);
        }
        if (authority.sessionId) {
          engine.bindPlanSession(planId, authority.sessionId);
        }
        return authority;
      },
      getPlanAuthority(planId: string) {
        if (typeof engineWithAuthority.getPlanAuthority === 'function') {
          return engineWithAuthority.getPlanAuthority(planId);
        }
        return {
          sessionId: null,
          workspaceId: null,
          projectId: null,
        };
      },
      getCheckpoint(checkpointId: string) {
        const checkpoint = engineWithAuthority.checkpoints?.get(checkpointId);
        if (!checkpoint) {
          return null;
        }
        return {
          id: checkpoint.id,
          description: checkpoint.description,
          commit_hash: checkpoint.commit_hash ?? null,
          created_at: checkpoint.created_at,
          plan_id: checkpoint.plan_id ?? null,
          step_id: checkpoint.step_id ?? null,
          replay_payload: checkpoint.replay_payload ?? {},
        };
      },
      route(task: string) {
        return engine.route(task);
      },
      plan(task: string, level?: string | null, params?: { recommendations?: unknown[] | null }) {
        return engine.plan(task, level ?? undefined, params?.recommendations ?? undefined);
      },
      execute(
        planId: string,
        stepId?: string | null,
        params?: { recommendations?: unknown[] | null; confirmToken?: string | null },
        authority?: WorkflowAuthority | null,
      ) {
        if (authority) {
          return engine.execute(
            planId,
            stepId ?? undefined,
            params?.recommendations ?? undefined,
            params?.confirmToken ?? undefined,
            authority,
          );
        }
        return engine.execute(
          planId,
          stepId ?? undefined,
          params?.recommendations ?? undefined,
          params?.confirmToken ?? undefined,
        );
      },
      quickRollback(
        params: { planId: string; checkpointId: string; reason: string },
        authority?: WorkflowAuthority | null,
      ) {
        if (authority) {
          return engine.quickRollback(
            params.planId,
            params.checkpointId,
            params.reason,
            authority,
          );
        }
        return engine.quickRollback(params.planId, params.checkpointId, params.reason);
      },
      lifecycle(planId: string, action: string, authority?: WorkflowAuthority | null) {
        if (authority) {
          return engine.lifecycle(planId, action, undefined, authority);
        }
        return engine.lifecycle(planId, action);
      },
      createCheckpoint(description: string, autoCommit: boolean) {
        return engine.createCheckpoint(description, autoCommit);
      },
      restoreCheckpoint(checkpointId: string, params?: { confirmToken?: string | null }) {
        return engine.restoreCheckpoint(checkpointId, params?.confirmToken ?? undefined);
      },
      listCheckpoints(limit: number) {
        return engine.listCheckpoints(limit);
      },
      bindPlanSession(planId: string, sessionId: string) {
        return engine.bindPlanSession(planId, sessionId);
      },
    };
  }
  return workflowEngineInstance;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function workflowRoute(task: string): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { level: 'L1', reason: 'Workflow engine unavailable' };
  return engine.route(task);
}

export async function workflowPlan(params: {
  task: string;
  level?: string | null;
  recommendations?: unknown[] | null;
  genre?: string | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  // Merge genre-specific recommendations if applicable
  let mergedRecommendations = params.recommendations ?? [];

  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  const result = await engine.plan(params.task, params.level, { recommendations: mergedRecommendations });
  const planId = result['plan_id'];
  const authority = resolveWorkflowAuthority(params.workspace);
  if (typeof planId === 'string' && planId && authority) {
    if (engine.bindPlanAuthority) {
      engine.bindPlanAuthority(planId, authority);
    } else if (authority.sessionId) {
      engine.bindPlanSession(planId, authority.sessionId);
    }
  }
  return result;
}

export async function workflowExecute(params: {
  planId: string;
  stepId?: string | null;
  recommendations?: unknown[] | null;
  confirmToken?: string | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  const authority = resolveWorkflowAuthority(params.workspace);
  return engine.execute(params.planId, params.stepId ?? null, {
    recommendations: params.recommendations ?? null,
    confirmToken: params.confirmToken ?? null,
  }, authority);
}

export async function workflowQuickRollback(params: {
  planId: string;
  checkpointId: string;
  reason?: string;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  const authority = resolveWorkflowAuthority(params.workspace);
  return engine.quickRollback({
    planId: params.planId,
    checkpointId: params.checkpointId,
    reason: params.reason ?? '',
  }, authority);
}

export async function workflowLifecycle(
  planId: string,
  action = 'status',
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  const authority = resolveWorkflowAuthority(workspace);
  return engine.lifecycle(planId, action, authority);
}

export async function workflowSchedulerRegister(params: {
  definition?: unknown;
  enabled?: boolean | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const definition = parseSchedulerTaskDefinition(params.definition);
  if (!definition) {
    return { error: 'Invalid scheduler task definition' };
  }

  const now = utcNowIso();
  const existing = schedulerEntries.get(definition.task_id);
  const authority = resolveWorkflowAuthority(params.workspace);

  if (existing) {
    const resolved = resolveSchedulerRequestAuthority({
      taskId: existing.task_id,
      storedAuthority: existing.authority,
      requestAuthority: authority,
    });
    if (resolved.error) {
      return { error: resolved.error };
    }
  }

  const triggerRule = asRecord(definition.trigger_rule);
  const scheduleRule = asRecord(definition.schedule_rule);
  const triggerFromDefinition = normalizeSchedulerTrigger(
    triggerRule?.type ?? scheduleRule?.cadence,
  );

  const status: WorkflowSchedulerStatus = readBoolean(params.enabled) === false ? 'paused' : 'active';
  const taskRecord: WorkflowSchedulerTaskRecord = {
    ...definition,
    status,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    authority,
    last_run_id: existing?.last_run_id ?? null,
    last_plan_id: existing?.last_plan_id ?? null,
    last_trigger: existing?.last_trigger ?? triggerFromDefinition,
  };

  schedulerEntries.set(taskRecord.task_id, taskRecord);

  return {
    status: existing ? 'updated' : 'registered',
    task: taskRecord,
  };
}

export async function workflowSchedulerList(params: {
  limit?: number;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const authority = resolveWorkflowAuthority(params.workspace);
  const entries = [...schedulerEntries.values()]
    .filter((item) => schedulerTaskMatchesAuthority(item, authority))
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  const limit = typeof params.limit === 'number' && Number.isFinite(params.limit)
    ? Math.max(0, Math.floor(params.limit))
    : 50;

  return {
    total: entries.length,
    tasks: entries.slice(0, limit),
  };
}

export async function workflowSchedulerPause(params: {
  taskId: string;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const authority = resolveWorkflowAuthority(params.workspace);
  const accessible = ensureSchedulerTaskAccess({
    taskId: params.taskId,
    requestAuthority: authority,
  });
  if ('error' in accessible) {
    return { error: accessible.error };
  }

  const updated: WorkflowSchedulerTaskRecord = {
    ...accessible.task,
    status: 'paused',
    updated_at: utcNowIso(),
    authority: accessible.authority,
  };
  schedulerEntries.set(updated.task_id, updated);

  return {
    status: 'paused',
    task: updated,
  };
}

export async function workflowSchedulerResume(params: {
  taskId: string;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const authority = resolveWorkflowAuthority(params.workspace);
  const accessible = ensureSchedulerTaskAccess({
    taskId: params.taskId,
    requestAuthority: authority,
  });
  if ('error' in accessible) {
    return { error: accessible.error };
  }

  const updated: WorkflowSchedulerTaskRecord = {
    ...accessible.task,
    status: 'active',
    updated_at: utcNowIso(),
    authority: accessible.authority,
  };
  schedulerEntries.set(updated.task_id, updated);

  return {
    status: 'active',
    task: updated,
  };
}

export async function workflowSchedulerRunNow(params: {
  taskId: string;
  confirmToken?: string | null;
  recommendations?: unknown[] | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const authority = resolveWorkflowAuthority(params.workspace);
  const accessible = ensureSchedulerTaskAccess({
    taskId: params.taskId,
    requestAuthority: authority,
  });
  if ('error' in accessible) {
    return { error: accessible.error };
  }

  const taskRecord = accessible.task;
  if (taskRecord.status !== 'active') {
    return { error: `Scheduler task '${taskRecord.task_id}' is paused` };
  }

  const planResult = await workflowPlan({
    task: taskRecord.task,
    level: taskRecord.level ?? null,
    workspace: params.workspace,
    recommendations: params.recommendations ?? null,
  });

  const planId = readString(planResult['plan_id']);
  if (!planId) {
    return {
      error: readString(planResult['error']) ?? 'Failed to create workflow plan from scheduler task',
      task: taskRecord,
      plan: planResult,
    };
  }

  const executeResult = await workflowExecute({
    planId,
    confirmToken: params.confirmToken ?? null,
    recommendations: params.recommendations ?? null,
    workspace: params.workspace,
  });

  const executionStatus = readString(executeResult['status']) as WorkflowExecutionStatus | null;
  const runId = `scheduler-run-${taskRecord.task_id}-${Date.now()}`;
  const updatedTask: WorkflowSchedulerTaskRecord = {
    ...taskRecord,
    updated_at: utcNowIso(),
    authority: accessible.authority,
    last_plan_id: planId,
    last_run_id: runId,
    last_trigger: 'manual_run_now',
  };
  schedulerEntries.set(updatedTask.task_id, updatedTask);

  return {
    status: executionStatus ?? 'completed',
    trigger: 'manual_run_now',
    run_id: runId,
    plan_id: planId,
    task: updatedTask,
    execute: executeResult,
  };
}

export async function checkpointCreate(
  description = '',
  autoCommit = true,
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  const result = await engine.createCheckpoint(description, autoCommit);
  const checkpointId = typeof result['checkpoint_id'] === 'string' ? result['checkpoint_id'] : null;
  const authority = resolveCheckpointAuthority(workspace);
  if (checkpointId && authority) {
    checkpointAuthorityBindings.set(checkpointId, authority);
  }
  return result;
}

export async function checkpointRestore(
  checkpointId: string,
  confirmToken?: string | null,
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  const checkpoint = engine.getCheckpoint?.(checkpointId) ?? null;
  if (!checkpoint) {
    return { error: `Checkpoint '${checkpointId}' not found` };
  }
  const storedAuthority = resolveStoredCheckpointAuthority(engine, checkpoint);
  const authority = resolveCheckpointAuthority(workspace);
  const resolvedAuthority = resolveCheckpointRequestAuthority({
    checkpoint,
    storedAuthority,
    requestAuthority: authority,
  });
  if (resolvedAuthority.error) {
    return { error: resolvedAuthority.error };
  }
  return engine.restoreCheckpoint(checkpointId, { confirmToken: confirmToken ?? null });
}

export async function checkpointList(
  limit = 10,
  workspace?: ProjectWorkspaceContext,
): Promise<WorkflowCheckpointSummary[]> {
  const engine = getEngine();
  if (!engine) return [];
  const authority = resolveCheckpointAuthority(workspace);
  const checkpoints = await engine.listCheckpoints(limit) as WorkflowCheckpointSummary[];
  return checkpoints.filter((summary) => {
    const checkpoint = engine.getCheckpoint?.(summary.id) ?? null;
    if (!checkpoint) {
      return false;
    }
    const storedAuthority = resolveStoredCheckpointAuthority(engine, checkpoint);
    return !resolveCheckpointRequestAuthority({
      checkpoint,
      storedAuthority,
      requestAuthority: authority,
    }).error;
  });
}
