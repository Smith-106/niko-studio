import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: unknown, url = '/writing-helper/process'): HttpRequest {
  return {
    method: 'POST',
    url,
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.doUnmock('../../mcp/services/critic.js');
  vi.doUnmock('../../mcp/services/skills.js');
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('writing endpoints branch coverage', () => {
  it('validates and falls back for novel quality checks', async () => {
    const evaluateContent = vi.fn()
      .mockResolvedValueOnce({
        decision: 'APPROVED',
        total_score: 91,
        lock_score: 84,
        style_score: 88,
        logic_score: 90,
        actionable_feedback: 'Keep the tension curve steady.',
        suggestions: ['trim the second paragraph'],
      })
      .mockRejectedValueOnce(new Error('critic unavailable'));

    vi.doMock('../../mcp/services/critic.js', () => ({
      evaluateContent,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing.js');

    const missing = await novelQualityCheckEndpoint(makeRequest({}));
    expect(missing.statusCode).toBe(400);
    expect(missing.body).toEqual({ error: 'content is required' });

    const success = await novelQualityCheckEndpoint(makeRequest({
      content: '  A complete chapter draft.  ',
      retrieval_metadata: { cited: 3 },
      context_budget: { token_total: 1234 },
      self_learning: { reflector_triggered: true },
    }));
    expect(success.statusCode).toBe(200);
    expect(success.body).toEqual({
      status: 'ok',
      total_score: 91,
      lock_score: 84,
      style_score: 88,
      logic_score: 90,
      decision: 'APPROVED',
      actionable_feedback: 'Keep the tension curve steady.',
      suggestions: ['trim the second paragraph'],
      retrieval_metadata: { cited: 3 },
      context_budget: { token_total: 1234 },
      self_learning: { reflector_triggered: true },
    });
    expect(evaluateContent).toHaveBeenNthCalledWith(1, 'A complete chapter draft.', undefined, undefined, undefined);

    const fallback = await novelQualityCheckEndpoint(makeRequest({
      content: 'Another draft.',
    }));
    expect(fallback.statusCode).toBe(500);
    expect(fallback.body).toEqual({
      error: 'Quality evaluation failed',
    });
  });

  it('supports explicit LLM process requests, skill pack injection, and outline mode output', async () => {
    const skillsLoad = vi.fn()
      .mockResolvedValueOnce({
        id: 'skill-a',
        content: 'Prefer sparse metaphors.',
        metadata: {},
      })
      .mockResolvedValueOnce({ error: "Skill 'missing' not found" });
    vi.doMock('../../mcp/services/skills.js', () => ({
      skillsLoad,
    }));

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: 'Beat one\nBeat two\n\nBeat three',
          },
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingHelperProcessEndpoint(makeRequest({
      content: 'Continue the chapter.',
      mode: 'outline',
      instruction: 'Keep it lean.',
      api_key: 'sk-test-12345678901234567890',
      base_url: 'https://example.invalid/v1',
      model: 'gpt-4o-mini',
      detection_evasion_guard_enabled: true,
      skill_ids: ['skill-a', 'skill-a', 42, 'missing'],
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      mode: 'outline',
      outline: ['Beat one', 'Beat two', 'Beat three'],
      processed_text: 'Beat one\nBeat two\n\nBeat three',
      status: 'ok',
      skills_used: ['skill-a', 'missing'],
    });
    expect(skillsLoad).toHaveBeenCalledTimes(2);
    expect(skillsLoad).toHaveBeenNthCalledWith(1, 'skill-a');
    expect(skillsLoad).toHaveBeenNthCalledWith(2, 'missing');

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body));
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[0].content).toContain('AI');
    expect(payload.messages[1].content).toContain('## Skill Pack: skill-a');
    expect(payload.messages[1].content).toContain('Prefer sparse metaphors.');
    expect(payload.messages[1].content).toContain('Keep it lean.');
  });

  it('returns local-helper validation errors for unsupported local modes', async () => {
    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingHelperProcessEndpoint(makeRequest({
      content: 'Some body text.',
      mode: 'invalid-mode',
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: 'mode must be one of: polish, summarize, outline, rewrite, expand',
    });
  });

  it('scrubs secrets from process endpoint LLM failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz123456 api_key=secret access_token=topsecret key-abcdefghijklmnopqrstuvwxyz123456',
      { status: 401 },
    )));

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingHelperProcessEndpoint(makeRequest({
      content: 'Generate the next scene.',
      mode: 'generate',
      api_key: 'sk-live-abcdefghijklmnopqrstuvwxyz123456',
      base_url: 'https://example.invalid/v1',
      model: 'gpt-4o',
    }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'LLM API error: 401 - Authorization: [REDACTED] api_key=[REDACTED] access_token=[REDACTED] key-[REDACTED]',
    });
  });

  it('validates stream requests and emits chunk events from SSE responses', async () => {
    const { writingStreamEndpoint } = await import('../../mcp/endpoints/writing.js');

    const missingConfig = await writingStreamEndpoint(makeRequest({
      content: 'Continue this scene.',
      mode: 'generate',
    }, '/writing-helper/stream'));
    expect(missingConfig.statusCode).toBe(400);
    expect(missingConfig.body).toEqual({ error: 'No LLM provider configured' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"Alpha"}}]}\n',
      'data: {bad json}\n',
      'data: {"choices":[{"delta":{"content":"Beta"}}]}\n',
      'data: [DONE]\n',
    ])));

    const streamed = await writingStreamEndpoint(makeRequest({
      content: 'Continue this scene.',
      mode: 'generate',
      api_key: 'sk-test',
      base_url: 'https://example.invalid/v1',
      model: 'gpt-4o-mini',
      skill_ids: ['storycraft'],
    }, '/writing-helper/stream'));

    expect(streamed.statusCode).toBe(200);
    expect(streamed.headers?.['Content-Type']).toBe('text/event-stream');
    const body = String(streamed.body);
    expect(body).toContain('event: start');
    expect(body).toContain('"chunk":"Alpha"');
    expect(body).toContain('"chunk":"Beta"');
    expect(body).toContain('"status":"completed"');
    expect(body).toContain('"skills_used":["storycraft"]');
  });

  it('returns scrubbed stream errors for missing bodies and failed upstream calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 })));

    const { writingStreamEndpoint } = await import('../../mcp/endpoints/writing.js');

    const noBody = await writingStreamEndpoint(makeRequest({
      content: 'Continue this scene.',
      mode: 'generate',
      api_key: 'sk-test',
      base_url: 'https://example.invalid/v1',
      model: 'gpt-4o-mini',
    }, '/writing-helper/stream'));
    expect(noBody.statusCode).toBe(500);
    expect(noBody.body).toEqual({ error: 'No response body' });

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(
      'Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz123456 auth_token=supersecret',
      { status: 500 },
    )));

    const upstreamFailure = await writingStreamEndpoint(makeRequest({
      content: 'Continue this scene.',
      mode: 'generate',
      api_key: 'sk-test',
      base_url: 'https://example.invalid/v1',
      model: 'gpt-4o-mini',
    }, '/writing-helper/stream'));
    expect(upstreamFailure.statusCode).toBe(500);
    expect(upstreamFailure.body).toEqual({
      error: 'LLM API error: 500 - Authorization: [REDACTED] auth_token=[REDACTED]',
    });
  });
});
