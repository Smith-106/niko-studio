import { type ApiResponse, callApi } from './core'

export interface DetectedPattern {
  id: string
  name: string
  category: string
  occurrences: Array<{
    entityId: string
    entityName: string
    confidence: number
    context: string
  }>
  confidence: number
  avgSimilarity: number
}

export interface SessionCluster {
  id: string
  name: string
  description: string | null
  intent: string | null
  status: string
  createdAt: string
  updatedAt: string
  members: Array<{
    clusterId: string
    sessionId: string
    sessionType: string
    relevanceScore: number
    addedAt: string
  }>
}

export async function detectPatterns(
  category?: string,
): Promise<ApiResponse<DetectedPattern[]>> {
  return callApi('/analysis/patterns', 'POST', { category })
}

export async function clusterSessions(
  sessions: Array<{ id: string; type: string; [key: string]: unknown }>,
): Promise<ApiResponse<SessionCluster[]>> {
  return callApi('/analysis/sessions', 'POST', { sessions })
}

// 纯计算函数直通：buildPersonalizedCraftProfile 为纯计算函数，非网络 API。
// 前端通过 api 层 import 以维持 desktop/src → api/ → src-ts/ 的层级边界，沿用 writingSessionTelemetry.ts 桥接先例。
export { buildPersonalizedCraftProfile } from '../../../src-ts/analysis/personalized-craft-profile'
export type { PersonalizedCraftRecommendation } from '../../../src-ts/analysis/personalized-craft-profile'
