import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LLMProvider, LLMResponse, StreamChunk } from '../../protocols/llm';
import {
  LLMError,
  LLMServiceImpl,
  ProviderType,
  ProviderUnavailableError,
} from '../../services/llm-service';

type MockProvider = LLMProvider & {
  complete: ReturnType<typeof vi.fn>;
  streamComplete: ReturnType<typeof vi.fn>;
  healthCheck: ReturnType<typeof vi.fn>;
  getModelForTier: ReturnType<typeof vi.fn>;
};

function createProvider(options: {
  providerType?: ProviderType;
  completeImpl?: (
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
      responseFormat?: Record<string, unknown>;
    },
  ) => Promise<LLMResponse>;
  streamImpl?: (
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    },
  ) => AsyncIterableIterator<StreamChunk>;
} = {}): MockProvider {
  const providerType = options.providerType ?? ProviderType.OPENAI;

  return {
    providerType,
    complete: vi.fn(
      options.completeImpl ??
        (async (prompt: string, model: string) => ({
          content: `${providerType}:${model}:${prompt}`,
          metadata: {},
        })),
    ),
    streamComplete: vi.fn(
      options.streamImpl ??
        ((prompt: string, model: string) =>
          (async function* () {
            yield { content: `${providerType}:${model}:${prompt}`, isFinished: false };
            yield { content: '', isFinished: true };
          })()),
    ),
    healthCheck: vi.fn(async () => true),
    getModelForTier: vi.fn((tier: string) => `${providerType}:${tier}`),
  };
}

async function collectStream(stream: AsyncIterableIterator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('services/llm-service branch-gap coverage', () => {
  it('normalizes non-Error provider failures during fallback and retry handling', async () => {
    const provider = createProvider({
      completeImpl: async () => {
        throw 'primitive failure';
      },
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { retry: { maxRetries: 0, baseDelay: 1, maxDelay: 1 } },
    );

    await expect(service.generate('primitive')).rejects.toThrow(ProviderUnavailableError);
    await expect(service.generate('primitive')).rejects.toThrow(
      'All providers failed for generateWithMetadata: primitive failure',
    );
  });

  it('handles negative retry budgets by exhausting retry flow immediately', async () => {
    const provider = createProvider();
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { retry: { maxRetries: -1, baseDelay: 1, maxDelay: 1 } },
    );

    await expect(service.generate('skip retries')).rejects.toThrow(ProviderUnavailableError);
    await expect(service.generate('skip retries')).rejects.toThrow(
      'All providers failed for generateWithMetadata: undefined',
    );
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it('passes explicit JSON options through without appending extra JSON instructions', async () => {
    const provider = createProvider({
      completeImpl: async () => ({
        content: '{"status":"ok"}',
        metadata: {},
      }),
    });
    const service = new LLMServiceImpl({ [ProviderType.OPENAI]: provider });

    const result = await service.generateJson('return json', {
      model: 'custom-json-model',
      temperature: 0.15,
      maxTokens: 64,
      systemPrompt: 'Reply in JSON format only.',
    });

    expect(result).toEqual({ status: 'ok' });
    expect(provider.complete).toHaveBeenCalledWith(
      'return json',
      'custom-json-model',
      expect.objectContaining({
        temperature: 0.15,
        maxTokens: 64,
        systemPrompt: 'Reply in JSON format only.',
        responseFormat: { type: 'json' },
      }),
    );
  });

  it('wraps non-Error JSON parse failures in an LLMError', async () => {
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw 'bad json payload';
    });
    const provider = createProvider({
      completeImpl: async () => ({
        content: '{"status":"broken"}',
        metadata: {},
      }),
    });
    const service = new LLMServiceImpl({ [ProviderType.OPENAI]: provider });

    await expect(service.generateJson('broken json')).rejects.toThrow(LLMError);
    await expect(service.generateJson('broken json')).rejects.toThrow(
      'Failed to parse JSON response: bad json payload',
    );

    parseSpy.mockRestore();
  });

  it('retries stream calls on 5xx errors without retry-after and then succeeds', async () => {
    vi.useFakeTimers();
    let attempts = 0;

    const provider = createProvider({
      streamImpl: () =>
        (async function* () {
          attempts += 1;
          if (attempts === 1) {
            const error = new Error('temporary outage') as Error & { status: number };
            error.status = 503;
            throw error;
          }
          yield { content: 'recovered', isFinished: false };
          yield { content: '', isFinished: true };
        })(),
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { retry: { baseDelay: 5, maxDelay: 5, maxRetries: 1 } },
    );

    const pending = collectStream(service.stream('retry stream'));
    await vi.runAllTimersAsync();
    const chunks = await pending;

    expect(attempts).toBe(2);
    expect(chunks).toEqual([
      { content: 'recovered', isFinished: false },
      { content: '', isFinished: true },
    ]);
  });

  it('falls back after primitive stream failures and reports null budget state', async () => {
    const failing = createProvider({
      providerType: ProviderType.OPENAI,
      streamImpl: () =>
        (async function* () {
          throw 'primitive stream failure';
        })(),
    });
    const backup = createProvider({
      providerType: ProviderType.ANTHROPIC,
    });
    const service = new LLMServiceImpl(
      new Map([
        [ProviderType.OPENAI, failing],
        [ProviderType.ANTHROPIC, backup],
      ]),
      { defaultProvider: ProviderType.OPENAI, retry: { maxRetries: 0, baseDelay: 1, maxDelay: 1 } },
    );

    const chunks = await collectStream(service.stream('fallback stream'));

    expect(chunks.map((chunk) => chunk.content)).toEqual(['anthropic:anthropic:default:fallback stream', '']);
    expect(service.getBudgetStatus()).toEqual({ used: 0, budget: null, remaining: null });
  });

  it('tracks zero-token usage when usage metadata is present but empty', async () => {
    const provider = createProvider({
      completeImpl: async () => ({
        content: 'ok',
        metadata: {},
        usage: {},
      }),
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { tokenBudget: 9 },
    );

    await service.generateWithMetadata({ prompt: 'empty usage', maxTokens: 2 });

    expect(service.getBudgetStatus()).toEqual({ used: 0, budget: 9, remaining: 9 });
  });
});
