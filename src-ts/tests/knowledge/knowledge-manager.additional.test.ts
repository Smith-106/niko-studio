import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ModelTier,
  ProviderType,
  createEmbeddingRequest,
  createEmbeddingResponse,
  createLLMRequest,
  createLLMResponse,
  createServiceConfig,
  createTokenUsage,
} from '../../knowledge/models.js';

const cacheCtorCalls = vi.hoisted(() => [] as Array<[number, number]>);
const cacheGetBatch = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const cacheSetBatch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const cacheStats = vi.hoisted(() => vi.fn().mockResolvedValue({
  size: 0,
  maxSize: 10,
  coldSize: 0,
  hits: 0,
  misses: 0,
  coldHits: 0,
  hitRate: 0,
  defaultTTL: 60,
}));
const cacheClear = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const cacheClose = vi.hoisted(() => vi.fn());

const openaiLLMCtor = vi.hoisted(() => vi.fn());
const openaiGetModelForTier = vi.hoisted(() => vi.fn((tier: string) => `openai-${tier}`));
const openaiComplete = vi.hoisted(() => vi.fn(async (
  prompt: string,
  model: string,
  options?: Record<string, unknown>,
) => createLLMResponse({
  content: `${prompt}:${model}:${String(options?.temperature ?? '')}`,
  modelUsed: model,
  provider: ProviderType.OPENAI,
  usage: createTokenUsage({ totalTokens: 3 }),
  latencyMs: 5,
})));
const openaiStreamComplete = vi.hoisted(() => vi.fn(() => (async function* () {
  yield { content: 'openai-stream', isFinal: false, usage: null };
  yield { content: '', isFinal: true, usage: createTokenUsage({ totalTokens: 2 }) };
})()));
const openaiHealthCheck = vi.hoisted(() => vi.fn().mockResolvedValue(true));

const anthropicLLMCtor = vi.hoisted(() => vi.fn());
const anthropicGetModelForTier = vi.hoisted(() => vi.fn((tier: string) => `anthropic-${tier}`));
const anthropicComplete = vi.hoisted(() => vi.fn(async (
  prompt: string,
  model: string,
) => createLLMResponse({
  content: `${prompt}:${model}`,
  modelUsed: model,
  provider: ProviderType.ANTHROPIC,
  usage: createTokenUsage({ totalTokens: 4 }),
  latencyMs: 6,
})));
const anthropicStreamComplete = vi.hoisted(() => vi.fn(() => (async function* () {
  yield { content: 'anthropic-stream', isFinal: false, usage: null };
})()));
const anthropicHealthCheck = vi.hoisted(() => vi.fn().mockResolvedValue(true));

const openaiEmbeddingCtor = vi.hoisted(() => vi.fn());
const openaiEmbeddingGetDimensions = vi.hoisted(() => vi.fn(() => 1536));
const openaiEmbeddingEmbed = vi.hoisted(() => vi.fn(async (
  texts: string[],
  model: string,
) => createEmbeddingResponse({
  embeddings: texts.map((_text, index) => [index + 1, index + 2]),
  modelUsed: model,
  provider: ProviderType.OPENAI,
  dimensions: 2,
  usage: createTokenUsage({ totalTokens: texts.length }),
  latencyMs: 7,
})));
const openaiEmbeddingHealthCheck = vi.hoisted(() => vi.fn().mockResolvedValue(true));

const localEmbeddingCtor = vi.hoisted(() => vi.fn());
const localEmbeddingGetDimensions = vi.hoisted(() => vi.fn(() => 384));
const localEmbeddingEmbed = vi.hoisted(() => vi.fn(async (
  texts: string[],
  model: string,
) => createEmbeddingResponse({
  embeddings: texts.map((_text, index) => [index + 10, index + 20, index + 30]),
  modelUsed: model,
  provider: ProviderType.LOCAL,
  dimensions: 3,
  usage: createTokenUsage(),
  latencyMs: 3,
})));
const localEmbeddingHealthCheck = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock('../../knowledge/cache', () => ({
  TieredEmbeddingCache: vi.fn().mockImplementation(function TieredEmbeddingCache(
    this: Record<string, unknown>,
    maxSize: number,
    ttl: number,
  ) {
    cacheCtorCalls.push([maxSize, ttl]);
    Object.assign(this, {
      getBatch: cacheGetBatch,
      setBatch: cacheSetBatch,
      stats: cacheStats,
      clear: cacheClear,
      close: cacheClose,
    });
  }),
}));

