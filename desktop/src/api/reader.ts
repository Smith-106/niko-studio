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

export interface AIFlavorIndicator {
  pattern: string
  match: string
  position: number
}

export interface AIFlavorResult {
  aiFlavorScore: number
  indicators: AIFlavorIndicator[]
  confidence: number
  evidence: string[]
  suggestions: string[]
}

export interface EditorialAnalysis {
  structuralIssues: string[]
  styleNotes: string[]
  pacingAssessment: string
  recommendations: string[]
  aiFlavor?: AIFlavorResult
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
  id: string
  type: 'consensus' | 'dissent' | 'highlight'
  dimension: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  position: { chapterId?: string; paragraphIndex?: number }
  personaCount: number
  consensusStrength: number
  personaIds: string[]
}

export interface DimensionOverlayEntry {
  avgScore: number
  markerCount: number
  worstSeverity: string
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
  type?: 'preset' | 'custom'
  parameters: {
    plotWeight: number
    characterWeight: number
    styleWeight: number
    pacingWeight: number
    toleranceThreshold: number
    focusAreas: string[]
    biases: string[]
  }
  ageGroup?: string
  culturalBackground?: string
  readingPreference?: string
  genrePreference?: string
  aiFlavorSensitivity?: number
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

export interface SubmitFeedbackParams {
  novelId: string
  personaId: string
  feedbackId: string
  action: 'helpful' | 'not_helpful' | 'ignore'
  dimension?: string
}

export interface SubmitFeedbackResult {
  novelId: string
  personaId: string
  feedbackId: string
  action: string
  dimension?: string
  updatedWeights?: Record<string, number>
  weightsChanged: boolean
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

/**
 * Submit feedback on a reader simulation result.
 *
 * Calls POST /reader/feedback to record user feedback on a specific
 * analysis result, which may trigger persona weight adjustments.
 */
export async function submitFeedback(
  params: SubmitFeedbackParams,
): Promise<ApiResponse<SubmitFeedbackResult>> {
  return callApi<SubmitFeedbackResult>('/reader/feedback', 'POST', params as unknown as Record<string, unknown>)
}

// ============================================================
// AI Flavor & De-AI & A/B Compare (GAP-04/05/06)
// ============================================================

export interface AIFlavorDetectionResult {
  novelId: string
  score: number
  indicators: AIFlavorIndicator[]
  confidence: number
  evidence: string[]
  suggestions: string[]
}

export interface DeAIRewriteResult {
  novelId: string
  originalText: string
  revisedText: string
  aiFlavorScore: number
  improvements?: {
    delta: number
    improvedDimensions: string[]
    regressedDimensions: string[]
    unchangedDimensions: string[]
  }
  suggestions: string[]
  mode: string
}

export interface ComparisonDimension {
  dimension: string
  scoreA: number
  scoreB: number
  delta: number
  winner: 'A' | 'B' | 'tie'
}

export interface ReaderCompareResult {
  novelId: string
  versionAConsensus: ConsensusReport
  versionBConsensus: ConsensusReport
  comparison: ComparisonDimension[]
  overallWinner: 'A' | 'B' | 'tie'
  versionALabel?: string
  versionBLabel?: string
}

/**
 * Detect AI-generated prose patterns in text.
 *
 * Calls POST /reader/ai-flavor.
 */
export async function detectAIFlavor(
  novelId: string,
  text?: string,
): Promise<ApiResponse<AIFlavorDetectionResult>> {
  return callApi<AIFlavorDetectionResult>('/reader/ai-flavor', 'POST', {
    novelId,
    text,
  })
}

/**
 * De-AI rewrite: detect and rewrite AI-generated prose to sound natural.
 *
 * Calls POST /reader/de-ai.
 */
export async function deAIRewrite(
  novelId: string,
  text?: string,
  mode?: 'de-ai' | 'style-shift',
  targetStyle?: string,
): Promise<ApiResponse<DeAIRewriteResult>> {
  return callApi<DeAIRewriteResult>('/reader/de-ai', 'POST', {
    novelId,
    text,
    mode,
    targetStyle,
  } as unknown as Record<string, unknown>)
}

/**
 * A/B comparison of two text versions using reader simulation.
 *
 * Calls POST /reader/compare.
 */
export async function compareReader(
  novelId: string,
  versionA: { text: string; label?: string },
  versionB: { text: string; label?: string },
  personaIds?: string[],
): Promise<ApiResponse<ReaderCompareResult>> {
  return callApi<ReaderCompareResult>('/reader/compare', 'POST', {
    novelId,
    versionA,
    versionB,
    personaIds,
  } as unknown as Record<string, unknown>)
}

// ============================================================
// Barrel export
// ============================================================

export const readerApi = {
  analyzeReader,
  getReaderOverlay,
  getReaderPersonas,
  createCustomPersona,
  submitFeedback,
  detectAIFlavor,
  deAIRewrite,
  compareReader,
}
