import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mcp critic service branch gap additional coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../narrative/evaluators/critic-engine.js');
  });

  it('falls back non-array issue collections when mapping module score reports', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {
            moduleScores: {
              fictional_dream: 0.1,
              voice: 0.2,
              suspense: 0.3,
              character: 0.4,
              premise: 0.5,
            },
            top3Issues: 'not-an-array',
            criticalIssues: 'not-an-array',
            recommendedSkills: 'not-an-array',
            allIssues: 'not-an-array',
            overallScore: 42.31,
            summary: 'module fallback summary',
          };
        }

        async quickScan() {
          return {
            top3Issues: [],
            allIssues: [],
            overallScore: 0,
            overallLevel: 'unknown',
          };
        }
      },
    }));

    const { evaluateContent } = await import('../../mcp/services/critic.js?module-array-fallbacks');
    const result = await evaluateContent('module fallback payload');

    expect(result).toEqual({
      decision: 'REWRITE',
      total_score: 42.3,
      lock_score: 0.1,
      style_score: 0.2,
      logic_score: 0.4,
      actionable_feedback: 'module fallback summary',
      suggestions: [],
    });
  });

  it('defaults improvement suggestion limits when maxSuggestions is null', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {};
        }

        async quickScan() {
          return {
            top3Issues: [
              { message: 'issue-1', suggestion: 'suggestion-1', severity: 'high' },
              { message: 'issue-2', suggestion: 'suggestion-2', severity: 'medium' },
              { message: 'issue-3', suggestion: 'suggestion-3', severity: 'medium' },
              { message: 'issue-4', suggestion: 'suggestion-4', severity: 'low' },
              { message: 'issue-5', suggestion: 'suggestion-5', severity: 'low' },
              { message: 'issue-6', suggestion: 'suggestion-6', severity: 'low' },
            ],
            allIssues: [],
            overallScore: 0,
            overallLevel: 'unknown',
          };
        }
      },
    }));

    const { getImprovementSuggestions } = await import('../../mcp/services/critic.js?suggestion-limit-fallback');
    const result = await getImprovementSuggestions('scan me', null, null as never);

    expect(result).toHaveLength(5);
    expect(result).toEqual([
      { issue: 'issue-1', suggestion: 'suggestion-1', priority: 'high' },
      { issue: 'issue-2', suggestion: 'suggestion-2', priority: 'medium' },
      { issue: 'issue-3', suggestion: 'suggestion-3', priority: 'medium' },
      { issue: 'issue-4', suggestion: 'suggestion-4', priority: 'low' },
      { issue: 'issue-5', suggestion: 'suggestion-5', priority: 'low' },
    ]);
  });

  it('maps narrative payloads without dimensions through zero-score fallbacks', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {
            overall_score: 8.61,
            issues: ['clarify motive', 'tighten reveal'],
            recommended_skills: ['scene-revision'],
          };
        }

        async quickScan() {
          return {
            top3Issues: [],
            allIssues: [],
            overallScore: 0,
            overallLevel: 'unknown',
          };
        }
      },
    }));

    const { evaluateContent } = await import('../../mcp/services/critic.js?narrative-dimension-fallback');
    const result = await evaluateContent('narrative without dimensions');

    expect(result).toEqual({
      decision: 'APPROVED',
      total_score: 86.1,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'clarify motive;tighten reveal',
      suggestions: ['scene-revision'],
    });
  });
});
