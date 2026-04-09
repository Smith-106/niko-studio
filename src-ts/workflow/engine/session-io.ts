import * as path from 'path';

import { ContentType, SessionManager } from '../session/session-manager.js';

interface WorkflowSessionContextInput {
  sessionManager: SessionManager;
  sessionId: string;
  runnerState: string;
  checkpointId?: string;
}

interface WorkflowStateArtifactsWriteInput {
  sessionManager: SessionManager;
  sessionId: string;
  snapshot: unknown;
  auditEvent: Record<string, unknown>;
}

export function syncWorkflowSessionContext(
  input: WorkflowSessionContextInput,
): { sessionLifecycle: Record<string, unknown>; sessionRoot: string } {
  const sessionLifecycle = input.sessionManager.syncLifecycle(
    input.sessionId,
    input.runnerState,
    input.checkpointId,
  );

  const sessionBase =
    String(sessionLifecycle['status'] ?? '') === 'archived'
      ? input.sessionManager.archivedPath
      : input.sessionManager.activePath;

  return {
    sessionLifecycle,
    sessionRoot: path.join(sessionBase, input.sessionId),
  };
}

export function writeWorkflowStateArtifacts(
  input: WorkflowStateArtifactsWriteInput,
): void {
  input.sessionManager.write(
    input.sessionId,
    ContentType.STATE,
    JSON.stringify(input.snapshot, null, 2),
  );
  input.sessionManager.appendAudit(input.sessionId, input.auditEvent);
}
