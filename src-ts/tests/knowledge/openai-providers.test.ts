import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenAIEmbeddingProvider } from '../../knowledge/providers/openai-embedding';
import { OpenAILLMProvider } from '../../knowledge/providers/openai-llm';
import {
  EmbeddingError,
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

describe('knowledge/providers/openai-llm', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = 'env-openai-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('builds completion requests from env/config and maps response usage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        { message: { content: '{"message":"ok"}' } },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAILLMProvider({
      baseUrl: 'https://openai.example/v1/',
      organization: 'org-123',
    });

    const response = await provider.complete('Prompt body', 'gpt-4o-mini', {
      temperature: 0.2,
      maxTokens: 64,
      systemPrompt: 'Return JSON',
      stopSequences: ['END'],
      responseFormat: { type: 'json' },
    });

    expect(provider.providerType).toBe(ProviderType.OPENAI);
    expect(provider.getModelForTier(ModelTier.FAST)).toBe('gpt-4o-mini');
    expect(provider.getModelForTier('unknown')).toBe('gpt-4o');
    expect(response.content).toBe('{"message":"ok"}');
    expect(response.modelUsed).toBe('gpt-4o-mini');
    expect(response.provider).toBe(ProviderType.OPENAI);
    expect(response.usage.totalTokens).toBe(15);
    expect(response.usage.estimatedCost).toBeCloseTo((10 * 0.00015 + 5 * 0.0006) / 1000);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body));

    expect(url).toBe('https://openai.example/v1/chat/completions');
    expect(headers['Authorization']).toBe('Bearer env-openai-key');
    expect(headers['OpenAI-Organization']).toBe('org-123');
    expect(body).toMatchObject({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 64,
      stop: ['END'],
      response_format: { type: 'json_object' },
    });
    expect(body.messages).toEqual([
      { role: 'system', content: 'Return JSON' },
      { role: 'user', content: 'Prompt body' },
    ]);
  });

  it('normalizes empty completion responses when usage metadata is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [
        { message: { content: null } },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });
    const response = await provider.complete('Prompt', 'unknown-model');

    expect(response.content).toBe('');
    expect(response.usage.promptTokens).toBe(0);
    expect(response.usage.completionTokens).toBe(0);
    expect(response.usage.totalTokens).toBe(0);
    expect(response.usage.estimatedCost).toBe(0);
  });

  it('maps fetch and API failures to unified LLM errors', async () => {
    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rate limit exceeded')));
    await expect(provider.complete('Prompt', 'model')).rejects.toThrow(RateLimitError);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('token length exceeded', {
      status: 400,
    })));
    await expect(provider.complete('Prompt', 'model')).rejects.toThrow(TokenLimitError);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('service unavailable', {
      status: 503,
    })));
    await expect(provider.complete('Prompt', 'model')).rejects.toThrow(ProviderUnavailableError);
  });

  it('streams SSE chunks, emits usage metadata, and skips malformed events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createStreamResponse([
      'data: {"choices":[{"delta":{"content":"Alpha"}}]}\n',
      'event: ping\n',
      'data: {bad json}\n',
      'data: {"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}\n',
      'data: [DONE]\n',
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });
    const chunks = await collectStream(provider.streamComplete('Prompt', 'gpt-4o-mini', {
      maxTokens: 32,
      systemPrompt: 'Stream it',
      stopSequences: ['END'],
    }));

    expect(chunks).toEqual([
      { content: 'Alpha', isFinal: false, usage: null },
      {
        content: '',
        isFinal: true,
        usage: expect.objectContaining({
          promptTokens: 5,
          completionTokens: 2,
          totalTokens: 7,
        }),
      },
    ]);

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.stop).toEqual(['END']);
  });

  it('returns an empty stream when the upstream response has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });
    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).resolves.toEqual([]);
  });

  it('maps stream transport and reader failures to unified errors', async () => {
    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rate limit exceeded')));
    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).rejects.toThrow(
      RateLimitError,
    );

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('service unavailable', {
      status: 503,
    })));
    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).rejects.toThrow(
      ProviderUnavailableError,
    );

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader() {
          return {
            read: vi.fn().mockRejectedValue(new Error('token length exceeded')),
          };
        },
      },
    } as unknown as Response));

    await expect(collectStream(provider.streamComplete('Prompt', 'model'))).rejects.toThrow(
      TokenLimitError,
    );
  });

  it('healthCheck reflects completion success and failure', async () => {
    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200 })));
    await expect(provider.healthCheck()).resolves.toBe(true);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(provider.healthCheck()).resolves.toBe(false);
  });
});

