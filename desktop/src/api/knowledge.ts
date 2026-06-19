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

export interface MemoryUploadErrorResponse {
  error: string
  error_code?: string
  file_name?: string
  file_type?: string
  mode?: 'sync' | 'async'
  parser?: string | null
  dependency?: string | null
  install_command?: string | null
  detail?: string
  action?: string | null
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
): Promise<ApiResponse<MemoryUploadResponse, MemoryUploadErrorResponse>> {
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

// ============ Foreshadow API ============

export interface ForeshadowItem {
  id: string
  description: string
  state: string
  planted_at: string
  planted_time: string
  hints: Array<{ id: string; scene_id: string; description: string; timestamp: string }>
  harvested_at: string | null
  harvested_time: string | null
  importance: number
  tags: string[]
  metadata: Record<string, unknown>
}

export interface ForeshadowStats {
  total: number
  by_state: { planted: number; hinted: number; harvested: number }
  total_hints: number
  avg_hints_per_foreshadow: number
  harvest_rate: number
}

export async function plantForeshadow(
  description: string,
  options?: {
    scene_id?: string
    importance?: number
    tags?: string[]
    metadata?: Record<string, unknown>
    workspace?: ProjectWorkspaceContext
  },
): Promise<ApiResponse<ForeshadowItem>> {
  return callApi('/foreshadow/plant', 'POST',
    appendWorkspacePayload({
      description,
      scene_id: options?.scene_id,
      importance: options?.importance,
      tags: options?.tags,
      metadata: options?.metadata,
    }, options?.workspace),
  )
}

export async function getForeshadowStats(
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<ForeshadowStats>> {
  return callApi('/foreshadow/stats', 'GET', undefined,
    workspace ? { 'X-Workspace-Id': workspace.identity.workspaceId } : undefined,
  )
}

// ============ Character Depth API ============

export interface CharacterDepthAssessment {
  character: string
  scores: {
    dynamicScore: number
    competenceScore: number
    eccentricityScore: number
    contrastScore: number
    dualityScore: number
  }
  depth_level: string
  suggestions: string[]
}

export interface CharacterProfile {
  id: string
  name: string
  role: string
  personality: Record<string, unknown>
  background: Record<string, unknown>
  motivation: Record<string, unknown>
  relationships: Record<string, unknown>
  growth: Record<string, unknown>
  five_dimension_score: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CharacterRelationshipNetwork {
  nodes: Array<{ id: string; name: string; role: string }>
  edges: Array<{ source: string; target: string; type: string; trust: number }>
}

export async function analyzeCharacterDepth(
  id: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<CharacterDepthAssessment>> {
  return callApi('/character/depth', 'POST', appendWorkspacePayload({ id }, workspace))
}

export async function getCharacterProfile(
  name: string,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<CharacterProfile>> {
  return callApi('/character/profile', 'POST', appendWorkspacePayload({ name }, workspace))
}

export async function getCharacterRelationships(
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<CharacterRelationshipNetwork>> {
  return callApi('/character/relationships', 'POST', appendWorkspacePayload({}, workspace))
}
