import { type ApiResponse, callApi } from './core'
import {
  appendLegacyMemoryWorkspacePayload,
  appendWorkspacePayload,
  type ProjectWorkspaceContext,
} from './workspace'
// ============ Memory API ============

export async function searchMemory(
  query: string,
  options?: {
    layer?: string
    dimensions?: string[]
    limit?: number
    entity_id?: string
    use_focus_entity?: boolean
    workspace?: ProjectWorkspaceContext
  }
): Promise<ApiResponse<Array<{ id: string; content: string; score: number }>>> {
  return callApi(
    '/memory/search',
    'POST',
    appendLegacyMemoryWorkspacePayload(
      { query, ...options },
      options?.workspace,
      { includeFocusEntity: options?.use_focus_entity === true && !options?.entity_id },
    ),
  )
}

export async function addMemory(
  content: string,
  options?: {
    layer?: string
    dimension?: string
    entity_id?: string
    use_focus_entity?: boolean
    importance?: number
    tags?: string[]
    workspace?: ProjectWorkspaceContext
  }
): Promise<ApiResponse<{ id: string; status: string }>> {
  return callApi(
    '/memory/add',
    'POST',
    appendLegacyMemoryWorkspacePayload(
      { content, ...options },
      options?.workspace,
      { includeFocusEntity: options?.use_focus_entity === true && !options?.entity_id },
    ),
  )
}

export interface MemoryUploadResponse {
  status: string
  file_name: string
  session_id: string
  chunks: number
  memory_ids: string[]
}

export async function uploadMemoryFile(
  payload: {
    file_name: string
    file_content_base64: string
    session_id: string
    chunk_size?: number
    chunk_overlap?: number
    workspace?: ProjectWorkspaceContext
  }
): Promise<ApiResponse<MemoryUploadResponse>> {
  return callApi(
    '/memory/upload',
    'POST',
    appendLegacyMemoryWorkspacePayload(payload, payload.workspace),
  )
}

export async function getTemporalFacts(
  entityId: string,
  atTime?: string,
  workspace?: ProjectWorkspaceContext
): Promise<ApiResponse<Array<{ id: string; content: string }>>> {
  return callApi(
    '/memory/temporal',
    'POST',
    appendLegacyMemoryWorkspacePayload({ entity_id: entityId, at_time: atTime }, workspace),
  )
}

// ============ Graph API ============

export async function queryGraph(
  cypher: string,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<unknown[]>> {
  return callApi('/graph/query', 'POST', appendWorkspacePayload({ cypher }, options?.workspace))
}

export async function getCharacter(
  name: string,
  includeRelations?: boolean,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<{ name: string; role: string; relationships: Record<string, string> }>> {
  return callApi(
    '/graph/character',
    'POST',
    appendWorkspacePayload({ name, include_relations: includeRelations }, options?.workspace),
  )
}

export async function getForeshadows(
  status?: string,
  chapter?: number,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<Array<{ id: string; description: string; status: string }>>> {
  return callApi(
    '/graph/foreshadows',
    'POST',
    appendWorkspacePayload({ status, chapter }, options?.workspace),
  )
}
