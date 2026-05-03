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
): Promise<ApiResponse<{ success: boolean; data: DetectedPattern[] }>> {
  return callApi('/analysis/patterns', 'POST', { category })
}

export async function clusterSessions(
  sessions: Array<{ id: string; type: string; [key: string]: unknown }>,
): Promise<ApiResponse<{ success: boolean; data: SessionCluster[] }>> {
  return callApi('/analysis/sessions', 'POST', { sessions })
}
