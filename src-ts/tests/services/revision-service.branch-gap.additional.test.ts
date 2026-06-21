/**
 * Branch-gap tests for revision-service.ts
 *
 * Targets uncovered branches at lines 228-230:
 *   Line 228: `choices?.[0]?.message?.content ?? ''` — when choices is empty/undefined
 *             or content is null/undefined, the ?? '' fallback fires
 *   Line 230: `content.trim() || null` — when content is whitespace-only,
 *             trim() returns '' which is falsy, so || null returns null
 *
 * Also covers the `!response.ok` branch on line 221 when LLM is configured
 * but returns a non-OK HTTP status.
 */

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

// Helper to save/restore env vars
function withLLMEnv(fn: () => Promise<void>): Promise<void> {
  const originalApiKey = process.env['LLM_API_KEY'];
  const originalBaseUrl = process.env['LLM_BASE_URL'];
  const originalModel = process.env['LLM_MODEL'];

  process.env['LLM_API_KEY'] = 'test-key';
  process.env['LLM_BASE_URL'] = 'https://localhost:9999';
  process.env['LLM_MODEL'] = 'test-model';

  return fn().finally(() => {
    if (originalApiKey === undefined) delete process.env['LLM_API_KEY'];
    else process.env['LLM_API_KEY'] = originalApiKey;
    if (originalBaseUrl === undefined) delete process.env['LLM_BASE_URL'];
    else process.env['LLM_BASE_URL'] = originalBaseUrl;
    if (originalModel === undefined) delete process.env['LLM_MODEL'];
    else process.env['LLM_MODEL'] = originalModel;
  });
}

// Common mock setup for revision-loop and revision-session
function setupCommonMocks() {
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
    runRevisionLoop: vi.fn(async ({ draft, writerFn }: { draft: string; writerFn: (d: string, f: Record<string, unknown>) => Promise<string> }) => {
      // Call writerFn with the actual draft text so the result reflects the writer's behavior
      const writerResult = await writerFn(draft, { feedback: 'improve' });
      return {
        final_draft: writerResult,
        final_score: 9,
        history: [],
      };
    }),
  }));
}

describe('services/revision-service branch-gap additional coverage', () => {
  it('callLLMForRewrite returns null when LLM response has empty choices array (line 228)', async () => {
    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    setupCommonMocks();

    await withLLMEnv(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      }) as any;

      const { RevisionServiceImpl } = await import('../../services/revision-service');
      const service = new RevisionServiceImpl();

      await service.initialize();
      // Use text with no AI template expressions so the rule-based fallback also finds no changes
      const result = await service.revise('Original draft content for testing');

      // When choices is empty: content = '' (?? ''), content.trim() || null = null.
      // Rule-based fallback also finds no changes, so writerFn returns the original draft.
      expect(result.finalDraft).toBe('Original draft content for testing');

      globalThis.fetch = originalFetch;
    });
  });

  it('callLLMForRewrite returns null when LLM response content is whitespace-only (line 230)', async () => {
    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    setupCommonMocks();

    await withLLMEnv(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '   \n\t  ' } }],
        }),
      }) as any;

      const { RevisionServiceImpl } = await import('../../services/revision-service');
      const service = new RevisionServiceImpl();

      await service.initialize();
      const result = await service.revise('Original draft content for testing');

      // content.trim() returns '' (falsy), so || null returns null.
      // Rule-based fallback finds no changes, so writerFn returns original.
      expect(result.finalDraft).toBe('Original draft content for testing');

      globalThis.fetch = originalFetch;
    });
  });

  it('callLLMForRewrite returns null when LLM response has no choices field (line 228 ?? branch)', async () => {
    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    setupCommonMocks();

    await withLLMEnv(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}), // no choices field
      }) as any;

      const { RevisionServiceImpl } = await import('../../services/revision-service');
      const service = new RevisionServiceImpl();

      await service.initialize();
      const result = await service.revise('Original draft content for testing');

      // choices?.[0] is undefined -> ?? '' fires -> ''.trim() || null = null
      // Falls through to rule-based rewrite, then returns original draft
      expect(result.finalDraft).toBe('Original draft content for testing');

      globalThis.fetch = originalFetch;
    });
  });

  it('callLLMForRewrite returns null when LLM response is not ok (line 221)', async () => {
    const warnLog = vi.fn();

    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: warnLog,
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    setupCommonMocks();

    await withLLMEnv(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      }) as any;

      const { RevisionServiceImpl } = await import('../../services/revision-service');
      const service = new RevisionServiceImpl();

      await service.initialize();
      const result = await service.revise('Original draft content for testing');

      // When response is not ok, callLLMForRewrite returns null and logs a warning
      expect(warnLog).toHaveBeenCalledWith(
        'LLM rewrite call failed',
        expect.objectContaining({ status: 429 }),
      );

      // Falls through to rule-based rewrite, then returns original draft
      expect(result.finalDraft).toBe('Original draft content for testing');

      globalThis.fetch = originalFetch;
    });
  });

  it('callLLMForRewrite returns null when LLM returns same text as input (line 310)', async () => {
    vi.doMock('../../logger/index', () => ({
      createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    }));

    setupCommonMocks();

    await withLLMEnv(async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'AI template text for testing' } }],
        }),
      }) as any;

      const { RevisionServiceImpl } = await import('../../services/revision-service');
      const service = new RevisionServiceImpl();

      await service.initialize();
      // The input is the same as the LLM response, so llmResult !== draft is false
      const result = await service.revise('AI template text for testing');

      // LLM returns same text -> llmResult === draft -> condition false
      // Falls to rule-based, but 'AI template text for testing' has no Chinese/English
      // template patterns that match -> returns original
      expect(result.finalDraft).toBe('AI template text for testing');

      globalThis.fetch = originalFetch;
    });
  });
});