vi.mock('../../knowledge/providers', () => ({
  OpenAILLMProvider: vi.fn().mockImplementation(function OpenAILLMProvider(
    this: Record<string, unknown>,
    params: Record<string, unknown>,
  ) {
    openaiLLMCtor(params);
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
    params: Record<string, unknown>,
  ) {
    anthropicLLMCtor(params);
    Object.assign(this, {
      providerType: ProviderType.ANTHROPIC,
      getModelForTier: anthropicGetModelForTier,
      complete: anthropicComplete,
      streamComplete: anthropicStreamComplete,
      healthCheck: anthropicHealthCheck,
    });
  }),
  OpenAIEmbeddingProvider: vi.fn().mockImplementation(function OpenAIEmbeddingProvider(
    this: Record<string, unknown>,
    params: Record<string, unknown>,
  ) {
    openaiEmbeddingCtor(params);
    Object.assign(this, {
      providerType: ProviderType.OPENAI,
      getDimensions: openaiEmbeddingGetDimensions,
      embed: openaiEmbeddingEmbed,
      healthCheck: openaiEmbeddingHealthCheck,
    });
  }),
  LocalEmbeddingProvider: vi.fn().mockImplementation(function LocalEmbeddingProvider(
    this: Record<string, unknown>,
    params: Record<string, unknown>,
  ) {
    localEmbeddingCtor(params);
    Object.assign(this, {
      providerType: ProviderType.LOCAL,
      getDimensions: localEmbeddingGetDimensions,
      embed: localEmbeddingEmbed,
      healthCheck: localEmbeddingHealthCheck,
    });
  }),
}));

