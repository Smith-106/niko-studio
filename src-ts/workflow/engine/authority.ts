export interface WorkflowAuthority {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

export function normalizeWorkflowAuthority(
  authority?: Partial<WorkflowAuthority> | null,
): WorkflowAuthority | null {
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

export function defaultWorkflowAuthority(sessionId: string): WorkflowAuthority {
  return {
    sessionId,
    workspaceId: null,
    projectId: null,
  };
}

export function mergeWorkflowAuthority(
  currentAuthority: WorkflowAuthority | null,
  incomingAuthority: WorkflowAuthority | null,
  fallbackSessionId: string,
): WorkflowAuthority {
  return {
    sessionId:
      incomingAuthority?.sessionId
      ?? currentAuthority?.sessionId
      ?? fallbackSessionId,
    workspaceId:
      incomingAuthority?.workspaceId
      ?? currentAuthority?.workspaceId
      ?? null,
    projectId:
      incomingAuthority?.projectId
      ?? currentAuthority?.projectId
      ?? null,
  };
}

export function authorityMismatchError(
  planId: string,
  dimension: 'workflow session' | 'workspace' | 'project',
  expected: string,
  received: string,
): string {
  return `Plan '${planId}' is bound to ${dimension} '${expected}' and cannot be used with '${received}'`;
}

export function resolveRequestedWorkflowAuthority(
  planId: string,
  storedAuthority: WorkflowAuthority,
  requestAuthority?: Partial<WorkflowAuthority> | null,
): { authority: WorkflowAuthority | null; error?: string } {
  const normalizedRequest = normalizeWorkflowAuthority(requestAuthority);

  if (
    storedAuthority.sessionId
    && normalizedRequest?.sessionId
    && storedAuthority.sessionId !== normalizedRequest.sessionId
  ) {
    return {
      authority: null,
      error: authorityMismatchError(
        planId,
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
      error: authorityMismatchError(
        planId,
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
      error: authorityMismatchError(
        planId,
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
