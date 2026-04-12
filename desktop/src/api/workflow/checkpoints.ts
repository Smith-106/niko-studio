import type { ProjectWorkspaceContext } from '@/types/workspace'

import { type ApiResponse, callApi } from '../core'
import { appendWorkspacePayload } from '../workspace'
import type { WorkflowQuickRollbackResult } from './contracts'

export async function quickRollbackWorkflow(
  planId: string,
  checkpointId: string,
  reason?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowQuickRollbackResult>> {
  return callApi(
    '/workflow/rollback',
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      checkpoint_id: checkpointId,
      reason,
    }, workspace),
  )
}

export async function createCheckpoint(
  description?: string,
  autoCommit?: boolean,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ checkpoint_id: string; commit_hash?: string }>> {
  return callApi('/checkpoint/create', 'POST', appendWorkspacePayload({
    description,
    auto_commit: autoCommit,
  }, workspace))
}

export async function restoreCheckpoint(
  checkpointId: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ status: string }>> {
  return callApi(
    '/checkpoint/restore',
    'POST',
    appendWorkspacePayload({ checkpoint_id: checkpointId }, workspace),
  )
}

export async function listCheckpoints(
  limit?: number,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<Array<{ id: string; description: string; created_at: string }>>> {
  return callApi('/checkpoint/list', 'POST', appendWorkspacePayload({ limit }, workspace))
}
