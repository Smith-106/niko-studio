/**
 * Narrative module shared types
 *
 * Defines the LLM client interface and common utilities
 * used by all analyzers and evaluators.
 */

/** Minimal LLM client interface used by narrative analyzers/evaluators */
export interface INarrativeLLMClient {
  generateJson<T = Record<string, unknown>>(
    prompt: string,
    options?: {
      systemPrompt?: string;
      temperature?: number;
    },
  ): Promise<T>;
}

/** Convert a numeric score (0-100) to a score level label */
export function scoreToLevel(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
}

/** Severity ordering helper (lower = more severe) */
export function severityOrder(s: string): number {
  switch (s) {
    case 'critical':
      return 0;
    case 'major':
      return 1;
    case 'minor':
      return 2;
    default:
      return 3;
  }
}
