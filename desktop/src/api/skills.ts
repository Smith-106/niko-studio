import { type ApiResponse, callApi } from './core'

// ============ Skills API ============

export async function listSkills(category?: string): Promise<ApiResponse<{ skills: Array<{ id: string; name: string }> }>> {
  const endpoint = category ? `/skills/list?category=${category}` : '/skills/list'
  return callApi(endpoint, 'GET')
}

export async function loadSkill(skillId: string): Promise<ApiResponse<{ id: string; content: string }>> {
  return callApi(`/skills/load`, 'POST', { skill_id: skillId })
}

export async function matchSkills(
  taskType?: string,
  keywords?: string[],
  issue?: string
): Promise<ApiResponse<Array<{ skill_id: string; relevance: number }>>> {
  return callApi('/skills/match', 'POST', { task_type: taskType, keywords, issue })
}

export async function getSkillChain(taskType: string): Promise<ApiResponse<Array<{ skill_id: string; step: number }>>> {
  return callApi('/skills/chain', 'POST', { task_type: taskType })
}

export async function createSkill(name: string, content: string): Promise<ApiResponse<{ id: string }>> {
  return callApi('/skills/create', 'POST', { name, content })
}

export async function saveSkill(skillId: string, content: string): Promise<ApiResponse<{ success: boolean }>> {
  return callApi('/skills/save', 'POST', { skill_id: skillId, content })
}

export async function deleteSkill(skillId: string): Promise<ApiResponse<{ success: boolean }>> {
  return callApi('/skills/delete', 'POST', { skill_id: skillId })
}
