import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ModelTier,
  ProviderType,
  createLLMRequest,
  createServiceConfig,
} from '../../knowledge/models.js';
import { ServiceManager } from '../../knowledge/manager.js';

const openaiGetModelForTier = vi.hoisted(() =>
  vi.fn((tier: string) => `openai-${tier}`),
);
const openaiComplete = vi.hoisted(() =>
  vi.fn(async () => ({
    content: 'ok',
    modelUsed: 'unused',
    provider: ProviderType.OPENAI,
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    latencyMs: 0,
    cached: false,
  })),
);
const openaiStreamComplete = vi.hoisted(() =>
  vi.fn(() =>
    (async function* () {
      yield { content: 'stream', isFinal: false, usage: null };
    })()),
);
const openaiHealthCheck = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const openaiEmbeddingEmbed = vi.hoisted(() =>
  vi.fn(async () => [[1, 2, 3]]),
);
const openaiEmbeddingHealthCheck = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('../../knowledge/providers', () => ({
  OpenAILLMProvider: vi.fn().mockImplementation(function OpenAILLMProvider(
    this: Record<string, unknown>,
  ) {
    Object.assign(this, {
      providerType: ProviderType.OPENAI,
      getModelForTier: openaiGetModelForTier,
      complete: openaiComplete,
      streamComplete: openaiStreamComplete,
      healthCheck: openaiHealthCheck,
    });
  }),
  AnthropicLLMProvider: vi.fn().mockImplementation(function AnthropicLLMProvider(
    this: Record<string, unknown>,
  ) {
    Object.assign(this, {
      providerType: ProviderType.ANTHROPIC,
      getModelForTier: vi.fn(),
      complete: vi.fn(),
      streamComplete: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue(true),
    });
  }),
  OpenAIEmbeddingProvider: vi.fn().mockImplementation(function OpenAIEmbeddingProvider(
    this: Record<string, unknown>,
  ) {
    Object.assign(this, {
      providerType: ProviderType.OPENAI,
      getModel: () => 'text-embedding-3-small',
      embed: openaiEmbeddingEmbed,
      healthCheck: openaiEmbeddingHealthCheck,
    });
  }),
  LocalEmbeddingProvider: vi.fn().mockImplementation(function LocalEmbeddingProvider(
    this: Record<string, unknown>,
  ) {
    Object.assign(this, {
      providerType: ProviderType.LOCAL,
      getModel: () => 'local-model',
      embed: vi.fn(async () => [[9, 9, 9]]),
      healthCheck: vi.fn().mockResolvedValue(true),
    });
  }),
}));

describe('ServiceManager branch-gap additional coverage', () => {
  beforeEach(() => {
    ServiceManager.resetInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    ServiceManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('hits wrapper default branches for llm and embedding providers', async () => {
    const manager = ServiceManager.getInstance(createServiceConfig({
      embeddingCacheEnabled: false,
      defaultEmbeddingProvider: ProviderType.OPENAI,
      providers: [
        {
          provider: ProviderType.OPENAI,
          apiKey: 'sk-test',
          baseUrl: null,
          organization: null,
          modelMapping: {
            [ModelTier.FAST]: 'fast',
            [ModelTier.DEFAULT]: 'default',
            [ModelTier.POWERFUL]: 'powerful',
          },
          embeddingModel: 'text-embedding-3-small',
          maxRetries: 1,
          timeout: 30,
          rateLimitRpm: 60,
        },
      ],
    }));
    await manager.initialize();

    const internals = manager as unknown as {
      _llmProviders: Map<string, {
        generate: (request: ReturnType<typeof createLLMRequest>) => Promise<unknown>;
        streamGenerate: (request: ReturnType<typeof createLLMRequest>) => AsyncGenerator<{ content: string }>;
      }>;
      _embeddingProviders: Map<string, {
        embed: (texts: string[], model?: string | null) => Promise<number[][]>;
      }>;
    };

    const llmProvider = internals._llmProviders.get(ProviderType.OPENAI)!;
    await llmProvider.generate(createLLMRequest({
      prompt: 'wrapper prompt',
      modelTier: ModelTier.FAST,
      modelOverride: null,
      maxTokens: null,
      systemPrompt: null,
      responseFormat: null,
      stopSequences: ['STOP'],
    }));

    const streamed: string[] = [];
    for await (const chunk of llmProvider.streamGenerate(createLLMRequest({
      prompt: 'wrapper stream',
      modelTier: ModelTier.POWERFUL,
      modelOverride: null,
      maxTokens: null,
      systemPrompt: null,
    }))) {
      streamed.push(chunk.content);
    }

    const embeddingProvider = internals._embeddingProviders.get(ProviderType.OPENAI)!;
    await embeddingProvider.embed(['embedding text'], null);

    expect(openaiGetModelForTier).toHaveBeenCalledWith(ModelTier.FAST);
    expect(openaiGetModelForTier).toHaveBeenCalledWith(ModelTier.POWERFUL);
    expect(openaiComplete).toHaveBeenCalledWith('wrapper prompt', 'openai-fast', {
      temperature: 0.7,
      maxTokens: undefined,
      systemPrompt: undefined,
      stopSequences: ['STOP'],
      responseFormat: undefined,
    });
    expect(openaiStreamComplete).toHaveBeenCalledWith('wrapper stream', 'openai-powerful', {
      temperature: 0.7,
      maxTokens: undefined,
      systemPrompt: undefined,
      stopSequences: [],
    });
    expect(openaiEmbeddingEmbed).toHaveBeenCalledWith(['embedding text'], '');
    expect(streamed).toEqual(['stream']);
  });
});
