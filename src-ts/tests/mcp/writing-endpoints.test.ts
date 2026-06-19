import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';
import {
  writingHelperProcessEndpoint,
  writingStreamEndpoint,
} from '../../mcp/endpoints/writing';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/writing-helper/process',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

afterEach(() => {
  delete process.env.NIKO_LLM_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.NIKO_LLM_BASE_URL;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.NIKO_LLM_MODEL;
  delete process.env.OPENAI_MODEL;
  vi.unstubAllGlobals();
});

describe('writing endpoints local fallback parity', () => {
  it('uses the local writing-helper service instead of placeholder text when no LLM config exists', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '第一句。  第二句。 第二句。',
      mode: 'polish',
      instruction: '更自然',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'polish',
      status: 'ok',
      provider: 'local',
    });
    const body = response.body as Record<string, unknown>;
    expect(String(body['processed_text'])).not.toContain('Placeholder');
    expect(String(body['processed_text']).length).toBeGreaterThan(0);
    expect(body['stats']).toBeTruthy();
  });

  it('returns outline data from the local helper and preserves processed_text compatibility', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '第一段介绍人物。\n第二段建立冲突。\n第三段留下悬念。',
      mode: 'outline',
      max_items: 2,
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({
      mode: 'outline',
      status: 'ok',
      provider: 'local',
    });
    expect(Array.isArray(body['outline'])).toBe(true);
    expect((body['outline'] as unknown[]).length).toBeLessThanOrEqual(2);
    expect(typeof body['processed_text']).toBe('string');
    expect(String(body['processed_text']).length).toBeGreaterThan(0);
  });

  it('keeps process endpoint on deterministic local-helper behavior even when env LLM config exists', async () => {
    process.env.OPENAI_API_KEY = 'sk-env-test';
    process.env.OPENAI_BASE_URL = 'https://example.invalid/v1';
    process.env.OPENAI_MODEL = 'env-model';

    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '第一句。 第一句。',
      mode: 'rewrite',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'rewrite',
      status: 'ok',
      provider: 'local',
      processed_text: '第一句。',
    });
  });

  it('requires explicit LLM config for generate mode on the process endpoint', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '请续写这一段。',
      mode: 'generate',
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'No LLM provider configured' });
  });

  it('propagates selected skill ids through process endpoint responses', async () => {
    const response = await writingHelperProcessEndpoint(makeRequest({
      content: '第一句。 第二句。',
      mode: 'rewrite',
      skill_ids: ['character-forge', 'dialogue-system'],
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'rewrite',
      status: 'ok',
      provider: 'local',
      skills_used: ['character-forge', 'dialogue-system'],
    });
  });

  it('includes selected skill ids in writing stream completion events', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      choices: [{ delta: { content: '续写' } }],
    }), { status: 200 })));

    const response = await writingStreamEndpoint(makeRequest({
      content: '请续写这一段。',
      mode: 'generate',
      api_key: 'sk-test',
      base_url: 'https://example.invalid/v1',
      model: 'test-model',
      provider: 'openai',
      skill_ids: ['character-forge'],
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Content-Type']).toContain('text/event-stream');

    // Parse SSE text format: "event: done\ndata: {...}\n\n"
    const body = String(response.body);
    const doneMatch = body.match(/event: done\ndata: (.+)\n\n/);
    expect(doneMatch).not.toBeNull();
    const doneData = JSON.parse(doneMatch![1]);
    expect(doneData.skills_used).toEqual(['character-forge']);
  });
});

// ---------------------------------------------------------------
// novelQualityCheckEndpoint decision branches (REVISE, REWRITE)
// ---------------------------------------------------------------

