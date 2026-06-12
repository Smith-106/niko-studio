import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unmock('../../services/revision-service');
  vi.unmock('../../mcp/services/critic');
  vi.unmock('../../workflow/revision-loop');
  vi.unmock('../../workflow/revision-session');
  vi.unmock('../../logger/index');
});

describe('services/revision-service branch gaps', () => {
  it('initializes only once when called repeatedly', async () => {
    const logInfo = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: logInfo,
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    await service.initialize();
    await service.initialize();

    expect(await service.healthCheck()).toBe(true);
    expect(logInfo).toHaveBeenCalledWith('Revision service initialized');
    expect(logInfo).toHaveBeenCalledTimes(1);
  });

  it('covers fallback branches for critic score, history score, final decision, and comparison delta', async () => {
    const seenCriticResults: Array<Record<string, unknown>> = [];

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }));

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: vi.fn().mockResolvedValue({
        decision: 'REWRITE',
        total_score: 5.1,
        logic_score: 4,
        actionable_feedback: 'Tighten logic',
      }),
    }));

    vi.doMock('../../workflow/revision-session', () => ({
      analyzeRevisionText: vi.fn((text: string) => ({
        reports: [
          {
            dimensionId: 'clarity',
            score: text.includes('Revised') ? 7 : 4,
            evidence: ['baseline-evidence', 'second-evidence'],
          },
        ],
        scores: {
          clarity: text.includes('Revised') ? 7 : 4,
        },
      })),
      deriveWeakPoints: vi.fn(() => []),
      generateRevisionSuggestions: vi.fn(() => []),
      compareRevisionAnalyses: vi.fn(() => ({
        delta: {
          clarity: 'not-a-number',
        },
      })),
    }));

    vi.doMock('../../workflow/revision-loop', () => ({
      RevisionDecision: {
        APPROVED: 'APPROVED',
        REVISE: 'REVISE',
        REWRITE: 'REWRITE',
        HUMAN_REVIEW: 'HUMAN_REVIEW',
      },
      DEFAULT_REVISION_CONFIG: {
        max_revisions: 5,
        pass_score: 8,
      },
      runRevisionLoop: vi.fn(async ({ draft, criticFn }: { draft: string; criticFn: (draft: string, sceneCard: Record<string, unknown>) => Promise<Record<string, unknown>> }) => {
        const criticResult = await criticFn(draft, {});
        seenCriticResults.push(criticResult);
        return {
          final_draft: 'Revised draft content',
          final_score: 5.1,
          history: [
            { score: 'bad-score' },
          ],
        };
      }),
    }));

    const { RevisionDecision } = await import('../../workflow/revision-loop');
    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    await service.initialize();
    const result = await service.revise('Original draft content');

    expect(seenCriticResults).toHaveLength(1);
    expect(seenCriticResults[0]).toMatchObject({
      decision: 'REWRITE',
      total_score: 5.1,
      actionable_feedback: 'Tighten logic',
      lock_analysis: {
        C: {
          score: 4,
        },
      },
      revision_instructions: [],
    });

    expect(result.finalDecision).toBe(RevisionDecision.REVISE);
    expect(result.totalIterations).toBe(1);
    expect(result.finalDraft).toBe('Revised draft content');
    expect(result.learningInsights).toEqual([
      expect.objectContaining({
        dimensionId: 'clarity',
        averageBaselineScore: 4,
        averageDelta: -2,
        occurrences: 2,
        trend: 'declining',
      }),
    ]);
  });
});
