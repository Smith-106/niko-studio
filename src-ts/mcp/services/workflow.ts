/**
 * MCP Workflow Service
 *
 * Workflow service module with 9 tools for workflow operations.
 * Ported from src/mcp/services/workflow.py
 */

import { WorkflowEngine as WorkflowEngineRuntime } from '../../workflow/workflow-engine.js';
import {
  projectWorkspaceToWorkflowAuthority,
  type ProjectWorkspaceContext,
} from '../../project/workspace-model.js';

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface WorkflowEngine {
  bindPlanAuthority?(planId: string, authority: WorkflowAuthority): WorkflowAuthority;
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

interface WorkflowAuthority {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
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

function getEngine(): WorkflowEngine | null {
  if (!workflowEngineInstance) {
    const engine = new WorkflowEngineRuntime(resolveWorkflowWorkspace(), 'mcp-workflow');
    const engineWithAuthority = engine as WorkflowEngineRuntime & {
      bindPlanAuthority?: (planId: string, authority: WorkflowAuthority) => WorkflowAuthority;
    };
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
  autoCommit = true
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  return engine.createCheckpoint(description, autoCommit);
}

export async function checkpointRestore(
  checkpointId: string,
  confirmToken?: string | null
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  return engine.restoreCheckpoint(checkpointId, { confirmToken: confirmToken ?? null });
}

export async function checkpointList(limit = 10): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.listCheckpoints(limit);
}
