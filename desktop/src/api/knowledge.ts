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

export async function createGraphNode(
  type: string,
  name: string,
  properties?: Record<string, unknown>,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<{ id: string; status: string }>> {
  return callApi(
    '/graph/node/create',
    'POST',
    appendWorkspacePayload({ type, name, properties }, options?.workspace),
  )
}

export async function updateGraphNode(
  id: string,
  properties: Record<string, unknown>,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<{ status: string; id: string; properties: Record<string, unknown> }>> {
  return callApi(
    '/graph/node/update',
    'POST',
    appendWorkspacePayload({ id, properties }, options?.workspace),
  )
}

export async function deleteGraphNode(
  id: string,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<{ status: string; id: string }>> {
  return callApi(
    '/graph/node/delete',
    'POST',
    appendWorkspacePayload({ id }, options?.workspace),
  )
}

export async function createGraphRelation(
  fromName: string,
  toName: string,
  relationType: string,
  properties?: Record<string, unknown>,
  options?: { workspace?: ProjectWorkspaceContext },
): Promise<ApiResponse<{ id: string; status: string }>> {
  return callApi(
    '/graph/relation/create',
    'POST',
    appendWorkspacePayload(
      { from_name: fromName, to_name: toName, relation_type: relationType, properties },
      options?.workspace,
    ),
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
  },
): Promise<ApiResponse<{ success: boolean; data: ForeshadowItem }>> {
  return callApi('/foreshadow/plant', 'POST', {
    description,
    scene_id: options?.scene_id,
    importance: options?.importance,
    tags: options?.tags,
    metadata: options?.metadata,
  })
}

export async function hintForeshadow(
  id: string,
  options?: { scene_id?: string; hint_description?: string },
): Promise<ApiResponse<{ success: boolean; data: ForeshadowItem }>> {
  return callApi('/foreshadow/hint', 'POST', {
    id,
    scene_id: options?.scene_id,
    hint_description: options?.hint_description,
  })
}

export async function harvestForeshadow(
  id: string,
  options?: { scene_id?: string },
): Promise<ApiResponse<{ success: boolean; data: ForeshadowItem }>> {
  return callApi('/foreshadow/harvest', 'POST', {
    id,
    scene_id: options?.scene_id,
  })
}

export async function getForeshadowStats(): Promise<ApiResponse<{ success: boolean; data: ForeshadowStats }>> {
  return callApi('/foreshadow/stats', 'GET')
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
): Promise<ApiResponse<{ success: boolean; data: CharacterDepthAssessment }>> {
  return callApi('/character/depth', 'POST', { id })
}

export async function getCharacterProfile(
  name: string,
): Promise<ApiResponse<{ success: boolean; data: CharacterProfile }>> {
  return callApi('/character/profile', 'POST', { name })
}

export async function getCharacterRelationships(): Promise<
  ApiResponse<{ success: boolean; data: CharacterRelationshipNetwork }>
> {
  return callApi('/character/relationships', 'POST')
}

export async function validateCharacterConsistency(
  id: string,
): Promise<ApiResponse<{ success: boolean; data: { valid: boolean; issues: string[]; warnings: string[]; score: number } }>> {
  return callApi('/character/consistency', 'POST', { id })
}
