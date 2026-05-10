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
