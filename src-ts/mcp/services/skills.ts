/**
 * MCP Skills Service
 *
 * Skills service module with 4 tools for skill operations.
 * Ported from src/mcp/services/skills.py
 */

// ---------------------------------------------------------------
// Skill recommendation type
// ---------------------------------------------------------------

export interface SkillRecommendation {
  skill_id: string;
  skill_name: string;
  relevance: number;
  reason: string;
  priority: number;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function skillsList(
  category?: string | null
): Promise<Array<{ id: string; name: string; description: string; keywords: string[] }>> {
  // Placeholder: full implementation requires SkillRouter
  return [];
}

export async function skillsMatch(params: {
  taskType?: string | null;
  keywords?: string[] | null;
  issue?: string | null;
}): Promise<SkillRecommendation[]> {
  // Placeholder: full implementation requires SkillRouter
  return [];
}

export async function skillsLoad(
  skillId: string
): Promise<{ id: string; content: string; metadata: Record<string, unknown> } | { error: string }> {
  // Placeholder: full implementation requires SkillLoader
  return { error: `Skill '${skillId}' not found` };
}

export async function skillsGetChain(
  taskType: string
): Promise<Array<{ skill_id: string; skill_name: string; step: number; reason: string }>> {
  // Placeholder: full implementation requires SkillRouter.getSkillChain
  return [];
}
