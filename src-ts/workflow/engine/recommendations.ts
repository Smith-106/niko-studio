import * as crypto from 'crypto';
import type { WorkflowRecommendationInput } from './engine-contracts.js';

export interface WorkflowRecommendationRecord extends Record<string, unknown> {
  id: string;
  title: string;
  reason: string;
  action: string;
  target: string;
  params: Record<string, unknown>;
  index: number;
}

export interface WorkflowPlanHashable {
  task: string;
  level: string;
  steps: Array<{ name: string; description: string; dependencies: string[] }>;
  template_meta: Record<string, unknown>;
  recommendations: Record<string, unknown>[];
}

export function canonicalizeWorkflowRecommendations(
  recommendations?: WorkflowRecommendationInput,
): WorkflowRecommendationRecord[] {
  const normalized: WorkflowRecommendationRecord[] = [];
  for (let index = 0; index < (recommendations ?? []).length; index++) {
    const raw = (recommendations ?? [])[index];
    if (typeof raw === 'object' && raw !== null) {
      const record = raw as Record<string, unknown>;
      normalized.push({
        id: `rec-${String(index + 1).padStart(2, '0')}`,
        title: String(record['title'] ?? record['name'] ?? record['recommendation'] ?? '').trim(),
        reason: String(record['reason'] ?? record['rationale'] ?? '').trim(),
        action: String(record['action'] ?? record['suggestion'] ?? record['title'] ?? `recommendation-${index + 1}`).trim(),
        target: String(record['target'] ?? '').trim(),
        params: (typeof record['params'] === 'object' ? structuredClone(record['params']) : {}) as Record<string, unknown>,
        index,
      });
      continue;
    }

    const text = String(raw ?? '').trim();
    if (!text) continue;
    normalized.push({
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title: text,
      reason: '',
      action: text,
      target: '',
      params: {},
      index,
    });
  }
  return normalized;
}

export function computeWorkflowPlanHash(plan: WorkflowPlanHashable): string {
  const payload = JSON.stringify({
    task: plan.task,
    level: plan.level,
    steps: plan.steps.map((step) => ({
      name: step.name,
      description: step.description,
      dependencies: step.dependencies,
    })),
    template_meta: plan.template_meta,
    recommendations: plan.recommendations.map((recommendation) => ({
      id: recommendation['id'],
      title: recommendation['title'],
      action: recommendation['action'],
    })),
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}