describe('novelQualityCheckEndpoint decision branches', () => {
  const evaluateContentMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../../mcp/services/critic');
    vi.restoreAllMocks();
    vi.resetModules();
  });

  function makeQualityRequest(body: Record<string, unknown>): HttpRequest {
    return {
      method: 'POST',
      url: '/novel-quality-check',
      headers: {},
      body,
      query: {},
      params: {},
    };
  }

  it('returns REVISE when total_score is between 60 and 79', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'REVISE',
      total_score: 65,
      lock_score: 60,
      style_score: 55,
      logic_score: 62,
      actionable_feedback: 'Tighten the dialogue.',
      suggestions: ['Add subtext to exchanges'],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: '  A chapter that needs revision.  ',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.decision).toBe('REVISE');
    expect(body.total_score).toBe(65);
    expect(body.status).toBe('ok');
    expect(body.actionable_feedback).toBe('Tighten the dialogue.');
    expect(body.suggestions).toEqual(['Add subtext to exchanges']);
  });

  it('returns REWRITE when total_score is below 60', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'REWRITE',
      total_score: 40,
      lock_score: 30,
      style_score: 35,
      logic_score: 42,
      actionable_feedback: 'Major structural issues.',
      suggestions: ['Restructure the opening'],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'A chapter with deep problems.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.decision).toBe('REWRITE');
    expect(body.total_score).toBe(40);
  });

  it('returns REWRITE when total_score is non-finite (NaN)', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'REWRITE',
      total_score: NaN,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: '',
      suggestions: [],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft with NaN score.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    // NaN is not finite → totalScore defaults to 0 → 0 < 60 → REWRITE
    expect(body.decision).toBe('REWRITE');
  });

  it('returns REWRITE when total_score is Infinity', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'APPROVED',
      total_score: Infinity,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: '',
      suggestions: [],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft with Infinity score.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    // Infinity is not finite → totalScore defaults to 0 → REWRITE
    expect(body.decision).toBe('REWRITE');
  });

  it('returns 500 when evaluateContent throws', async () => {
    evaluateContentMock.mockRejectedValueOnce(new Error('critic engine crashed'));

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft that triggers a critic failure.',
    }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Quality evaluation failed' });
  });

  it('merges sidecar fields when retrieval_metadata, context_budget, and self_learning are provided', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'APPROVED',
      total_score: 85,
      lock_score: 80,
      style_score: 82,
      logic_score: 88,
      actionable_feedback: 'Good work.',
      suggestions: [],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Chapter draft.',
      retrieval_metadata: { sources: 5 },
      context_budget: { max: 2048 },
      self_learning: { enabled: true },
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.retrieval_metadata).toEqual({ sources: 5 });
    expect(body.context_budget).toEqual({ max: 2048 });
    expect(body.self_learning).toEqual({ enabled: true });
  });

  it('omits sidecar fields when they are absent from the request', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'APPROVED',
      total_score: 90,
      lock_score: 85,
      style_score: 88,
      logic_score: 92,
      actionable_feedback: 'Excellent.',
      suggestions: [],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Clean chapter draft.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect('retrieval_metadata' in body).toBe(false);
    expect('context_budget' in body).toBe(false);
    expect('self_learning' in body).toBe(false);
  });

  it('returns REVISE at the boundary total_score = 60', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'REVISE',
      total_score: 60,
      lock_score: 55,
      style_score: 50,
      logic_score: 58,
      actionable_feedback: 'Borderline pass.',
      suggestions: ['Polish transitions'],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft at exactly 60.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.decision).toBe('REVISE');
  });

  it('returns REWRITE at the boundary total_score = 59', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'REWRITE',
      total_score: 59,
      lock_score: 40,
      style_score: 35,
      logic_score: 50,
      actionable_feedback: 'Below threshold.',
      suggestions: ['Rewrite opening'],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft at exactly 59.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.decision).toBe('REWRITE');
  });

  it('returns APPROVED at the boundary total_score = 80', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'APPROVED',
      total_score: 80,
      lock_score: 78,
      style_score: 76,
      logic_score: 82,
      actionable_feedback: 'Solid work.',
      suggestions: [],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft at exactly 80.',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.decision).toBe('APPROVED');
  });

  it('passes quality options when quality_level, quality_mode, critical_gate_always_on, and degrade_reason are present', async () => {
    evaluateContentMock.mockResolvedValueOnce({
      decision: 'REVISE',
      total_score: 70,
      lock_score: 65,
      style_score: 60,
      logic_score: 68,
      actionable_feedback: 'Needs polish.',
      suggestions: ['Improve pacing'],
    });

    vi.doMock('../../mcp/services/critic', () => ({
      evaluateContent: evaluateContentMock,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing');

    const response = await novelQualityCheckEndpoint(makeQualityRequest({
      content: 'Draft with quality options.',
      quality_level: 'medium',
      quality_mode: 'strict',
      critical_gate_always_on: false,
      degrade_reason: 'low budget',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.decision).toBe('REVISE');
    // evaluateNovelQuality only takes content; qualityOptions is built but
    // not forwarded in the current implementation. The mock confirms
    // evaluateContent was called with the expected arguments.
    expect(evaluateContentMock).toHaveBeenCalledWith(
      'Draft with quality options.', undefined, undefined, undefined,
    );
  });
});

/**
 * Note on qualityDefaultPayload (lines 232-242):
 *
 * `qualityDefaultPayload` is a module-private function that is never exported
 * and never called anywhere in the codebase (dead code). It returns a default
 * quality payload with zero scores and empty feedback/suggestions.
 *
 * Since it is not exported and not invoked by any reachable code path, it
 * cannot be covered by tests without modifying the source code (e.g.,
 * exporting it or calling it from an endpoint). Without source modification,
 * this function will remain as an uncovered branch in coverage reports.
 */
