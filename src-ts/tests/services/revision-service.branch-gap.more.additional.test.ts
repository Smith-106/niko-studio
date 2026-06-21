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

describe('services/revision-service branch-gap additional coverage', () => {
  it('callLLMForRewrite catches non-Error throws and logs string message (lines 228-232)', async () => {
    const warnLog = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: warnLog,
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    // Set env vars so callLLMForRewrite attempts the fetch call
    const originalApiKey = process.env['LLM_API_KEY'];
    const originalBaseUrl = process.env['LLM_BASE_URL'];
    const originalModel = process.env['LLM_MODEL'];

    process.env['LLM_API_KEY'] = 'test-key';
    process.env['LLM_BASE_URL'] = 'https://localhost:9999';
    process.env['LLM_MODEL'] = 'test-model';

    // Mock global fetch to reject with a non-Error value
    vi.doMock('node:net', () => ({})); // prevent actual connections
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => Promise.reject('network-string-error')) as any;

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: vi.fn().mockResolvedValue({
        decision: 'APPROVED',
        total_score: 9,
        logic_score: 9,
        actionable_feedback: 'Good',
      }),
    }));

    vi.doMock('../../workflow/revision-session', () => ({
      analyzeRevisionText: vi.fn(() => ({
        reports: [
          { dimensionId: 'clarity', score: 5, evidence: ['evidence'] },
        ],
        scores: { clarity: 5 },
      })),
      deriveWeakPoints: vi.fn(() => []),
      generateRevisionSuggestions: vi.fn(() => []),
      compareRevisionAnalyses: vi.fn(() => ({
        delta: { clarity: 1 },
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
      runRevisionLoop: vi.fn(async ({ criticFn, writerFn }: { criticFn: (d: string, s: Record<string, unknown>) => Promise<Record<string, unknown>>; writerFn: (d: string, f: Record<string, unknown>) => Promise<string> }) => {
        await criticFn('draft', {});
        // Call writerFn which internally calls callLLMForRewrite -> fetch -> rejection
        const writerResult = await writerFn('draft', { feedback: 'improve' });
        return {
          final_draft: writerResult,
          final_score: 9,
          history: [{ score: 9 }],
        };
      }),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    await service.initialize();
    await service.revise('Original draft content for testing');

    // The warn log should have been called with the non-Error string message
    expect(warnLog).toHaveBeenCalledWith(
      'LLM rewrite call error',
      expect.objectContaining({ error: 'network-string-error' }),
    );

    // Restore
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env['LLM_API_KEY'];
    } else {
      process.env['LLM_API_KEY'] = originalApiKey;
    }
    if (originalBaseUrl === undefined) {
      delete process.env['LLM_BASE_URL'];
    } else {
      process.env['LLM_BASE_URL'] = originalBaseUrl;
    }
    if (originalModel === undefined) {
      delete process.env['LLM_MODEL'];
    } else {
      process.env['LLM_MODEL'] = originalModel;
    }
  });

  it('shuts down and clears learning accumulator', async () => {
    const infoLog = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: infoLog,
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: vi.fn().mockResolvedValue({
        decision: 'APPROVED',
        total_score: 9,
        logic_score: 9,
        actionable_feedback: 'Good',
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
      runRevisionLoop: vi.fn(async () => ({
        final_draft: 'final',
        final_score: 9,
        history: [],
      })),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    await service.initialize();
    expect(await service.healthCheck()).toBe(true);

    await service.shutdown();
    expect(await service.healthCheck()).toBe(false);
    expect(infoLog).toHaveBeenCalledWith('Revision service shut down');
  });
});
