import { type ApiResponse, callApi } from './core'
import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
  type ProjectWorkspaceContext,
} from '@/types/workspace'

export type { ProjectWorkspaceContext } from '@/types/workspace'

export interface WorkspaceContextResponse {
  workspace: ProjectWorkspaceContext
  summary: Record<string, unknown>
  compatibility: ProjectWorkspaceContext['compatibility']
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

export function normalizeWorkspaceInput(workspace?: ProjectWorkspaceContext | Record<string, unknown> | null) {
  if (!workspace) return null
  return normalizeProjectWorkspaceContext(workspace)
}

export function appendWorkspacePayload<T extends Record<string, unknown>>(
  payload: T,
  workspace?: ProjectWorkspaceContext | Record<string, unknown> | null,
): T & { workspace?: ProjectWorkspaceContext } {
  const normalizedWorkspace = normalizeWorkspaceInput(workspace)
  if (!normalizedWorkspace) return payload
  return {
    ...payload,
    workspace: normalizedWorkspace,
  }
}

export function appendLegacyChatWorkspacePayload<T extends Record<string, unknown>>(
  payload: T,
  workspace?: ProjectWorkspaceContext | Record<string, unknown> | null,
): T & { workspace?: ProjectWorkspaceContext; context?: Record<string, unknown> } {
  const normalizedWorkspace = normalizeWorkspaceInput(workspace)
  if (!normalizedWorkspace) return payload
  const existingContext = asRecord(payload.context)
  return {
    ...payload,
    context: {
      ...projectWorkspaceToLegacyChatContext(normalizedWorkspace),
      ...existingContext,
    },
    workspace: normalizedWorkspace,
  }
}

export function appendLegacyMemoryWorkspacePayload<T extends Record<string, unknown>>(
  payload: T,
  workspace?: ProjectWorkspaceContext | Record<string, unknown> | null,
): T & { workspace?: ProjectWorkspaceContext } {
  const normalizedWorkspace = normalizeWorkspaceInput(workspace)
  if (!normalizedWorkspace) return payload
  return {
    ...projectWorkspaceToMemoryScope(normalizedWorkspace),
    ...payload,
    workspace: normalizedWorkspace,
  }
}

export async function resolveWorkspaceContext(
  payload: ProjectWorkspaceContext | Record<string, unknown>,
): Promise<ApiResponse<WorkspaceContextResponse>> {
  return callApi('/workspace/context', 'POST', appendWorkspacePayload(asRecord(payload), payload))
}
