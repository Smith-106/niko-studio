import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: unknown, url = '/writing-helper/stream'): HttpRequest {
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

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('writing stream endpoint buffer coverage', () => {
  it('requires non-empty content', async () => {
    const { writingStreamEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingStreamEndpoint(
      makeRequest({
        api_key: 'sk-test',
        base_url: 'https://example.invalid/v1',
        model: 'gpt-4o-mini',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'content is required' });
  });

  it('warns on large buffers and truncates streams above the hard cap', async () => {
    const largeChunk = 'A'.repeat((1024 * 1024) + 256);
    const overflowChunk = 'B'.repeat((4 * 1024 * 1024) + 1024);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamResponse([
          `data: ${JSON.stringify({ choices: [{ delta: { content: largeChunk } }] })}\n`,
          `data: ${JSON.stringify({ choices: [{ delta: { content: overflowChunk } }] })}\n`,
          'data: [DONE]\n',
        ]),
      ),
    );

    const { writingStreamEndpoint } = await import('../../mcp/endpoints/writing.js');

    const response = await writingStreamEndpoint(
      makeRequest({
        content: 'Stream a long scene.',
        mode: 'generate',
        api_key: 'sk-test',
        base_url: 'https://example.invalid/v1',
        model: 'gpt-4o-mini',
        skill_ids: ['buffer-guard'],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers?.['Content-Type']).toBe('text/event-stream');

    const body = String(response.body);
    expect(body).toContain('event: start');
    expect(body).toContain('"status":"truncated"');
    expect(body).toContain('"reason":"buffer_size_exceeded"');
    expect(body).toContain('"chunks":1');
    expect(body).toContain('"skills_used":["buffer-guard"]');
    expect(body).not.toContain('"status":"completed"');
  });
});
