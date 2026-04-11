import { type ApiResponse, callApi } from './core'
import type { QualityGoalsPayload, WriterMetadata } from './chat'
import { appendWorkspacePayload, type ProjectWorkspaceContext } from './workspace'

// ============ Agent API ============

export interface AgentRouteResult {
  workflow_level: string
  workflow_level_slug?: string
  scene_type: string
  dispatched_skills: string[]
  task_assignments: Array<{
    task_id: string
    agent_type: string
    instruction: string
    skills: string[]
  }>
}

export async function agentRoute(task: string): Promise<ApiResponse<AgentRouteResult>> {
  return callApi('/agent/route', 'POST', { task })
}

export async function agentWrite(
  sceneCard: Record<string, unknown>,
  skills?: string[],
  wordTarget?: number,
  qualityGoals?: QualityGoalsPayload,
  workspace?: ProjectWorkspaceContext | null,
): Promise<ApiResponse<{ content: string; wordcount: number; writer_metadata?: WriterMetadata }>> {
  return callApi(
    '/agent/write',
    'POST',
    appendWorkspacePayload({
      scene_card: sceneCard,
      skills,
      word_target: wordTarget,
      quality_goals: qualityGoals,
    }, workspace),
  )
}

export async function agentRevise(
  draft: string,
  feedback: Record<string, unknown>,
  qualityGoals?: QualityGoalsPayload
): Promise<ApiResponse<{ content: string }>> {
  return callApi('/agent/revise', 'POST', { draft, feedback, quality_goals: qualityGoals })
}

export async function agentGetContext(
  sceneInfo: Record<string, unknown>,
  contextTypes?: string[]
): Promise<ApiResponse<Record<string, unknown>>> {
  return callApi('/agent/context', 'POST', {
    scene_info: sceneInfo,
    context_types: contextTypes,
  })
}
