import type { ProjectWorkspaceContext } from '@/types/workspace'

import { type ApiResponse, callApi } from '../core'
import { appendWorkspacePayload } from '../workspace'
import type { WorkflowBackendMode } from './endpoints'
import { resolveWorkflowEndpoint } from './endpoints'
import type { WorkflowStateResumeMetadata } from './contracts'

export type RevisionDimension =
  | 'structure'
  | 'character'
  | 'suspense'
  | 'emotion'
  | 'dialogue'
  | 'webnovel'
  | 'hook'
  | 'cliffhanger'
  | 'show_tell'

export type RevisionSessionState =
  | 'IDLE'
  | 'ANALYZED'
  | 'SUGGESTED'
  | 'REVISED'
  | 'COMPARED'

export interface RevisionTextRange {
  start: number
  end: number
  excerpt: string
}

export interface RevisionWeakPoint {
  id: string
  dimensionId: RevisionDimension
  location: RevisionTextRange
  severity: 'critical' | 'major' | 'minor'
  description: string
  readerImpact: string
  baselineScore: number
  evidence: string[]
  catalogReference: string
}

export interface RevisionSuggestion {
  id: string
  weakPointId: string
  strategy: string
  rationale: string
  expectedOutcome: string
  example?: string
  catalogReference: string
  sourceDimensionId: RevisionDimension
  priority: 'high' | 'medium' | 'low'
}

export interface RevisionComparison {
  sessionId: string
  iterationNumber: number
  baselineScores: Partial<Record<RevisionDimension, number>>
  resultScores: Partial<Record<RevisionDimension, number>>
  delta: Partial<Record<RevisionDimension, number>>
  improvedDimensions: RevisionDimension[]
  regressedDimensions: RevisionDimension[]
  unchangedDimensions: RevisionDimension[]
  summary: string
}

export interface RevisionIteration {
  iterationNumber: number
  analyzedAt: string
  weakPoints: RevisionWeakPoint[]
  suggestions: RevisionSuggestion[]
  revisedText?: string
  appliedAt?: string
  resultScores?: Partial<Record<RevisionDimension, number>>
  comparison?: RevisionComparison
}

export interface RevisionSession {
  schemaVersion: string
  id: string
  chapterId: string
  createdAt: string
  updatedAt: string
  state: RevisionSessionState
  baselineText: string
  currentText: string
  baselineScores: Partial<Record<RevisionDimension, number>>
  iterations: RevisionIteration[]
  lastComparison?: RevisionComparison
  authority?: Record<string, unknown> | null
}

export interface WorkflowRevisionSessionResponse extends Partial<WorkflowStateResumeMetadata> {
  session_id: string
  status: RevisionSessionState
  session: RevisionSession
  baseline_scores?: Partial<Record<RevisionDimension, number>>
  iteration_number?: number
  weak_points?: RevisionWeakPoint[]
  suggestions?: RevisionSuggestion[]
  comparison?: RevisionComparison
  workspace?: ProjectWorkspaceContext
}

export interface WorkflowRevisionHistoryResponse {
  chapter_id: string
  total: number
  sessions: RevisionSession[]
  workspace?: ProjectWorkspaceContext
}

export interface WorkflowRevisionErrorResponse {
  error: string
  workspace?: ProjectWorkspaceContext
}

export async function workflowRevisionStartSession(
  chapterId: string,
  content: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionSessionResponse | WorkflowRevisionErrorResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/revision/start-session', mode),
    'POST',
    appendWorkspacePayload({
      chapter_id: chapterId,
      content,
    }, workspace),
  )
}

export async function workflowRevisionAnalyze(
  sessionId: string,
  content?: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionSessionResponse | WorkflowRevisionErrorResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/revision/analyze', mode),
    'POST',
    appendWorkspacePayload({
      session_id: sessionId,
      content: content && content.trim().length > 0 ? content : undefined,
    }, workspace),
  )
}

export async function workflowRevisionSuggest(
  sessionId: string,
  weakPointIds?: string[],
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionSessionResponse | WorkflowRevisionErrorResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/revision/suggest', mode),
    'POST',
    appendWorkspacePayload({
      session_id: sessionId,
      weak_point_ids: Array.isArray(weakPointIds) && weakPointIds.length > 0 ? weakPointIds : undefined,
    }, workspace),
  )
}

export async function workflowRevisionGenerateSuggestions(
  sessionId: string,
  weakPointIds?: string[],
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionSessionResponse | WorkflowRevisionErrorResponse>> {
  return workflowRevisionSuggest(sessionId, weakPointIds, mode, workspace)
}

export async function workflowRevisionMarkRevised(
  sessionId: string,
  revisedText: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionSessionResponse | WorkflowRevisionErrorResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/revision/mark-revised', mode),
    'POST',
    appendWorkspacePayload({
      session_id: sessionId,
      revised_text: revisedText,
    }, workspace),
  )
}

export async function workflowRevisionCompare(
  sessionId: string,
  revisedText?: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionSessionResponse | WorkflowRevisionErrorResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/revision/compare', mode),
    'POST',
    appendWorkspacePayload({
      session_id: sessionId,
      revised_text: revisedText && revisedText.trim().length > 0 ? revisedText : undefined,
    }, workspace),
  )
}

export async function workflowRevisionHistory(
  chapterId: string,
  mode?: WorkflowBackendMode,
  workspace?: ProjectWorkspaceContext,
): Promise<ApiResponse<WorkflowRevisionHistoryResponse | WorkflowRevisionErrorResponse>> {
  return callApi(
    resolveWorkflowEndpoint('/revision/history', mode),
    'POST',
    appendWorkspacePayload({
      chapter_id: chapterId,
    }, workspace),
  )
}
