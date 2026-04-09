export interface WorkflowStepLike {
  id: string;
  name: string;
  status: string;
  dependencies: string[];
}

interface WorkflowLifecycleReplaySource {
  id: string;
  plan_hash: string;
  recommendations: Record<string, unknown>[];
  recommendations_frozen: boolean;
  template_meta: Record<string, unknown>;
}

export function resolveExecutableWorkflowStep<T extends WorkflowStepLike>(
  steps: T[],
  stepId: string | undefined,
  canonicalizeStatus: (status: string) => string,
): { step: T | null; error?: string; allCompleted?: boolean } {
  let step: T | undefined;

  if (stepId) {
    step = steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      return { step: null, error: `Step '${stepId}' not found` };
    }
    const status = canonicalizeStatus(step.status);
    if (status !== 'planned') {
      return {
        step: null,
        error: `Step '${stepId}' is not planned (current status: ${status})`,
      };
    }
    return { step };
  }

  step = steps.find((candidate) => canonicalizeStatus(candidate.status) === 'planned');
  if (!step) {
    return { step: null, allCompleted: true };
  }
  return { step };
}

export function findIncompleteWorkflowDependency<T extends WorkflowStepLike>(
  steps: T[],
  step: T,
  canonicalizeStatus: (status: string) => string,
): string | null {
  for (const dependencyId of step.dependencies) {
    const dependency = steps.find((candidate) => candidate.id === dependencyId);
    if (dependency && canonicalizeStatus(dependency.status) !== 'done') {
      return dependencyId;
    }
  }
  return null;
}

export function resolveLifecycleTargetState(action: string): string | null {
  const targetByAction: Record<string, string> = {
    start: 'running',
    pause: 'paused',
    resume: 'running',
    stop: 'stopped',
  };
  return targetByAction[action] ?? null;
}

export function normalizeWorkflowLifecycleAction(action: string): string {
  return (action ?? '').trim().toLowerCase();
}

export function shouldCreateWorkflowPauseCheckpoint(action: string): boolean {
  return action === 'pause';
}

export function shouldPersistWorkflowHandoff(action: string): boolean {
  return action === 'pause' || action === 'stop';
}

export function buildWorkflowPauseReplayPayload(
  plan: WorkflowLifecycleReplaySource,
): Record<string, unknown> {
  return {
    plan_id: plan.id,
    plan_hash: plan.plan_hash,
    recommendations: structuredClone(plan.recommendations),
    recommendations_frozen: plan.recommendations_frozen,
  };
}

export function resolveWorkflowLifecycleSessionStatus(
  sessionLifecycle: Record<string, unknown>,
  templateMeta: Record<string, unknown>,
): string | null {
  return (sessionLifecycle['status'] as string | null | undefined)
    ?? (templateMeta['session_status'] as string | null | undefined)
    ?? null;
}

export function areAllWorkflowStepsDone<T extends Pick<WorkflowStepLike, 'status'>>(
  steps: T[],
  canonicalizeStatus: (status: string) => string,
): boolean {
  return steps.every((step) => canonicalizeStatus(step.status) === 'done');
}
