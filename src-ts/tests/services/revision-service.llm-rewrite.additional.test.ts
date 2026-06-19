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

describe('services/revision-service LLM rewrite coverage', () => {
  it('covers callLLMForRewrite success path and writerFn LLM rewrite branch', async () => {
    const originalApiKey = process.env['LLM_API_KEY'];
    const originalBaseUrl = process.env['LLM_BASE_URL'];
    const originalModel = process.env['LLM_MODEL'];

    process.env['LLM_API_KEY'] = 'test-api-key';
    process.env['LLM_BASE_URL'] = 'http://localhost:9999';
    process.env['LLM_MODEL'] = 'test-model';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: '  Rewritten text from LLM  ',
            },
          },
        ],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const logInfo = vi.fn();
    const logWarn = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: logInfo,
        warn: logWarn,
        error: vi.fn(),
        debug: vi.fn(),
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
      runRevisionLoop: vi.fn(async ({ writerFn }: { writerFn: (draft: string, feedback: Record<string, unknown>) => Promise<string> }) => {
        const rewritten = await writerFn('Original draft text', { reason: 'test' });
        return {
          final_draft: rewritten,
          final_score: 8.5,
          final_decision: 'APPROVED',
          history: [{ score: 8.5 }],
        };
      }),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    const result = await service.revise('Original draft text');

    // Verify fetch was called with correct parameters
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:9999/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-api-key',
        }),
        body: expect.stringContaining('test-model'),
      }),
    );

    // Verify the LLM rewrite was applied
    expect(result.finalDraft).toBe('Rewritten text from LLM');

    // Verify log.info was called for LLM rewrite success
    expect(logInfo).toHaveBeenCalledWith(
      'LLM rewrite applied',
      expect.objectContaining({
        originalLength: 19,
        rewrittenLength: 23,
      }),
    );

    // Cleanup
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

  it('covers callLLMForRewrite fetch failure path (non-ok response)', async () => {
    const originalApiKey = process.env['LLM_API_KEY'];
    const originalBaseUrl = process.env['LLM_BASE_URL'];
    const originalModel = process.env['LLM_MODEL'];

    process.env['LLM_API_KEY'] = 'test-api-key';
    process.env['LLM_BASE_URL'] = 'http://localhost:9999';
    process.env['LLM_MODEL'] = 'test-model';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const logWarn = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: logWarn,
        error: vi.fn(),
        debug: vi.fn(),
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
      runRevisionLoop: vi.fn(async ({ writerFn }: { writerFn: (draft: string, feedback: Record<string, unknown>) => Promise<string> }) => {
        const rewritten = await writerFn('Original draft text', { reason: 'test' });
        return {
          final_draft: rewritten,
          final_score: 8.5,
          final_decision: 'APPROVED',
          history: [{ score: 8.5 }],
        };
      }),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    const result = await service.revise('Original draft text');

    // Verify log.warn was called for fetch failure
    expect(logWarn).toHaveBeenCalledWith(
      'LLM rewrite call failed',
      expect.objectContaining({ status: 500 }),
    );

    // Should fall back to rule-based or original
    expect(result.finalDraft).toBeDefined();

    // Cleanup
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

  it('covers callLLMForRewrite fetch exception path', async () => {
    const originalApiKey = process.env['LLM_API_KEY'];
    const originalBaseUrl = process.env['LLM_BASE_URL'];
    const originalModel = process.env['LLM_MODEL'];

    process.env['LLM_API_KEY'] = 'test-api-key';
    process.env['LLM_BASE_URL'] = 'http://localhost:9999';
    process.env['LLM_MODEL'] = 'test-model';

    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const logWarn = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: logWarn,
        error: vi.fn(),
        debug: vi.fn(),
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
      runRevisionLoop: vi.fn(async ({ writerFn }: { writerFn: (draft: string, feedback: Record<string, unknown>) => Promise<string> }) => {
        const rewritten = await writerFn('Original draft text', { reason: 'test' });
        return {
          final_draft: rewritten,
          final_score: 8.5,
          final_decision: 'APPROVED',
          history: [{ score: 8.5 }],
        };
      }),
    }));

    const { RevisionServiceImpl } = await import('../../services/revision-service');
    const service = new RevisionServiceImpl();

    const result = await service.revise('Original draft text');

    expect(logWarn).toHaveBeenCalledWith(
      'LLM rewrite call error',
      expect.objectContaining({ error: 'network down' }),
    );
    expect(result.finalDraft).toBeDefined();

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
});
