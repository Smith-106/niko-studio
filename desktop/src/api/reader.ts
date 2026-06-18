import { type ApiResponse, callApi } from './core'

// ============================================================
// Types (aligned with backend ConsensusEngine.ts & OverlayBridge.ts)
// ============================================================

export interface ConsensusItem {
  description: string
  dimension: string
  agreeingPersonas: string[]
  disagreeingPersonas: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  consensusStrength: number
  location: { chapter?: string; paragraph?: number }
}

export interface ConsensusReport {
  items: ConsensusItem[]
  overallAssessment: string
  criticalIssues: ConsensusItem[]
  dissentItems: ConsensusItem[]
  dimensionSummaries: Record<string, { avgScore: number; consensus: number }>
}

export interface ReaderReaction {
  personaId: string
  personaName: string
  dimensions: Record<string, number>
  highlights: Array<{
    text: string
    position: { chapter: string; paragraph: number }
    reaction: 'positive' | 'negative' | 'neutral'
    comment: string
    dimension: string
  }>
  overallScore: number
}

export interface EditorialAnalysis {
  structuralIssues: string[]
  styleNotes: string[]
  pacingAssessment: string
  recommendations: string[]
}

export interface DimensionScore {
  dimension: string
  score: number
  weight: number
}

export interface PersonaDimensionScore {
  personaId: string
  personaName: string
  scores: DimensionScore[]
}

export interface ReaderAnalyzeResult {
  novelId: string
  readerReactions: ReaderReaction[]
  editorialAnalysis: EditorialAnalysis
  consensus: ConsensusReport
  dimensionScores: PersonaDimensionScore[]
  timestamp: string
}

export interface OverlayMarker {
  personaId: string
  personaName: string
  position: { chapter: string; paragraph: number }
  reaction: 'positive' | 'negative' | 'neutral'
  comment: string
  dimension: string
  text: string
}

export interface ReaderOverlayResult {
  novelId: string
  markers: OverlayMarker[]
  markerCount: number
  analysisTimestamp?: string
  message?: string
}

export interface ReaderPersona {
  id: string
  name: string
  description: string
  parameters: {
    plotWeight: number
    characterWeight: number
    styleWeight: number
    pacingWeight: number
    toleranceThreshold: number
    focusAreas: string[]
    biases: string[]
  }
}

export interface ReaderPersonasResult {
  presets: ReaderPersona[]
  custom: ReaderPersona[]
  totalPresetCount: number
  totalCustomCount: number
}

export interface CreateCustomPersonaParams {
  name: string
  parameters: {
    plotWeight?: number
    characterWeight?: number
    styleWeight?: number
    pacingWeight?: number
    toleranceThreshold?: number
    focusAreas?: string[]
    biases?: string[]
  }
}

export interface CreateCustomPersonaResult {
  persona: ReaderPersona
}

// ============================================================
// API Functions — direct callApi, no inner envelope
// ============================================================

/**
 * Run reader simulation analysis with specified personas.
 *
 * Calls POST /reader/analyze and returns the full analysis result
 * including reader reactions, editorial analysis, and consensus report.
 */
export async function analyzeReader(
  novelId: string,
  personaIds?: string[],
): Promise<ApiResponse<ReaderAnalyzeResult>> {
  return callApi<ReaderAnalyzeResult>('/reader/analyze', 'POST', {
    novelId,
    personaIds,
  })
}

/**
 * Get overlay markers for a novel (from the most recent analysis).
 *
 * Calls POST /reader/overlay.
 */
export async function getReaderOverlay(
  novelId: string,
): Promise<ApiResponse<ReaderOverlayResult>> {
  return callApi<ReaderOverlayResult>('/reader/overlay', 'POST', { novelId })
}

/**
 * List all available reader personas (presets + custom).
 *
 * Calls GET /reader/personas.
 */
export async function getReaderPersonas(): Promise<ApiResponse<ReaderPersonasResult>> {
  return callApi<ReaderPersonasResult>('/reader/personas', 'GET')
}

/**
 * Create a custom reader persona.
 *
 * Calls POST /reader/personas/custom.
 */
export async function createCustomPersona(
  params: CreateCustomPersonaParams,
): Promise<ApiResponse<CreateCustomPersonaResult>> {
  return callApi<CreateCustomPersonaResult>('/reader/personas/custom', 'POST', params as unknown as Record<string, unknown>)
}

// ============================================================
// Barrel export
// ============================================================

export const readerApi = {
  analyzeReader,
  getReaderOverlay,
  getReaderPersonas,
  createCustomPersona,
}
