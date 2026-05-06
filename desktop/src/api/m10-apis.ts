import { callApi } from './core'
import type { ProjectWorkspaceContext } from './workspace'

export interface MultiPassRevisionRequest extends Record<string, unknown> {
  text: string
  target_score?: number
  max_iterations?: number
  workspace?: ProjectWorkspaceContext
}

export interface MultiPassRevisionResult {
  completed: boolean
  revisedContent: string
  iterations: number
  initialScore: number
  finalScore: number
  reason: string
}

export interface StyleExtractRequest {
  text: string
}

export interface StyleApplyRequest extends Record<string, unknown> {
  text: string
  style_profile: Record<string, unknown>
  workspace?: ProjectWorkspaceContext
}

export interface CrossChapterConsistencyRequest extends Record<string, unknown> {
  chapters: Array<{ chapterNumber: number; title: string; content: string }>
  workspace?: ProjectWorkspaceContext
}

export interface ContextAwareSuggestionsRequest extends Record<string, unknown> {
  text: string
  workspace?: ProjectWorkspaceContext
}

export async function runMultiPassRevision(
  request: MultiPassRevisionRequest,
): Promise<{ success: boolean; data?: MultiPassRevisionResult; error?: string }> {
  return callApi('/agent/revise-multi-pass', 'POST', request)
}

export async function extractStyleProfile(
  text: string,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  return callApi('/style/extract', 'POST', { text })
}

export async function getStyleProfile(
  projectId: string,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  return callApi(`/style/profile/${encodeURIComponent(projectId)}`, 'GET')
}

export async function applyStyle(
  request: StyleApplyRequest,
): Promise<{ success: boolean; data?: { context: string }; error?: string }> {
  return callApi('/style/apply', 'POST', request)
}

export async function runCrossChapterConsistency(
  request: CrossChapterConsistencyRequest,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  return callApi('/consistency/cross-chapter', 'POST', request)
}

export async function getContextAwareSuggestions(
  request: ContextAwareSuggestionsRequest,
): Promise<{ success: boolean; data?: { context: string; suggestions: string[] }; error?: string }> {
  return callApi('/suggestions/context-aware', 'POST', request)
}
