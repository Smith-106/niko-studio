/**
 * MCP Workflow Service
 *
 * Workflow service module with 9 tools for workflow operations.
 * Ported from src/mcp/services/workflow.py
 */

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface WorkflowEngine {
  route(task: string): Promise<Record<string, unknown>>;
  plan(
    task: string,
    level?: string | null,
    params?: { recommendations?: unknown[] | null }
  ): Promise<Record<string, unknown>>;
  execute(
    planId: string,
    stepId?: string | null,
    params?: { recommendations?: unknown[] | null; confirmToken?: string | null }
  ): Promise<Record<string, unknown>>;
  quickRollback(params: {
    planId: string;
    checkpointId: string;
    reason: string;
  }): Promise<Record<string, unknown>>;
  lifecycle(planId: string, action: string): Promise<Record<string, unknown>>;
  createCheckpoint(
    description: string,
    autoCommit: boolean
  ): Promise<Record<string, unknown>>;
  restoreCheckpoint(
    checkpointId: string,
    params?: { confirmToken?: string | null }
  ): Promise<Record<string, unknown>>;
  listCheckpoints(limit: number): Promise<unknown[]>;
}

function getEngine(): WorkflowEngine | null {
  // Lazy accessor -- will be wired through container / gateway
  return null;
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
}): Promise<Record<string, unknown>> {
  // Merge genre-specific recommendations if applicable
  let mergedRecommendations = params.recommendations ?? [];

  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  return engine.plan(params.task, params.level, { recommendations: mergedRecommendations });
}

export async function workflowExecute(params: {
  planId: string;
  stepId?: string | null;
  recommendations?: unknown[] | null;
  confirmToken?: string | null;
}): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  return engine.execute(params.planId, params.stepId ?? null, {
    recommendations: params.recommendations ?? null,
    confirmToken: params.confirmToken ?? null,
  });
}

export async function workflowQuickRollback(params: {
  planId: string;
  checkpointId: string;
  reason?: string;
}): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  return engine.quickRollback({
    planId: params.planId,
    checkpointId: params.checkpointId,
    reason: params.reason ?? '',
  });
}

export async function workflowLifecycle(
  planId: string,
  action = 'status'
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Workflow engine unavailable' };
  return engine.lifecycle(planId, action);
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
