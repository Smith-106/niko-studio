import {
  defaultWorkflowAuthority,
  mergeWorkflowAuthority,
  normalizeWorkflowAuthority,
  resolveRequestedWorkflowAuthority,
  type WorkflowAuthority,
} from './authority.js';

export function normalizeWorkflowPlanId(planId: string): string {
  const normalizedPlanId = String(planId ?? '').trim();
  if (!normalizedPlanId) {
    throw new Error('planId is required');
  }
  return normalizedPlanId;
}

export function getWorkflowPlanSessionId(params: {
  planId: string;
  ensureSessionId: (planId: string) => string;
}): string {
  return params.ensureSessionId(normalizeWorkflowPlanId(params.planId));
}

export function bindWorkflowPlanSession(params: {
  planId: string;
  sessionId: string;
  planAuthorities: Map<string, WorkflowAuthority>;
  planSessions: Map<string, string>;
  ensureSessionId: (planId: string) => string;
  persistPlanState?: () => void;
}): string {
  const normalizedPlanId = normalizeWorkflowPlanId(params.planId);
  const normalizedSessionId = String(params.sessionId ?? '').trim();
  if (!normalizedSessionId) {
    return params.ensureSessionId(normalizedPlanId);
  }

  params.planSessions.set(normalizedPlanId, normalizedSessionId);
  const currentAuthority = params.planAuthorities.get(normalizedPlanId);
  params.planAuthorities.set(normalizedPlanId, {
    sessionId: normalizedSessionId,
    workspaceId: currentAuthority?.workspaceId ?? null,
    projectId: currentAuthority?.projectId ?? null,
  });
  params.persistPlanState?.();
  return normalizedSessionId;
}

export function bindWorkflowPlanAuthority(params: {
  planId: string;
  authority: WorkflowAuthority;
  planAuthorities: Map<string, WorkflowAuthority>;
  planSessions: Map<string, string>;
  ensureSessionId: (planId: string) => string;
  persistPlanState?: () => void;
}): WorkflowAuthority {
  const normalizedPlanId = normalizeWorkflowPlanId(params.planId);
  const normalizedAuthority = normalizeWorkflowAuthority(params.authority);
  const currentAuthority = params.planAuthorities.get(normalizedPlanId);
  const mergedAuthority = mergeWorkflowAuthority(
    currentAuthority ?? null,
    normalizedAuthority,
    params.ensureSessionId(normalizedPlanId),
  );

  params.planAuthorities.set(normalizedPlanId, mergedAuthority);
  if (mergedAuthority.sessionId) {
    params.planSessions.set(normalizedPlanId, mergedAuthority.sessionId);
  }
  params.persistPlanState?.();
  return { ...mergedAuthority };
}

export function getWorkflowPlanAuthority(params: {
  planId: string;
  planAuthorities: Map<string, WorkflowAuthority>;
  ensureSessionId: (planId: string) => string;
}): WorkflowAuthority {
  const normalizedPlanId = normalizeWorkflowPlanId(params.planId);
  const storedAuthority = params.planAuthorities.get(normalizedPlanId);
  if (storedAuthority) {
    return { ...storedAuthority };
  }

  return defaultWorkflowAuthority(params.ensureSessionId(normalizedPlanId));
}

export function resolveWorkflowPlanAuthority(params: {
  planId: string;
  requestAuthority?: Partial<WorkflowAuthority> | null;
  getPlanAuthority: (planId: string) => WorkflowAuthority;
  bindPlanAuthority: (planId: string, authority: WorkflowAuthority) => WorkflowAuthority;
}): { authority: WorkflowAuthority; error?: never } | { authority: null; error: string } {
  const normalizedPlanId = String(params.planId ?? '').trim();
  if (!normalizedPlanId) {
    return { authority: null, error: 'planId is required' };
  }

  const storedAuthority = params.getPlanAuthority(normalizedPlanId);
  const resolvedAuthority = resolveRequestedWorkflowAuthority(
    normalizedPlanId,
    storedAuthority,
    params.requestAuthority,
  );
  if (resolvedAuthority.error || !resolvedAuthority.authority) {
    return {
      authority: null,
      error: resolvedAuthority.error ?? 'workflow authority resolution failed',
    };
  }

  return {
    authority: params.bindPlanAuthority(normalizedPlanId, resolvedAuthority.authority),
  };
}
