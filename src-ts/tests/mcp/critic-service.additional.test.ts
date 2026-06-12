import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mcp critic service additional coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../narrative/evaluators/critic-engine.js');
  });

  it('maps narrative reports to approved legacy output and falls back to the default summary', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {
            moduleScores: {
              fictional_dream: 0.87,
              voice: 0.66,
              suspense: 0.3,
              character: 0.6,
              premise: 0.9,
            },
            top3Issues: [],
            criticalIssues: [],
            recommendedSkills: ['tighten-prose'],
            allIssues: [{ message: 'missing aftermath' }, 42],
            overallScore: 85.13,
            overallLevel: 9,
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

    const { evaluateContent } = await import('../../mcp/services/critic.js');
    const result = await evaluateContent('narrative payload');

    expect(result).toEqual({
      decision: 'APPROVED',
      total_score: 85.1,
      lock_score: 0.9,
      style_score: 0.7,
      logic_score: 0.6,
      actionable_feedback: 'Evaluation complete',
      suggestions: ['tighten-prose'],
    });
  });

  it('retries without qualityGoals on unexpected keyword argument and normalizes approved legacy decisions', async () => {
    const evaluate = vi
      .fn()
      .mockRejectedValueOnce('unexpected keyword argument quality_goals')
      .mockResolvedValueOnce({
        moduleScores: {
          fictional_dream: 0.8,
          voice: 0.7,
          suspense: 0.9,
          character: 0.8,
          premise: 0.85,
        },
        top3Issues: [],
        criticalIssues: [],
        recommendedSkills: [],
        allIssues: [],
        overallScore: 84.96,
        overallLevel: 'strong',
      });

    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        evaluate = evaluate;

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

    const { evaluateContent } = await import('../../mcp/services/critic.js');
    const result = await evaluateContent(
      'legacy payload',
      null,
      ['logic'],
      { coherence: 80 },
    );

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenNthCalledWith(1, 'legacy payload', {
      dimensions: ['logic'],
      quality_goals: { coherence: 80 },
    });
    expect(evaluate).toHaveBeenNthCalledWith(2, 'legacy payload', {
      dimensions: ['logic'],
      quality_goals: {},
    });
    expect(result).toEqual({
      decision: 'APPROVED',
      total_score: 85,
      lock_score: 0.8,
      style_score: 0.7,
      logic_score: 0.9,
      actionable_feedback: 'Evaluation complete',
      suggestions: [],
    });
  });

  it('normalizes malformed legacy payloads into rewrite decisions', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {
            total_score: 10.04,
            lock_score: 'not-a-number',
            style_score: null,
            logic_score: undefined,
            actionable_feedback: null,
            suggestions: ['still-keep'],
            decision: 'not-valid',
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

    const { evaluateContent } = await import('../../mcp/services/critic.js');
    const result = await evaluateContent('legacy rewrite');

    expect(result).toEqual({
      decision: 'REWRITE',
      total_score: 10,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'Evaluation complete',
      suggestions: ['still-keep'],
    });
  });

  it('maps sparse narrative payloads with invalid dimensions and empty issue metadata to rewrite output', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {
            dimensions: {
              dream: { score: 'bad' },
              voice: { score: undefined },
            },
            overall_score: 'bad-score',
            issues: 'not-an-array',
            recommended_skills: 'not-an-array',
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

    const { evaluateContent } = await import('../../mcp/services/critic.js');
    const result = await evaluateContent('raw narrative payload');

    expect(result).toEqual({
      decision: 'REWRITE',
      total_score: 0,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'Evaluation complete',
      suggestions: [],
    });
  });

  it('falls back legacy decisions by normalized score tiers when decision strings are invalid', async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({
        total_score: 88.04,
        lock_score: 1,
        style_score: 0.55,
        logic_score: 0.49,
        actionable_feedback: 'legacy approved',
        suggestions: ['keep'],
        decision: 'mystery',
      })
      .mockResolvedValueOnce({
        total_score: 65.01,
        lock_score: 0,
        style_score: 0,
        logic_score: 0,
        actionable_feedback: 'legacy revise',
        suggestions: [],
        decision: 'mystery',
      })
      .mockResolvedValueOnce({
        total_score: 59.99,
        lock_score: 0,
        style_score: 0,
        logic_score: 0,
        actionable_feedback: 'legacy rewrite',
        suggestions: [],
        decision: 'mystery',
      });

    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        evaluate = evaluate;

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

    const { evaluateContent } = await import('../../mcp/services/critic.js');

    await expect(evaluateContent('legacy approved')).resolves.toEqual({
      decision: 'APPROVED',
      total_score: 88,
      lock_score: 1,
      style_score: 0.6,
      logic_score: 0.5,
      actionable_feedback: 'legacy approved',
      suggestions: ['keep'],
    });
    await expect(evaluateContent('legacy revise')).resolves.toEqual({
      decision: 'REVISE',
      total_score: 65,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'legacy revise',
      suggestions: [],
    });
    await expect(evaluateContent('legacy rewrite')).resolves.toEqual({
      decision: 'REVISE',
      total_score: 60,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'legacy rewrite',
      suggestions: [],
    });
  });

  it('rethrows non-keyword evaluation errors when qualityGoals are provided', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          throw new Error('provider offline');
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

    const { evaluateContent } = await import('../../mcp/services/critic.js');

    await expect(
      evaluateContent('raise error', null, ['logic'], { coherence: 80 }),
    ).rejects.toThrow('provider offline');
  });

  it('maps narrative-format thresholds to approved, revise, and rewrite legacy outputs', async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({
        dimensions: {},
        overall_score: 8.2,
        issues: [],
        recommended_skills: 'not-an-array',
      })
      .mockResolvedValueOnce({
        dimensions: {
          dream: { score: 0.5 },
          voice: { score: 'bad' },
          suspense: { score: 0.9 },
          character: { score: 0.6 },
          premise: { score: 0.3 },
        },
        overall_score: 6.4,
        issues: ['issue one', 'issue two'],
        recommended_skills: ['tighten-scene'],
      })
      .mockResolvedValueOnce({
        dimensions: {
          dream: { score: 0.1 },
          voice: { score: 0.2 },
          suspense: { score: 0.1 },
          character: { score: 0.1 },
          premise: { score: 0.1 },
        },
        overall_score: 5.9,
        issues: [],
        recommended_skills: [],
      });

    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        evaluate = evaluate;

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

    const { evaluateContent } = await import('../../mcp/services/critic.js');

    await expect(evaluateContent('approved narrative')).resolves.toEqual({
      decision: 'APPROVED',
      total_score: 82,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'Evaluation complete',
      suggestions: [],
    });
    await expect(evaluateContent('revise narrative')).resolves.toEqual({
      decision: 'REVISE',
      total_score: 64,
      lock_score: 2,
      style_score: 0,
      logic_score: 1.5,
      actionable_feedback: 'issue one;issue two',
      suggestions: ['tighten-scene'],
    });
    await expect(evaluateContent('rewrite narrative')).resolves.toEqual({
      decision: 'REWRITE',
      total_score: 59,
      lock_score: 0.4,
      style_score: 0.7,
      logic_score: 0.3,
      actionable_feedback: 'Evaluation complete',
      suggestions: [],
    });
  });

  it('maps raw module-score reports to revise, rewrite, and critical rewrite decisions', async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({
        moduleScores: {
          fictional_dream: 0.4,
          voice: 0.5,
          suspense: 0.6,
          character: 0.6,
          premise: 0.6,
        },
        top3Issues: [{ message: 'weak middle' }],
        criticalIssues: [],
        allIssues: ['plain issue'],
        overallScore: 65.04,
        summary: 'revise summary',
      })
      .mockResolvedValueOnce({
        moduleScores: {},
        top3Issues: [],
        criticalIssues: [],
        allIssues: [],
        recommendedSkills: 'not-array',
        overallScore: 50.02,
        overallLevel: 'low',
      })
      .mockResolvedValueOnce({
        moduleScores: {
          fictional_dream: 0.9,
          voice: 0.9,
          suspense: 0.9,
          character: 0.9,
          premise: 0.9,
        },
        top3Issues: [{ message: 'critical', suggestion: 'rewrite opening' }],
        criticalIssues: ['fatal'],
        allIssues: [],
        recommendedSkills: ['repair'],
        overallScore: 95,
      });

    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        evaluate = evaluate;

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

    const { evaluateContent } = await import('../../mcp/services/critic.js');

    await expect(evaluateContent('raw revise')).resolves.toMatchObject({
      decision: 'REVISE',
      total_score: 65,
      actionable_feedback: 'weak middle',
      suggestions: [],
    });
    await expect(evaluateContent('raw rewrite')).resolves.toMatchObject({
      decision: 'REWRITE',
      total_score: 50,
      actionable_feedback: 'Evaluation complete',
      suggestions: [],
    });
    await expect(evaluateContent('critical rewrite')).resolves.toMatchObject({
      decision: 'REWRITE',
      total_score: 95,
      actionable_feedback: 'rewrite opening',
      suggestions: ['repair'],
    });
  });

  it('normalizes legacy recommendedSkills and recommended_skills fallbacks', async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({
        total_score: 70,
        summary: 'legacy camel summary',
        recommendedSkills: ['camel-skill'],
      })
      .mockResolvedValueOnce({
        total_score: 72,
        summary: 'legacy snake summary',
        recommended_skills: ['snake-skill'],
      });

    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        evaluate = evaluate;

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

    const { evaluateContent } = await import('../../mcp/services/critic.js');

    await expect(evaluateContent('legacy camel')).resolves.toMatchObject({
      decision: 'REVISE',
      actionable_feedback: 'legacy camel summary',
      suggestions: ['camel-skill'],
    });
    await expect(evaluateContent('legacy snake')).resolves.toMatchObject({
      decision: 'REVISE',
      actionable_feedback: 'legacy snake summary',
      suggestions: ['snake-skill'],
    });
  });
});
