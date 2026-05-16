import { type ApiResponse, callApi } from './core'

export type WritingCraftDimension =
  | 'structure'
  | 'character'
  | 'suspense'
  | 'emotion'
  | 'dialogue'
  | 'webnovel'
  | 'show_tell'
  | 'hook'
  | 'cliffhanger'

export interface DimensionResult {
  dimension: WritingCraftDimension
  label: string
  score: number
  maxScore: number
  evidence: string[]
  suggestions: string[]
  details: Record<string, unknown>
}

export interface WritingCraftResult {
  overallScore: number
  dimensions: DimensionResult[]
  textLength: number
}

// ============================================================
// Show vs Tell (TASK-001)
// ============================================================

export interface ShowTellHeatMapEntry {
  paragraphIndex: number
  showCount: number
  tellCount: number
  ratio: number
  dominantSense: string
}

export interface ShowTellAnalysisResult {
  showTellRatio: number
  showCount: number
  tellCount: number
  sensoryCoverage: {
    visual: number
    auditory: number
    tactile: number
    olfactory: number
    gustatory: number
    overall: number
  }
  abstractVsConcrete: number
  heatMap: ShowTellHeatMapEntry[]
  suggestions: string[]
}

// ============================================================
// Emotional Arc (TASK-002)
// ============================================================

export interface EmotionalArcPoint {
  chapterIndex: number
  emotionScore: number
  showTellRatio: number
  layerRichness: number
  dominantEmotion: string
  emotionalIntensity: number
}

export interface TensionDesert {
  startChapter: number
  endChapter: number
  length: number
  severity: 'low' | 'medium' | 'high'
}

export interface CurveMatch {
  curveType: string
  label: string
  similarity: number
}

export interface EmotionalArcResult {
  timeline: EmotionalArcPoint[]
  tensionDeserts: TensionDesert[]
  curveMatches: CurveMatch[]
  overallArcScore: number
  suggestions: string[]
}

// ============================================================
// Voice Consistency (TASK-003)
// ============================================================

export interface VoiceFingerprint {
  character: string
  dialogueCount: number
  sentenceLengthPreference: number
  catchphrases: string[]
  formalityLevel: number
  emotionalExpressionTendency: number
  rhetoricalHabits: string[]
  sampleDialogues: string[]
}

export interface VoiceConsistencyWarning {
  character: string
  line: string
  issue: string
  severity: 'low' | 'medium' | 'high'
}

export interface VoiceFingerprintResult {
  fingerprints: VoiceFingerprint[]
  voiceDistinctness: number
  warnings: VoiceConsistencyWarning[]
  suggestions: string[]
}

// ============================================================
// Reader Immersion (TASK-004)
// ============================================================

export interface ReaderState {
  curiosity: number
  emotionalInvestment: number
  cognitiveLoad: number
  suspenseTension: number
  immersion: number
}

export interface ChapterReaderState {
  chapterIndex: number
  state: ReaderState
  dropoutRisk: number
}

export interface ImmersionResult {
  chapterStates: ChapterReaderState[]
  averageImmersion: number
  averageDropoutRisk: number
  highRiskChapters: number[]
  trajectory: 'rising' | 'stable' | 'declining' | 'volatile'
  suggestions: string[]
}

export interface PacingPrescription {
  chapterIndex: number
  type: 'climax' | 'turning_point' | 'breathing_room' | 'foreshadow_harvest' | 'escalation'
  label: string
  priority: 'low' | 'medium' | 'high'
  reason: string
}

export interface PacingNavigatorResult {
  prescriptions: PacingPrescription[]
  pacingScore: number
  suggestions: string[]
}

interface WritingCraftEnvelope<T> {
  success: boolean
  data: T
}

async function unwrapWritingCraftResponse<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await callApi<WritingCraftEnvelope<T>>(endpoint, 'POST', body)

  if (!response.success || !response.data) {
    return response as ApiResponse<T>
  }

  if (
    typeof response.data === 'object' &&
    response.data !== null &&
    'success' in response.data &&
    'data' in response.data
  ) {
    if (!response.data.success) {
      return {
        success: false,
        error: 'Writing craft request failed.',
      }
    }

    return {
      success: true,
      data: response.data.data,
    }
  }

  return response as ApiResponse<T>
}

export async function analyzeWritingCraft(
  text: string,
  dimensions?: WritingCraftDimension[],
): Promise<ApiResponse<WritingCraftResult>> {
  return unwrapWritingCraftResponse<WritingCraftResult>('/writing-craft/analyze', {
    text,
    dimensions,
  })
}

export interface LLMAnalysisResult extends WritingCraftResult {
  source: 'llm'
}

export interface LLMConfig {
  api_key: string
  base_url: string
  model: string
}

export async function analyzeWritingCraftLLM(
  text: string,
  llmConfig: LLMConfig,
  dimensions?: WritingCraftDimension[],
): Promise<ApiResponse<LLMAnalysisResult>> {
  return unwrapWritingCraftResponse<LLMAnalysisResult>('/writing-craft/llm-analyze', {
    text,
    dimensions,
    ...llmConfig,
  })
}

export async function analyzeShowTell(
  text: string,
): Promise<ApiResponse<ShowTellAnalysisResult>> {
  return unwrapWritingCraftResponse<WritingCraftResult>('/writing-craft/analyze', {
    text,
    dimensions: ['show_tell'],
  }).then((res) => {
    if (!res.success || !res.data) {
      return res as unknown as ApiResponse<ShowTellAnalysisResult>
    }

    const dim = res.data.dimensions.find((d) => d.dimension === 'show_tell')
    if (!dim || typeof dim.details !== 'object' || dim.details === null) {
      return { success: false, error: 'Missing show_tell result.' }
    }

    return { success: true, data: dim.details as unknown as ShowTellAnalysisResult }
  })
}

export async function analyzeEmotionalArc(
  chapters: Array<{ content: string; chapterIndex: number }>,
): Promise<ApiResponse<EmotionalArcResult>> {
  return unwrapWritingCraftResponse<EmotionalArcResult>('/writing-craft/emotional-arc', {
    chapters,
  })
}

export async function analyzeVoiceConsistency(
  text: string,
): Promise<ApiResponse<VoiceFingerprintResult>> {
  return unwrapWritingCraftResponse<VoiceFingerprintResult>('/writing-craft/voice-consistency', {
    text,
  })
}

export async function analyzeReaderImmersion(
  chapters: Array<{ content: string; chapterIndex: number }>,
): Promise<ApiResponse<ImmersionResult>> {
  return unwrapWritingCraftResponse<ImmersionResult>('/writing-craft/reader-immersion', {
    chapters,
  })
}

export async function navigatePacing(
  chapters: Array<{ content: string; chapterIndex: number }>,
): Promise<ApiResponse<PacingNavigatorResult>> {
  return unwrapWritingCraftResponse<PacingNavigatorResult>('/writing-craft/pacing-navigator', {
    chapters,
  })
}

export const writingCraftApi = {
  analyzeWritingCraft,
  analyzeWritingCraftLLM,
  analyzeShowTell,
  analyzeEmotionalArc,
  analyzeVoiceConsistency,
  analyzeReaderImmersion,
  navigatePacing,
}