describe('knowledge/manager additional coverage', () => {
  beforeEach(() => {
    cacheCtorCalls.length = 0;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { ServiceManager } = await import('../../knowledge/manager.js');
    ServiceManager.resetInstance();
  });

  it('initializes configured providers and routes wrapper calls through real services', async () => {
    const { ServiceManager } = await import('../../knowledge/manager.js');
    const config = createServiceConfig({
      providers: [
        {
          provider: ProviderType.OPENAI,
          apiKey: 'sk-openai',
          baseUrl: 'https://openai.example.com',
          organization: 'org-1',
          modelMapping: {
            [ModelTier.FAST]: 'fast-openai',
            [ModelTier.DEFAULT]: 'default-openai',
            [ModelTier.POWERFUL]: 'power-openai',
          },
          embeddingModel: 'text-embedding-3-small',
          maxRetries: 5,
          timeout: 12,
          rateLimitRpm: 60,
        },
        {
          provider: ProviderType.ANTHROPIC,
          apiKey: 'sk-anthropic',
          baseUrl: 'https://anthropic.example.com',
          organization: null,
          modelMapping: {
            [ModelTier.FAST]: 'fast-anthropic',
            [ModelTier.DEFAULT]: 'default-anthropic',
            [ModelTier.POWERFUL]: 'power-anthropic',
          },
          embeddingModel: '',
          maxRetries: 4,
          timeout: 20,
          rateLimitRpm: 50,
        },
        {
          provider: ProviderType.LOCAL,
          apiKey: null,
          baseUrl: 'sentence-transformers',
          organization: null,
          modelMapping: {
            [ModelTier.FAST]: '',
            [ModelTier.DEFAULT]: '',
            [ModelTier.POWERFUL]: '',
          },
          embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
          maxRetries: 2,
          timeout: 5,
          rateLimitRpm: 1,
        },
      ],
      defaultLLMProvider: ProviderType.ANTHROPIC,
      defaultEmbeddingProvider: ProviderType.LOCAL,
      retryMaxAttempts: 7,
      retryInitialDelay: 2,
      embeddingCacheMaxSize: 42,
      embeddingCacheTTL: 360,
    });

    const manager = ServiceManager.getInstance(config);
    await manager.initialize();

    expect(cacheCtorCalls).toEqual([[42, 360]]);
    expect(openaiLLMCtor).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'sk-openai',
      baseUrl: 'https://openai.example.com',
      organization: 'org-1',
      timeout: 12,
      maxRetries: 5,
    }));
    expect(anthropicLLMCtor).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'sk-anthropic',
      baseUrl: 'https://anthropic.example.com',
      timeout: 20,
      maxRetries: 4,
    }));
    expect(openaiEmbeddingCtor).toHaveBeenCalledWith(expect.objectContaining({
      defaultModel: 'text-embedding-3-small',
    }));
    expect(localEmbeddingCtor).toHaveBeenCalledWith({
      modelName: 'sentence-transformers/all-MiniLM-L6-v2',
      backend: 'sentence-transformers',
    });

    const llmText = await manager.llm.generate('Prompt text', {
      provider: ProviderType.OPENAI,
      model: ModelTier.POWERFUL,
      temperature: 0.25,
      maxTokens: 11,
      systemPrompt: 'system',
      stopSequences: ['STOP'],
    });
    expect(llmText).toBe('Prompt text:openai-powerful:0.25');
    expect(openaiComplete).toHaveBeenCalledWith('Prompt text', 'openai-powerful', {
      temperature: 0.25,
      maxTokens: 11,
      systemPrompt: 'system',
      stopSequences: ['STOP'],
      responseFormat: undefined,
    });

    const llmResponse = await manager.llm.generateWithMetadata(createLLMRequest({
      prompt: 'Anthropic prompt',
      modelTier: ModelTier.DEFAULT,
      modelOverride: 'anthropic-override',
      temperature: 0.1,
      maxTokens: 9,
      systemPrompt: 'anthropic-system',
      stopSequences: ['DONE'],
    }));
    expect(llmResponse.modelUsed).toBe('anthropic-override');
    expect(anthropicComplete).toHaveBeenCalledWith('Anthropic prompt', 'anthropic-override', {
      temperature: 0.1,
      maxTokens: 9,
      systemPrompt: 'anthropic-system',
      stopSequences: ['DONE'],
      responseFormat: undefined,
    });

    const streamedChunks: string[] = [];
    for await (const chunk of manager.llm.stream('Stream prompt', {
      provider: ProviderType.ANTHROPIC,
      model: ModelTier.FAST,
    })) {
      streamedChunks.push(chunk.content);
    }
    expect(streamedChunks).toEqual(['anthropic-stream']);
    expect(anthropicStreamComplete).toHaveBeenCalledWith('Stream prompt', 'anthropic-fast', {
      temperature: 0.7,
      maxTokens: undefined,
      systemPrompt: undefined,
      stopSequences: [],
    });

    const embedding = await manager.embedding.embed('embed me', {
      provider: ProviderType.OPENAI,
      model: 'text-embedding-3-small',
    });
    expect(embedding).toEqual([1, 2]);
    expect(openaiEmbeddingEmbed).toHaveBeenCalledWith(['embed me'], 'text-embedding-3-small');
    const embeddingProviders = (
      manager as unknown as {
        _embeddingProviders: Map<string, { getModel: () => string }>;
      }
    )._embeddingProviders;
    expect(embeddingProviders.get(ProviderType.OPENAI)?.getModel()).toBe('');

    const embeddingResponse = await manager.embedding.embedWithMetadata(createEmbeddingRequest({
      texts: ['a', 'b'],
      modelOverride: 'local-model',
    }));
    expect(embeddingResponse.provider).toBe(ProviderType.LOCAL);
    expect(embeddingResponse.embeddings).toEqual([
      [10, 20, 30],
      [11, 21, 31],
    ]);
    expect(localEmbeddingEmbed).toHaveBeenCalledWith(['a', 'b'], 'local-model');
    expect(cacheGetBatch).toHaveBeenCalled();
    expect(cacheSetBatch).toHaveBeenCalled();
  });

  it('injects default local embedding provider, reports health, and returns cache stats', async () => {
    const { ServiceManager } = await import('../../knowledge/manager.js');
    const config = createServiceConfig({
      providers: [],
      defaultEmbeddingProvider: ProviderType.LOCAL,
      embeddingCacheEnabled: true,
      embeddingCacheMaxSize: 8,
      embeddingCacheTTL: 60,
    });

    localEmbeddingHealthCheck.mockResolvedValue(true);

    const manager = ServiceManager.getInstance(config);
    await manager.initialize();

    const health = await manager.checkHealth();
    expect(localEmbeddingCtor).toHaveBeenCalledWith({
      modelName: 'BAAI/bge-small-en-v1.5',
      backend: 'fastembed',
    });
    expect(health).toEqual({ embedding_local: true });
    expect(manager.isHealthy()).toBe(true);
    expect(manager.getHealthStatus()).toEqual({ embedding_local: true });
    await expect(manager.getCacheStats()).resolves.toEqual({
      size: 0,
      maxSize: 10,
      coldSize: 0,
      hits: 0,
      misses: 0,
      coldHits: 0,
      hitRate: 0,
      defaultTTL: 60,
    });
  });

  it('throttles on-demand health checks and shuts down cached services safely', async () => {
    const { ServiceManager } = await import('../../knowledge/manager.js');
    const config = createServiceConfig({
      providers: [
        {
          provider: ProviderType.LOCAL,
          apiKey: null,
          baseUrl: 'unexpected-backend',
          organization: null,
          modelMapping: {
            [ModelTier.FAST]: '',
            [ModelTier.DEFAULT]: '',
            [ModelTier.POWERFUL]: '',
          },
          embeddingModel: 'BAAI/bge-small-en-v1.5',
          maxRetries: 1,
          timeout: 1,
          rateLimitRpm: 1,
        },
      ],
      embeddingCacheEnabled: true,
    });

    const manager = ServiceManager.getInstance(config);
    await manager.initialize();

    const checkHealthSpy = vi.spyOn(manager, 'checkHealth').mockResolvedValue({
      embedding_local: true,
    });
    const dateNowSpy = vi.spyOn(Date, 'now');
    const managerInternals = manager as unknown as { _lastHealthCheckMs: number };
    managerInternals._lastHealthCheckMs = 1_000;

    dateNowSpy.mockReturnValue(30_000);
    manager.triggerOnDemandHealthCheck();
    expect(checkHealthSpy).not.toHaveBeenCalled();

    dateNowSpy.mockReturnValue(70_500);
    manager.triggerOnDemandHealthCheck();
    await Promise.resolve();
    expect(checkHealthSpy).toHaveBeenCalledTimes(1);

    expect(localEmbeddingCtor).toHaveBeenCalledWith({
      modelName: 'BAAI/bge-small-en-v1.5',
      backend: 'fastembed',
    });

    manager.shutdown();
    expect(cacheClear).toHaveBeenCalled();
    expect(cacheClose).toHaveBeenCalled();
    expect(() => manager.llm).toThrow('not initialized');
    expect(() => manager.embedding).toThrow('not initialized');
  });
});
