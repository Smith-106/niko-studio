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

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
  vi.doUnmock('../../mcp/http-types.js');
  vi.doUnmock('../../mcp/services/critic.js');
  vi.doUnmock('../../services/writing-helper.js');
});

describe('writing endpoints tail branches', () => {
  it('uses remote defaults and falls back to an empty completion payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingHelperProcessEndpoint(makeRequest({
      content: 'Default remote draft.',
      api_key: 'sk-test-12345678901234567890',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      mode: 'polish',
      processed_text: '',
      status: 'ok',
      skills_used: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(requestInit.body)) as Record<string, unknown>;
    expect(payload['model']).toBe('gpt-4o');
  });

  it('executes null quality control fallbacks without failing the quality endpoint', async () => {
    const evaluateContent = vi.fn().mockResolvedValue({
      decision: 'APPROVED',
      total_score: 88,
      lock_score: 77,
      style_score: 66,
      logic_score: 55,
      actionable_feedback: 'Keep the chapter coherent.',
      suggestions: ['Preserve the reveal pacing.'],
    });
    vi.doMock('../../mcp/services/critic.js', () => ({
      evaluateContent,
    }));

    const { novelQualityCheckEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await novelQualityCheckEndpoint(makeRequest({
      content: 'Quality draft.',
      quality_level: null,
      quality_mode: null,
      critical_gate_always_on: null,
      degrade_reason: null,
    }, '/novel-quality-check'));

    expect(response.statusCode).toBe(200);
    expect(evaluateContent).toHaveBeenCalledWith('Quality draft.', undefined, undefined, undefined);
    expect(response.body).toMatchObject({
      status: 'ok',
      total_score: 88,
      lock_score: 77,
      style_score: 66,
      logic_score: 55,
    });
  });

  it('falls back from undefined or primitive parsed bodies across every writing endpoint', async () => {
    vi.doMock('../../mcp/http-types.js', async () => {
      const actual = await vi.importActual<typeof import('../../mcp/http-types.js')>(
        '../../mcp/http-types.js',
      );

      const parseBody = vi.fn()
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined);

      return {
        ...actual,
        parseBody,
      };
    });

    const {
      novelQualityCheckEndpoint,
      writingHelperProcessEndpoint,
      writingStreamEndpoint,
    } = await import('../../mcp/endpoints/writing.js');

    await expect(
      novelQualityCheckEndpoint(makeRequest({ ignored: true }, '/novel-quality-check')),
    ).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'content is required' },
    });

    await expect(
      writingHelperProcessEndpoint(makeRequest({ ignored: true })),
    ).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'content is required' },
    });

    await expect(
      writingStreamEndpoint(makeRequest({ ignored: true }, '/writing-helper/stream')),
    ).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'content is required' },
    });
  });

  it('normalizes primitive parsed bodies for local process requests', async () => {
    vi.doMock('../../mcp/http-types.js', async () => {
      const actual = await vi.importActual<typeof import('../../mcp/http-types.js')>(
        '../../mcp/http-types.js',
      );

      return {
        ...actual,
        parseBody: vi.fn().mockReturnValue(7),
      };
    });

    const { writingHelperProcessEndpoint } = await import('../../mcp/endpoints/writing.js');

    await expect(
      writingHelperProcessEndpoint(makeRequest({ ignored: true })),
    ).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'content is required' },
    });
  });

  it('normalizes primitive parsed bodies for quality and stream requests', async () => {
    vi.doMock('../../mcp/http-types.js', async () => {
      const actual = await vi.importActual<typeof import('../../mcp/http-types.js')>(
        '../../mcp/http-types.js',
      );

      return {
        ...actual,
        parseBody: vi.fn()
          .mockReturnValueOnce(7)
          .mockReturnValueOnce('invalid-body'),
      };
    });

    const {
      novelQualityCheckEndpoint,
      writingStreamEndpoint,
    } = await import('../../mcp/endpoints/writing.js');

    await expect(
      novelQualityCheckEndpoint(makeRequest({ ignored: true }, '/novel-quality-check')),
    ).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'content is required' },
    });

    await expect(
      writingStreamEndpoint(makeRequest({ ignored: true }, '/writing-helper/stream')),
    ).resolves.toMatchObject({
      statusCode: 400,
      body: { error: 'content is required' },
    });
  });

  it('accepts explicit stream instructions and completes empty streams', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n'));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })));

    const { writingStreamEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingStreamEndpoint(makeRequest({
      content: 'Stream with explicit instruction.',
      mode: 'generate',
      instruction: 'Keep the prose tight.',
      api_key: 'sk-test-12345678901234567890',
      base_url: 'https://example.invalid/v1',
      model: 'gpt-4o-mini',
    }, '/writing-helper/stream'));

    expect(response.statusCode).toBe(200);
    expect(String(response.body)).toContain('"status":"completed"');
  });

  it('stringifies non-Error failures from local and remote writing paths', async () => {
    vi.doMock('../../services/writing-helper.js', () => ({
      processWritingHelper: vi.fn(() => {
        throw 'local-string-failure';
      }),
    }));

    const fetchMock = vi.fn()
      .mockRejectedValueOnce('remote-process-failure')
      .mockRejectedValueOnce('remote-stream-failure');
    vi.stubGlobal('fetch', fetchMock);

    const {
      writingHelperProcessEndpoint,
      writingStreamEndpoint,
    } = await import('../../mcp/endpoints/writing.js');

    const localFailure = await writingHelperProcessEndpoint(makeRequest({
      content: 'Local failure draft.',
      mode: 'summarize',
    }));
    expect(localFailure).toEqual({
      statusCode: 400,
      body: { error: 'local-string-failure' },
      headers: { 'Content-Type': 'application/json' },
    });

    const remoteFailure = await writingHelperProcessEndpoint(makeRequest({
      content: 'Remote failure draft.',
      api_key: 'sk-test-12345678901234567890',
    }));
    expect(remoteFailure).toEqual({
      statusCode: 500,
      body: { error: 'remote-process-failure' },
      headers: { 'Content-Type': 'application/json' },
    });

    const streamFailure = await writingStreamEndpoint(makeRequest({
      content: 'Remote stream failure draft.',
      api_key: 'sk-test-12345678901234567890',
    }, '/writing-helper/stream'));
    expect(streamFailure).toEqual({
      statusCode: 500,
      body: { error: 'remote-stream-failure' },
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
