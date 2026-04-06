/**
 * MCP Skills Service
 *
 * Skills service module with 4 tools for skill operations.
 * Ported from src/mcp/services/skills.py
 */

import {
  SkillRouter,
  TaskType,
  type SkillRecommendation as RouterSkillRecommendation,
} from '../../agents/skill-router';
import { SkillLoader } from '../../skills/skill-loader';

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

type SkillListItem = { id: string; name: string; description: string; keywords: string[] };

let skillRouterInstance: SkillRouter | null = null;
let skillLoaderInstance: SkillLoader | null = null;

function getSkillRouter(): SkillRouter {
  if (!skillRouterInstance) {
    skillRouterInstance = new SkillRouter();
  }
  return skillRouterInstance;
}

function getSkillLoader(): SkillLoader {
  if (!skillLoaderInstance) {
    skillLoaderInstance = new SkillLoader();
  }
  return skillLoaderInstance;
}

function mapRecommendation(rec: RouterSkillRecommendation): SkillRecommendation {
  return {
    skill_id: rec.skillId,
    skill_name: rec.skillName,
    relevance: rec.relevance,
    reason: rec.reason,
    priority: rec.priority,
  };
}

function normalizeTaskType(taskType?: string | null): TaskType | null {
  if (!taskType) return null;
  const normalized = taskType.trim().toLowerCase();
  const values = Object.values(TaskType) as string[];
  return values.includes(normalized) ? (normalized as TaskType) : null;
}

function dedupeRecommendations(items: SkillRecommendation[]): SkillRecommendation[] {
  const byId = new Map<string, SkillRecommendation>();

  for (const item of items) {
    const existing = byId.get(item.skill_id);
    if (
      !existing ||
      item.relevance > existing.relevance ||
      (item.relevance === existing.relevance && item.priority < existing.priority)
    ) {
      byId.set(item.skill_id, item);
    }
  }

  return [...byId.values()].sort((left, right) =>
    right.relevance - left.relevance || left.priority - right.priority || left.skill_id.localeCompare(right.skill_id),
  );
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function skillsList(
  category?: string | null
): Promise<SkillListItem[]> {
  const loader = getSkillLoader();
  const summaries = loader.getSummaryDict() as Array<Record<string, unknown>>;
  const normalizedCategory = (category ?? '').trim().toLowerCase();

  const items = summaries.map((item) => ({
    id: String(item.name ?? ''),
    name: String(item.name ?? ''),
    description: String(item.description ?? ''),
    keywords: [
      ...(Array.isArray(item.tags) ? item.tags : []).map((tag) => String(tag)),
      ...(Array.isArray(item.triggers) ? item.triggers : []).map((trigger) => String(trigger)),
    ],
  }));

  if (!normalizedCategory) {
    return items;
  }

  return items.filter((item) =>
    item.id.toLowerCase().includes(normalizedCategory) ||
    item.name.toLowerCase().includes(normalizedCategory) ||
    item.description.toLowerCase().includes(normalizedCategory) ||
    item.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedCategory)),
  );
}

export async function skillsMatch(params: {
  taskType?: string | null;
  keywords?: string[] | null;
  issue?: string | null;
}): Promise<SkillRecommendation[]> {
  const router = getSkillRouter();
  const recommendations: SkillRecommendation[] = [];
  const taskType = normalizeTaskType(params.taskType);

  if (taskType) {
    recommendations.push(...router.routeByTaskType(taskType).map(mapRecommendation));
  }

  if (Array.isArray(params.keywords) && params.keywords.length > 0) {
    recommendations.push(...router.routeByKeywords(params.keywords).map(mapRecommendation));
  }

  if (typeof params.issue === 'string' && params.issue.trim()) {
    recommendations.push(...router.routeByIssue(params.issue.trim()).map(mapRecommendation));
  }

  return dedupeRecommendations(recommendations);
}

export async function skillsLoad(
  skillId: string
): Promise<{ id: string; content: string; metadata: Record<string, unknown> } | { error: string }> {
  const normalizedSkillId = skillId.trim();
  if (!normalizedSkillId) {
    return { error: "Skill '' not found" };
  }

  try {
    const loader = getSkillLoader();
    const loaded = loader.loadSkill(normalizedSkillId) as Record<string, unknown>;
    return {
      id: normalizedSkillId,
      content: String(loaded.content ?? ''),
      metadata: (loaded.metadata as Record<string, unknown>) ?? {},
    };
  } catch {
    return { error: `Skill '${normalizedSkillId}' not found` };
  }
}

export async function skillsGetChain(
  taskType: string
): Promise<Array<{ skill_id: string; skill_name: string; step: number; reason: string }>> {
  const normalizedTaskType = normalizeTaskType(taskType);
  if (!normalizedTaskType) {
    return [];
  }

  const router = getSkillRouter();
  return router.getSkillChain(normalizedTaskType).map((item, index) => ({
    skill_id: item.skillId,
    skill_name: item.skillName,
    step: index + 1,
    reason: item.reason,
  }));
}
