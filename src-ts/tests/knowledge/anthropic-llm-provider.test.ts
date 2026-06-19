import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnthropicLLMProvider } from '../../knowledge/providers/anthropic-llm';
import {
  ModelTier,
  ProviderType,
  ProviderUnavailableError,
  RateLimitError,
  TokenLimitError,
  type StreamChunk,
} from '../../knowledge/models';

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

describe('knowledge/providers/anthropic-llm', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('builds requests from env/config and aggregates complete() responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'Claude' },
      ],
      usage: {
        input_tokens: 120,
        output_tokens: 30,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AnthropicLLMProvider({
      baseUrl: 'https://anthropic.example/v1/',
    });
    const response = await provider.complete('Prompt body', 'claude-3-haiku-20240307', {
      temperature: 0.2,
      maxTokens: 128,
      systemPrompt: 'Be concise',
      stopSequences: ['END'],
    });

    expect(provider.providerType).toBe(ProviderType.ANTHROPIC);
    expect(provider.getModelForTier('unknown')).toBe('claude-3-5-sonnet-20241022');
    expect(response.content).toBe('Hello Claude');
    expect(response.modelUsed).toBe('claude-3-haiku-20240307');
    expect(response.provider).toBe(ProviderType.ANTHROPIC);
    expect(response.usage.totalTokens).toBe(150);
    expect(response.usage.estimatedCost).toBeCloseTo((120 * 0.25 + 30 * 1.25) / 1_000_000);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://anthropic.example/v1/messages');
    expect(headers['x-api-key']).toBe('env-anthropic-key');
    expect(body).toMatchObject({
      model: 'claude-3-haiku-20240307',
      max_tokens: 128,
      temperature: 0.2,
      system: 'Be concise',
      stop_sequences: ['END'],
    });
  });

  it('maps rate-limit, token-limit, and generic API errors to unified errors', async () => {
    const rateProvider = new AnthropicLLMProvider({ apiKey: 'explicit-key' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rate limit exceeded')));
    await expect(rateProvider.complete('x', 'model')).rejects.toThrow(RateLimitError);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('token length exceeded', {
      status: 400,
    })));
    await expect(rateProvider.complete('x', 'model')).rejects.toThrow(TokenLimitError);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('internal boom', {
      status: 500,
    })));
    await expect(rateProvider.complete('x', 'model')).rejects.toThrow(ProviderUnavailableError);
  });

  it('streams Anthropic SSE events, emits usage, and skips malformed chunks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createStreamResponse([
      'data: {"type":"content_block_delta","delta":{"text":"Alpha"}}\n',
      'data: {bad json}\n',
      'data: {"type":"message_delta","usage":{"input_tokens":5,"output_tokens":2}}\n',
      'data: {"type":"message_stop"}\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new AnthropicLLMProvider({ apiKey: 'explicit-key' });
    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.streamComplete('Prompt', 'claude-3-haiku-20240307', {
      maxTokens: 32,
      systemPrompt: 'Stream it',
      stopSequences: ['END'],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ content: 'Alpha', isFinal: false, usage: null });
    expect(chunks[1].isFinal).toBe(true);
    expect(chunks[1].usage?.totalTokens).toBe(7);
    expect(chunks[2]).toEqual({ content: '', isFinal: true, usage: null });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.stream).toBe(true);
    expect(body.system).toBe('Stream it');
    expect(body.stop_sequences).toEqual(['END']);
  });

  it('returns an empty stream when the upstream response has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const provider = new AnthropicLLMProvider({ apiKey: 'explicit-key' });

    const chunks: StreamChunk[] = [];
    for await (const chunk of provider.streamComplete('Prompt', 'model')) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([]);
  });

  it('maps stream transport, API, and reader failures to unified errors', async () => {
    const provider = new AnthropicLLMProvider({ apiKey: 'explicit-key' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rate limit exceeded')));
    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).rejects.toThrow(
      RateLimitError,
    );

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('token length exceeded', {
      status: 400,
    })));
    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).rejects.toThrow(
      TokenLimitError,
    );

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader() {
          return {
            read: vi.fn().mockRejectedValue(new Error('service unavailable')),
          };
        },
      },
    }));
    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).rejects.toThrow(
      ProviderUnavailableError,
    );
  });

  it('healthCheck() reports success and failure based on complete()', async () => {
    const healthyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', healthyFetch);

    const provider = new AnthropicLLMProvider({ apiKey: 'explicit-key' });
    await expect(provider.healthCheck()).resolves.toBe(true);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(provider.healthCheck()).resolves.toBe(false);
  });
});
