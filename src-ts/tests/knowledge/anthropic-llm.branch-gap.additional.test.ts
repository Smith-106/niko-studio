import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnthropicLLMProvider } from '../../knowledge/providers/anthropic-llm.js';
import type { StreamChunk } from '../../knowledge/models.js';

function createStreamResponse(chunks: string[]): Response {
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
    headers: {
      'Content-Type': 'text/event-stream',
    },
  });
}

async function collectStream(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('knowledge/providers/anthropic-llm branch-gap coverage', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('falls back to an empty api key header and zero-cost pricing for unknown models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'ok' }],
      usage: {
        input_tokens: 3,
        output_tokens: 4,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AnthropicLLMProvider({
      apiKey: null,
      baseUrl: null,
      modelMapping: null,
    });

    const response = await provider.complete('Prompt', 'unknown-model');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers['x-api-key']).toBe('');
    expect(response.usage.estimatedCost).toBe(0);
  });

  it('skips non-data lines and defaults missing streamed token usage to zero', async () => {
    vi.spyOn(Array.prototype, 'pop').mockImplementationOnce(function (this: unknown[]) {
      return undefined;
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createStreamResponse([
      'event: ping\n',
      'data: {"type":"message_delta","usage":{}}\n',
      'data: {"type":"message_stop"}\n',
    ])));

    const provider = new AnthropicLLMProvider({ apiKey: null });
    const chunks = await collectStream(provider.streamComplete('Prompt', 'unknown-model'));

    expect(chunks).toEqual([
      expect.objectContaining({
        content: '',
        isFinal: true,
        usage: expect.objectContaining({
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }),
      }),
      { content: '', isFinal: true, usage: null },
    ]);
  });
});