describe('knowledge/providers/openai-embedding', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = 'env-openai-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.OPENAI_API_KEY = originalApiKey;
  });

  it('builds embedding requests, includes custom dimensions, and computes usage cost', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { embedding: [0.1, 0.2] },
        { embedding: [0.3, 0.4] },
      ],
      usage: {
        prompt_tokens: 100,
        total_tokens: 100,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIEmbeddingProvider({
      baseUrl: 'https://openai.example/v1/',
      organization: 'org-123',
    });

    const response = await provider.embed(['alpha', 'beta'], 'text-embedding-3-small', {
      dimensions: 256,
    });

    expect(provider.providerType).toBe(ProviderType.OPENAI);
    expect(provider.getDimensions('text-embedding-3-large')).toBe(3072);
    expect(provider.getDimensions('unknown-model')).toBe(1536);
    expect(response.embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(response.dimensions).toBe(2);
    expect(response.provider).toBe(ProviderType.OPENAI);
    expect(response.usage.totalTokens).toBe(100);
    expect(response.usage.estimatedCost).toBeCloseTo((100 * 0.02) / 1_000_000);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body));

    expect(url).toBe('https://openai.example/v1/embeddings');
    expect(headers['Authorization']).toBe('Bearer env-openai-key');
    expect(headers['OpenAI-Organization']).toBe('org-123');
    expect(body).toMatchObject({
      model: 'text-embedding-3-small',
      input: ['alpha', 'beta'],
      dimensions: 256,
    });
  });

  it('uses the default model, omits unsupported dimensions, and handles empty embeddings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [],
      usage: {
        prompt_tokens: 5,
        total_tokens: 5,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIEmbeddingProvider({
      apiKey: 'explicit-key',
      defaultModel: 'text-embedding-3-large',
    });

    const response = await provider.embed(['only'], '', { dimensions: 128 });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));

    expect(body.model).toBe('text-embedding-3-large');
    expect(body.dimensions).toBeUndefined();
    expect(response.dimensions).toBe(0);
    expect(response.usage.estimatedCost).toBe(0);
  });

  it('omits the authorization header when no api key is configured anywhere', async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: [0.5, 0.6] }],
      usage: {
        prompt_tokens: 3,
        total_tokens: 3,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAIEmbeddingProvider({
      apiKey: undefined,
      baseUrl: 'https://openai.example/v1/',
    });

    await provider.embed(['alpha'], 'text-embedding-3-small');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('maps embedding fetch and API failures to EmbeddingError', async () => {
    const provider = new OpenAIEmbeddingProvider({ apiKey: 'explicit-key' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(provider.embed(['alpha'], 'text-embedding-3-small')).rejects.toThrow(EmbeddingError);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', {
      status: 400,
    })));
    await expect(provider.embed(['alpha'], 'text-embedding-3-small')).rejects.toThrow(EmbeddingError);
  });

  it('healthCheck reflects embedding success and failure', async () => {
    const provider = new OpenAIEmbeddingProvider({ apiKey: 'explicit-key' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: [1, 2, 3] }],
      usage: { prompt_tokens: 1, total_tokens: 1 },
    }), { status: 200 })));
    await expect(provider.healthCheck()).resolves.toBe(true);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(provider.healthCheck()).resolves.toBe(false);
  });
});
