import { type ApiResponse, callApi } from './core'

export type WritingCraftDimension =
  | 'structure'
  | 'character'
  | 'suspense'
  | 'emotion'
  | 'dialogue'
  | 'webnovel'

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

export async function analyzeWritingCraft(
  text: string,
  dimensions?: WritingCraftDimension[],
): Promise<ApiResponse<WritingCraftResult>> {
  return callApi<WritingCraftResult>('/writing-craft/analyze', 'POST', {
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
  return callApi<LLMAnalysisResult>('/writing-craft/llm-analyze', 'POST', {
    text,
    dimensions,
    ...llmConfig,
  })
}
