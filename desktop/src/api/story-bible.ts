/**
 * Story Bible & QC API — frontend wrappers for MCP endpoints
 *
 * Uses the same callApi pattern as other API modules (knowledge.ts, wiki.ts, etc.)
 */

import { type ApiResponse, callApi } from './core'
import type { ProjectWorkspaceContext } from './workspace'

// ============================================================
// Story Bible types (mirrors src-ts/knowledge/entities/story-bible-types.ts)
// ============================================================

export type SbEntityType = 'character' | 'world-rule' | 'plot-thread' | 'timeline-event'

export interface StoryBibleEntityBase {
  id: string
  novelId: string
  name: string
  createdAt: string
  updatedAt: string
  completenessScore: number
  source: 'auto-extract' | 'manual' | 'hybrid'
  metadata: Record<string, unknown>
}

export interface CharacterProfile extends StoryBibleEntityBase {
  type: 'character'
  archetype: string
  traits: Array<{ trait: string; intensity: number; evidence: string }>
  motivations: string[]
  backstory: string
  relationships: Array<{ targetId: string; type: string; description: string }>
  speechPatterns: string[]
  arcStage: string
  povAffinity: number
}

export interface WorldRule extends StoryBibleEntityBase {
  type: 'world-rule'
  category: string
  description: string
  constraints: string[]
  exceptions: string[]
  impactScope: string
  relatedEntities: string[]
}

export interface PlotThread extends StoryBibleEntityBase {
  type: 'plot-thread'
  status: string
  premise: string
  goal: string
  stakes: string
  involvedCharacters: string[]
  keyEvents: string[]
  foreshadowingRefs: string[]
  resolution: string | null
}

export interface TimelineEvent extends StoryBibleEntityBase {
  type: 'timeline-event'
  eventType: string
  timestamp: string
  chapterRef: string
  description: string
  participants: string[]
  consequences: string[]
  plotThreadRefs: string[]
  emotionalImpact: string
}

export type StoryBibleEntity = CharacterProfile | WorldRule | PlotThread | TimelineEvent

export interface ExtractionResult {
  novelId: string
  extracted: StoryBibleEntity[]
  conflicts: Array<{ type: string; message: string }>
  confidence: number
  warnings: string[]
  timestamp: string
}

export interface CompletenessReport {
  novelId: string
  overallScore: number
  byType: Record<SbEntityType, { count: number; avgScore: number }>
  missing: Array<{ type: SbEntityType; suggestion: string }>
  timestamp: string
}

// ============================================================
// QC types (mirrors src-ts/quality/types.ts)
// ============================================================

export type CreativityPreset = 'conservative' | 'balanced' | 'creative' | 'experimental'

export interface CreativitySpectrumConfig {
  value: number
  preset: CreativityPreset
  modeDefault: number
  constraints: {
    maxSentenceLength: number
    minVocabularyDiversity: number
    maxMetaphorDensity: number
    allowNonlinearStructure: boolean
    allowUnreliableNarrator: boolean
  }
}

export interface HardConstraintViolation {
  dimension: string
  severity: string
  message: string
  location: {
    chapterId?: string
    paragraphIndex?: number
    characterId?: string
  }
  evidence: string
  suggestedFix: string | null
}

export interface QCEnforcementResult {
  mode: string
  allowed: boolean
  warnings: HardConstraintViolation[]
  blocked: HardConstraintViolation[]
  creativityConfig: CreativitySpectrumConfig
}

// ============================================================
// Story Bible API
// ============================================================

export async function sbGetEntities(
  novelId: string,
  type?: SbEntityType,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ entities: StoryBibleEntity[]; count: number; novelId: string; type: string }>> {
  const body: Record<string, string> = { novelId }
  if (type) body.type = type
  return callApi('/story-bible/entities/list', 'POST', body as Record<string, unknown>)
}

export async function sbGetEntity(
  entityId: string,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ entity: StoryBibleEntity }>> {
  return callApi(`/story-bible/entity/${entityId}`, 'GET')
}

export async function sbCreateEntity(
  entity: Partial<StoryBibleEntity> & { novelId: string; name: string; type: SbEntityType },
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ entity: StoryBibleEntity }>> {
  return callApi('/story-bible/entities', 'POST', entity as Record<string, unknown>)
}

export async function sbUpdateEntity(
  entityId: string,
  updates: Partial<StoryBibleEntity>,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ entity: StoryBibleEntity }>> {
  return callApi(`/story-bible/entity/${entityId}`, 'PUT', updates as Record<string, unknown>)
}

export async function sbDeleteEntity(
  entityId: string,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ status: string; entityId: string }>> {
  return callApi(`/story-bible/entity/${entityId}`, 'DELETE')
}

export async function sbExtractFromManuscript(
  novelId: string,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<ExtractionResult>> {
  return callApi('/story-bible/extract', 'POST', { novelId })
}

export async function sbGetCompleteness(
  novelId: string,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<CompletenessReport>> {
  return callApi('/story-bible/completeness', 'POST', { novelId })
}

// ============================================================
// QC API
// ============================================================

export async function qcValidateOutput(
  text: string,
  mode: string,
  creativityConfig?: CreativitySpectrumConfig,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ result: QCEnforcementResult; cached?: boolean }>> {
  const body: Record<string, unknown> = { text, mode }
  if (creativityConfig) body.creativityConfig = creativityConfig
  return callApi('/qc/validate', 'POST', body)
}

export async function qcGetCreativityConfig(
  mode: string,
  preset?: CreativityPreset,
  customValue?: number,
  _workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<{ config: CreativitySpectrumConfig }>> {
  const body: Record<string, unknown> = { mode }
  if (preset) body.preset = preset
  if (customValue !== undefined) body.customValue = customValue
  return callApi('/qc/creativity-config', 'POST', body)
}
