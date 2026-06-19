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

describe('services/revision-service logic score branch coverage', () => {
  it('caps the critic lock-analysis score at 10 when logic_score exceeds 6', async () => {
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
        decision: 'APPROVED',
        total_score: 8.6,
        logic_score: 8,
        actionable_feedback: 'Looks consistent',
      }),
    }));

    vi.doMock('../../workflow/revision-session', () => ({
      analyzeRevisionText: vi.fn(() => ({
        reports: [],
        scores: {},
      })),
      deriveWeakPoints: vi.fn(() => []),
      generateRevisionSuggestions: vi.fn(() => []),
      compareRevisionAnalyses: vi.fn(() => ({ delta: {} })),
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
          final_draft: draft,
          final_score: 8.6,
          history: [{ score: 8.6 }],
        };
      }),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    await service.initialize();
    const result = await service.revise('Original draft content');

    expect(seenCriticResults).toHaveLength(1);
    expect(seenCriticResults[0]).toMatchObject({
      lock_analysis: {
        C: {
          score: 10,
        },
      },
    });
    expect(result.finalDraft).toBe('Original draft content');
  });
});
