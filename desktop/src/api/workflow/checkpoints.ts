import type { ProjectWorkspaceContext } from '@/types/workspace'

import { type ApiResponse, callApi } from '../core'
import { appendWorkspacePayload } from '../workspace'
import type { WorkflowQuickRollbackResult } from './contracts'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function extractQuickRollbackError(payload: WorkflowQuickRollbackResult | undefined): string {
  const record = asRecord(payload)
  const restore = asRecord(record?.restore)
  return readString(record?.error)
    ?? readString(restore?.error)
    ?? readString(record?.message)
    ?? 'Quick rollback failed.'
}

function extractRestoreError(payload: { status?: string; error?: string } | undefined): string {
  const record = asRecord(payload)
  return readString(record?.error)
    ?? readString(record?.message)
    ?? 'Restore failed.'
}

export async function quickRollbackWorkflow(
  planId: string,
  checkpointId: string,
  reason?: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowQuickRollbackResult>> {
  const response = await callApi<WorkflowQuickRollbackResult>(
    '/workflow/rollback',
    'POST',
    appendWorkspacePayload({
      plan_id: planId,
      checkpoint_id: checkpointId,
      reason,
    }, workspace),
  )

  if (!response.success) {
    return response
  }

  if (response.data?.restored === false) {
    return {
      success: false,
      error: extractQuickRollbackError(response.data),
    }
  }

  return response
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
  const response = await callApi<{ status?: string; error?: string; message?: string }>(
    '/checkpoint/restore',
    'POST',
    appendWorkspacePayload({ checkpoint_id: checkpointId }, workspace),
  )

  if (!response.success) {
    return {
      success: false,
      error: response.error,
    }
  }

  const status = response.data?.status
  if (!status) {
    return {
      success: false,
      error: extractRestoreError(response.data),
    }
  }

  if (status !== 'restored' && status !== 'ok') {
    return {
      success: false,
      error: extractRestoreError(response.data),
    }
  }

  if (response.data?.error) {
    return {
      success: false,
      error: extractRestoreError(response.data),
    }
  }

  return {
    success: true,
    data: { status },
  }
}

export async function listCheckpoints(
  limit?: number,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<Array<{ id: string; description: string; created_at: string }>>> {
  return callApi('/checkpoint/list', 'POST', appendWorkspacePayload({ limit }, workspace))
}
