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
