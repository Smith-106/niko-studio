/**
 * MCP Critic Service
 *
 * Critic service module with 3 tools for content evaluation.
 * Ported from src/mcp/services/critic.py
 */

import { CriticEngine as NarrativeCriticEngine } from '../../narrative/evaluators/critic-engine.js';

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

let criticEngineInstance: CriticEngine | null = null;

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getEngine(): CriticEngine {
  if (!criticEngineInstance) {
    const engine = new NarrativeCriticEngine();
    criticEngineInstance = {
      async evaluate(content: string, dimensions?: string[] | null, qualityGoals?: Record<string, unknown>) {
        const report = await engine.evaluate(content, {
          dimensions: dimensions ?? [],
          quality_goals: qualityGoals ?? {},
        });
        const reportRecord = asRecord(report);
        const alreadyLegacy =
          typeof reportRecord.total_score === 'number' ||
          typeof reportRecord.actionable_feedback === 'string';
        if (alreadyLegacy) {
          return reportRecord;
        }

        const alreadyNarrative =
          'dimensions' in reportRecord ||
          'overall_score' in reportRecord ||
          'recommended_skills' in reportRecord ||
          'issues' in reportRecord;
        if (alreadyNarrative) {
          return reportRecord;
        }

        const moduleScores = asRecord(reportRecord.moduleScores);
        const top3Issues = Array.isArray(reportRecord.top3Issues) ? reportRecord.top3Issues : [];
        const criticalIssues = Array.isArray(reportRecord.criticalIssues) ? reportRecord.criticalIssues : [];
        const recommendedSkills = Array.isArray(reportRecord.recommendedSkills)
          ? reportRecord.recommendedSkills
          : [];
        const allIssues = Array.isArray(reportRecord.allIssues) ? reportRecord.allIssues : [];
        const overallScore = safeNumber(reportRecord.overallScore);
        const overallLevel = typeof reportRecord.overallLevel === 'string'
          ? reportRecord.overallLevel
          : 'unknown';
        const summary = typeof reportRecord.summary === 'string'
          ? reportRecord.summary
          : 'Evaluation complete';
        const lockScore = safeNumber(moduleScores['fictional_dream']);
        const styleScore = safeNumber(moduleScores['voice']);
        const logicInputs = [
          safeNumber(moduleScores['suspense']),
          safeNumber(moduleScores['character']),
          safeNumber(moduleScores['premise']),
        ];
        const logicScore = logicInputs.reduce((sum, value) => sum + value, 0) / logicInputs.length;
        const actionableFeedback = top3Issues
          .map(issue => {
            const normalized = asRecord(issue);
            return normalized.suggestion ?? normalized.message;
          })
          .filter(Boolean)
          .join('; ') || summary;

        const decision =
          criticalIssues.length > 0
            ? 'REWRITE'
            : overallScore >= NOVEL_PASS_SCORE
              ? 'APPROVED'
              : overallScore >= NOVEL_HUMAN_REVIEW_SCORE
                ? 'REVISE'
                : 'REWRITE';

        return {
          decision,
          total_score: Math.round(overallScore * 10) / 10,
          lock_score: Math.round(lockScore * 10) / 10,
          style_score: Math.round(styleScore * 10) / 10,
          logic_score: Math.round(logicScore * 10) / 10,
          actionable_feedback: actionableFeedback,
          suggestions: recommendedSkills,
          overall_score: overallScore,
          overall_level: overallLevel,
          recommended_skills: recommendedSkills,
          issues: allIssues.map(issue => {
            const normalized = asRecord(issue);
            return typeof normalized.message === 'string' ? normalized.message : String(issue);
          }),
          dimensions: Object.fromEntries(
            Object.entries(moduleScores).map(([name, score]) => [name, { score: safeNumber(score) }]),
          ),
        };
      },
      async suggestImprovements(content: string, issues?: string[] | null, maxSuggestions?: number) {
        const report = await engine.quickScan(content);
        const suggestions = report.top3Issues
          .map(issue => ({
            issue: issue.message,
            suggestion: issue.suggestion ?? issue.message,
            priority: issue.severity,
          }))
          .filter(item => !issues || issues.length === 0 || issues.some(issue => item.issue.includes(issue)));
        return suggestions.slice(0, maxSuggestions ?? 5);
      },
      async compare(versionA: string, versionB: string) {
        const [reportA, reportB] = await Promise.all([
          engine.quickScan(versionA),
          engine.quickScan(versionB),
        ]);
        return {
          version_a: {
            score: reportA.overallScore,
            level: reportA.overallLevel,
            issues: reportA.allIssues.map(issue => issue.message),
          },
          version_b: {
            score: reportB.overallScore,
            level: reportB.overallLevel,
            issues: reportB.allIssues.map(issue => issue.message),
          },
          score_delta: Math.round((reportB.overallScore - reportA.overallScore) * 10) / 10,
          improved: reportB.overallScore >= reportA.overallScore,
        };
      },
    };
  }
  return criticEngineInstance;
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

function normalizeDecision(value: unknown, fallbackScore: number): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'REVISE' || normalized === 'REWRITE') {
    return normalized;
  }
  if (fallbackScore >= NOVEL_PASS_SCORE) return 'APPROVED';
  if (fallbackScore >= NOVEL_HUMAN_REVIEW_SCORE) return 'REVISE';
  return 'REWRITE';
}

function normalizeScore(value: unknown): number {
  const score = Number(value ?? 0);
  return Number.isFinite(score) ? Math.round(score * 10) / 10 : 0;
}

function normalizeEvaluateContentResult(raw: Record<string, unknown>): EvaluateContentResult {
  const totalScore = normalizeScore(raw.total_score);
  const actionableFeedback = raw.actionable_feedback ?? raw.summary ?? 'Evaluation complete';
  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions
    : Array.isArray(raw.recommendedSkills)
      ? raw.recommendedSkills
      : Array.isArray(raw.recommended_skills)
        ? raw.recommended_skills
        : [];
  return {
    decision: normalizeDecision(raw.decision, totalScore),
    total_score: totalScore,
    lock_score: normalizeScore(raw.lock_score),
    style_score: normalizeScore(raw.style_score),
    logic_score: normalizeScore(raw.logic_score),
    actionable_feedback: String(actionableFeedback),
    suggestions,
  };
}

export async function evaluateContent(
  content: string,
  sceneCard?: Record<string, unknown> | null,
  dimensions?: string[] | null,
  qualityGoals?: Record<string, unknown> | null
): Promise<EvaluateContentResult> {
  const engine = getEngine();

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
  if (typeof raw.total_score === 'number') {
    return normalizeEvaluateContentResult(raw);
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
  return engine.suggestImprovements(content, issues, maxSuggestions);
}

export async function compareVersions(
  versionA: string,
  versionB: string
): Promise<Record<string, unknown>> {
  const engine = getEngine();
  return engine.compare(versionA, versionB);
}
