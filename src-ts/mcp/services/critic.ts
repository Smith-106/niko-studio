/**
 * MCP Critic Service
 *
 * Critic service module with 3 tools for content evaluation.
 * Ported from src/mcp/services/critic.py
 */

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

/** Minimum score to pass without human review */
export const NOVEL_PASS_SCORE = 80;
/** Minimum score that triggers human review (below pass, above this = review) */
export const NOVEL_HUMAN_REVIEW_SCORE = 60;

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface CriticEngine {
  evaluate(
    content: string,
    dimensions?: string[] | null,
    qualityGoals?: Record<string, unknown>
  ): Promise<Record<string, unknown>>;
  suggestImprovements(
    content: string,
    issues?: string[] | null,
    maxSuggestions?: number
  ): Promise<unknown[]>;
  compare(versionA: string, versionB: string): Promise<Record<string, unknown>>;
}

function getEngine(): CriticEngine | null {
  // Lazy accessor -- will be wired through container / gateway
  return null;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export interface EvaluateContentResult {
  decision: string;
  total_score: number;
  lock_score: number;
  style_score: number;
  logic_score: number;
  actionable_feedback: string;
  suggestions: unknown[];
}

export async function evaluateContent(
  content: string,
  sceneCard?: Record<string, unknown> | null,
  dimensions?: string[] | null,
  qualityGoals?: Record<string, unknown> | null
): Promise<EvaluateContentResult> {
  const engine = getEngine();
  if (!engine) {
    return {
      decision: 'REVISE',
      total_score: 0,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'Critic engine unavailable',
      suggestions: [],
    };
  }

  let raw: Record<string, unknown>;
  if (qualityGoals != null) {
    try {
      raw = await engine.evaluate(content, dimensions, qualityGoals);
    } catch (exc: unknown) {
      const msg = exc instanceof Error ? exc.message : String(exc);
      if (msg.includes('unexpected keyword argument')) {
        raw = await engine.evaluate(content, dimensions);
      } else {
        throw exc;
      }
    }
  } else {
    raw = await engine.evaluate(content, dimensions);
  }

  // Legacy format: already has total_score + actionable_feedback
  if (
    typeof raw.total_score === 'number' &&
    typeof raw.actionable_feedback === 'string'
  ) {
    return raw as unknown as EvaluateContentResult;
  }

  // Narrative engine format: map to legacy structure
  const dimResult = (raw.dimensions ?? {}) as Record<string, { score: number }>;

  const dimScore = (name: string): number => {
    const value = dimResult[name]?.score ?? 0;
    return typeof value === 'number' ? value : 0;
  };

  const lockScore = dimScore('dream') * 4;
  const styleScore = dimScore('voice') * 3.5;
  const logicScore =
    Object.keys(dimResult).length > 0
      ? ((dimScore('suspense') + dimScore('character') + dimScore('premise')) / 3) * 2.5
      : 0;

  const overallScore = typeof raw.overall_score === 'number' ? raw.overall_score : 0;
  const totalScore = overallScore * 10;

  const issueList = Array.isArray(raw.issues) ? raw.issues : [];
  const feedback = issueList.length > 0 ? issueList.slice(0, 3).join(';') : 'Evaluation complete';

  const suggestions = Array.isArray(raw.recommended_skills) ? raw.recommended_skills : [];

  const decision =
    totalScore >= NOVEL_PASS_SCORE
      ? 'APPROVED'
      : totalScore >= NOVEL_HUMAN_REVIEW_SCORE
        ? 'REVISE'
        : 'REWRITE';

  return {
    decision,
    total_score: Math.round(totalScore * 10) / 10,
    lock_score: Math.round(lockScore * 10) / 10,
    style_score: Math.round(styleScore * 10) / 10,
    logic_score: Math.round(logicScore * 10) / 10,
    actionable_feedback: feedback,
    suggestions,
  };
}

export async function getImprovementSuggestions(
  content: string,
  issues?: string[] | null,
  maxSuggestions = 5
): Promise<unknown[]> {
  const engine = getEngine();
  if (!engine) return [];
  return engine.suggestImprovements(content, issues, maxSuggestions);
}

export async function compareVersions(
  versionA: string,
  versionB: string
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { error: 'Critic engine unavailable' };
  return engine.compare(versionA, versionB);
}
