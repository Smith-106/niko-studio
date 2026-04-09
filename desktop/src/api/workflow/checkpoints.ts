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
    '/workflow/quick-rollback',
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
): Promise<ApiResponse<{ checkpoint_id: string; commit_hash?: string }>> {
  return callApi('/workflow/checkpoint/create', 'POST', {
    description,
    auto_commit: autoCommit,
  })
}

export async function restoreCheckpoint(
  checkpointId: string,
): Promise<ApiResponse<{ status: string }>> {
  return callApi('/workflow/checkpoint/restore', 'POST', { checkpoint_id: checkpointId })
}

export async function listCheckpoints(
  limit?: number,
): Promise<ApiResponse<Array<{ id: string; description: string; created_at: string }>>> {
  return callApi('/workflow/checkpoint/list', 'POST', { limit })
}
