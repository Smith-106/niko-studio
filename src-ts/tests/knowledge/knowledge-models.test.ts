/**
 * Knowledge Models Tests
 *
 * Tests data models, factory functions, enums, and error classes
 * from the knowledge module.
 */

import { describe, expect, it } from 'vitest';

import {
  ModelTier,
  ProviderType,
  createTokenUsage,
  createLLMRequest,
  createLLMResponse,
  createEmbeddingRequest,
  createEmbeddingResponse,
  createProviderConfig,
  createServiceConfig,
  LLMError,
  RateLimitError,
  TokenLimitError,
  ProviderUnavailableError,
  EmbeddingError,
} from '../../knowledge/models';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModelTier', () => {
  it('has expected values', () => {
    expect(ModelTier.FAST).toBe('fast');
    expect(ModelTier.DEFAULT).toBe('default');
    expect(ModelTier.POWERFUL).toBe('powerful');
  });

  it('has exactly 3 values', () => {
    expect(Object.keys(ModelTier).length).toBe(3);
  });
});

describe('ProviderType', () => {
  it('has expected values', () => {
    expect(ProviderType.OPENAI).toBe('openai');
    expect(ProviderType.ANTHROPIC).toBe('anthropic');
    expect(ProviderType.AZURE).toBe('azure');
    expect(ProviderType.LOCAL).toBe('local');
  });

  it('has exactly 4 values', () => {
    expect(Object.keys(ProviderType).length).toBe(4);
  });
});

describe('createTokenUsage', () => {
  it('creates with defaults', () => {
    const usage = createTokenUsage();
    expect(usage.promptTokens).toBe(0);
    expect(usage.completionTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.estimatedCost).toBe(0.0);
  });

  it('creates with overrides', () => {
    const usage = createTokenUsage({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.003,
    });
    expect(usage.promptTokens).toBe(100);
    expect(usage.completionTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
    expect(usage.estimatedCost).toBe(0.003);
  });

  it('allows partial overrides', () => {
    const usage = createTokenUsage({ promptTokens: 200 });
    expect(usage.promptTokens).toBe(200);
    expect(usage.completionTokens).toBe(0);
  });
});

describe('createLLMRequest', () => {
  it('creates with defaults', () => {
    const req = createLLMRequest();
    expect(req.prompt).toBe('');
    expect(req.modelTier).toBe(ModelTier.DEFAULT);
    expect(req.modelOverride).toBeNull();
    expect(req.temperature).toBe(0.7);
    expect(req.maxTokens).toBeNull();
    expect(req.stopSequences).toEqual([]);
    expect(req.systemPrompt).toBeNull();
    expect(req.responseFormat).toBeNull();
  });

  it('creates with overrides', () => {
    const req = createLLMRequest({
      prompt: 'Write a story',
      modelTier: ModelTier.POWERFUL,
      temperature: 0.9,
      maxTokens: 2000,
      systemPrompt: 'You are a writer.',
    });
    expect(req.prompt).toBe('Write a story');
    expect(req.modelTier).toBe(ModelTier.POWERFUL);
    expect(req.temperature).toBe(0.9);
    expect(req.maxTokens).toBe(2000);
    expect(req.systemPrompt).toBe('You are a writer.');
  });
});

describe('createLLMResponse', () => {
  it('creates with defaults', () => {
    const resp = createLLMResponse();
    expect(resp.content).toBe('');
    expect(resp.modelUsed).toBe('');
    expect(resp.provider).toBe(ProviderType.OPENAI);
    expect(resp.latencyMs).toBe(0);
    expect(resp.cached).toBe(false);
    expect(resp.usage.promptTokens).toBe(0);
  });

  it('creates with overrides', () => {
    const resp = createLLMResponse({
      content: 'Generated text',
      modelUsed: 'gpt-4o',
      provider: ProviderType.OPENAI,
      latencyMs: 1500,
      cached: true,
    });
    expect(resp.content).toBe('Generated text');
    expect(resp.modelUsed).toBe('gpt-4o');
    expect(resp.cached).toBe(true);
    expect(resp.latencyMs).toBe(1500);
  });
});

describe('createEmbeddingRequest', () => {
  it('creates with defaults', () => {
    const req = createEmbeddingRequest();
    expect(req.texts).toEqual([]);
    expect(req.modelTier).toBe(ModelTier.DEFAULT);
    expect(req.modelOverride).toBeNull();
    expect(req.dimensions).toBeNull();
  });

  it('creates with overrides', () => {
    const req = createEmbeddingRequest({
      texts: ['text one', 'text two'],
      modelTier: ModelTier.FAST,
      dimensions: 512,
    });
    expect(req.texts).toEqual(['text one', 'text two']);
    expect(req.modelTier).toBe(ModelTier.FAST);
    expect(req.dimensions).toBe(512);
  });
});

describe('createEmbeddingResponse', () => {
  it('creates with defaults', () => {
    const resp = createEmbeddingResponse();
    expect(resp.embeddings).toEqual([]);
    expect(resp.modelUsed).toBe('');
    expect(resp.provider).toBe(ProviderType.OPENAI);
    expect(resp.dimensions).toBe(0);
    expect(resp.cacheHits).toBe(0);
  });

  it('creates with overrides', () => {
    const resp = createEmbeddingResponse({
      embeddings: [[0.1, 0.2]],
      modelUsed: 'text-embedding-3-small',
      dimensions: 2,
      cacheHits: 1,
    });
    expect(resp.embeddings).toEqual([[0.1, 0.2]]);
    expect(resp.dimensions).toBe(2);
    expect(resp.cacheHits).toBe(1);
  });
});

describe('createProviderConfig', () => {
  it('creates with defaults', () => {
    const config = createProviderConfig();
    expect(config.provider).toBe(ProviderType.OPENAI);
    expect(config.apiKey).toBeNull();
    expect(config.baseUrl).toBeNull();
    expect(config.organization).toBeNull();
    expect(config.modelMapping[ModelTier.FAST]).toBe('');
    expect(config.embeddingModel).toBe('');
    expect(config.maxRetries).toBe(3);
    expect(config.timeout).toBe(60.0);
    expect(config.rateLimitRpm).toBe(60);
  });

  it('creates with full overrides', () => {
    const config = createProviderConfig({
      provider: ProviderType.ANTHROPIC,
      apiKey: 'ak-test',
      baseUrl: 'https://api.anthropic.com',
      organization: 'org-1',
      modelMapping: {
        [ModelTier.FAST]: 'claude-3-haiku',
        [ModelTier.DEFAULT]: 'claude-3-5-sonnet',
        [ModelTier.POWERFUL]: 'claude-3-opus',
      },
      embeddingModel: 'claude-embedding',
      maxRetries: 5,
      timeout: 120.0,
      rateLimitRpm: 30,
    });
    expect(config.provider).toBe(ProviderType.ANTHROPIC);
    expect(config.apiKey).toBe('ak-test');
    expect(config.modelMapping[ModelTier.DEFAULT]).toBe('claude-3-5-sonnet');
    expect(config.maxRetries).toBe(5);
    expect(config.rateLimitRpm).toBe(30);
  });
});

describe('createServiceConfig', () => {
  it('creates with defaults', () => {
    const config = createServiceConfig();
    expect(config.providers).toEqual([]);
    expect(config.defaultLLMProvider).toBe(ProviderType.OPENAI);
    expect(config.defaultEmbeddingProvider).toBe(ProviderType.OPENAI);
    expect(config.embeddingCacheEnabled).toBe(true);
    expect(config.embeddingCacheTTL).toBe(86400);
    expect(config.embeddingCacheMaxSize).toBe(10000);
    expect(config.retryMaxAttempts).toBe(3);
    expect(config.retryInitialDelay).toBe(1.0);
    expect(config.retryMaxDelay).toBe(60.0);
    expect(config.retryExponentialBase).toBe(2.0);
    expect(config.healthCheckInterval).toBe(60);
  });

  it('creates with custom providers', () => {
    const config = createServiceConfig({
      providers: [
        createProviderConfig({
          provider: ProviderType.OPENAI,
          apiKey: 'sk-key',
        }),
        createProviderConfig({
          provider: ProviderType.ANTHROPIC,
          apiKey: 'ak-key',
        }),
      ],
      defaultLLMProvider: ProviderType.ANTHROPIC,
      healthCheckInterval: 30,
    });
    expect(config.providers.length).toBe(2);
    expect(config.defaultLLMProvider).toBe(ProviderType.ANTHROPIC);
    expect(config.healthCheckInterval).toBe(30);
  });
});

describe('Error classes', () => {
  describe('LLMError', () => {
    it('creates with message only', () => {
      const err = new LLMError('test error');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('LLMError');
      expect(err.message).toBe('test error');
      expect(err.provider).toBeNull();
    });

    it('creates with provider', () => {
      const err = new LLMError('test', ProviderType.OPENAI);
      expect(err.message).toBe('[openai] test');
      expect(err.provider).toBe(ProviderType.OPENAI);
    });

    it('formats message with provider in brackets', () => {
      const err = new LLMError('failure', ProviderType.ANTHROPIC);
      expect(err.message).toBe('[anthropic] failure');
    });
  });

  describe('RateLimitError', () => {
    it('extends LLMError', () => {
      const err = new RateLimitError();
      expect(err).toBeInstanceOf(LLMError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('RateLimitError');
    });

    it('has default message', () => {
      const err = new RateLimitError();
      expect(err.message).toBe('Rate limit exceeded');
    });

    it('accepts custom message and retryAfter', () => {
      const err = new RateLimitError('Custom limit', ProviderType.OPENAI, 30);
      expect(err.message).toBe('[openai] Custom limit');
      expect(err.retryAfter).toBe(30);
    });

    it('retryAfter defaults to null', () => {
      const err = new RateLimitError();
      expect(err.retryAfter).toBeNull();
    });
  });

  describe('TokenLimitError', () => {
    it('extends LLMError', () => {
      const err = new TokenLimitError();
      expect(err).toBeInstanceOf(LLMError);
      expect(err.name).toBe('TokenLimitError');
    });

    it('has default message', () => {
      const err = new TokenLimitError();
      expect(err.message).toBe('Token limit exceeded');
    });

    it('accepts tokenCount and tokenLimit', () => {
      const err = new TokenLimitError('Too many tokens', ProviderType.OPENAI, 8000, 4096);
      expect(err.tokenCount).toBe(8000);
      expect(err.tokenLimit).toBe(4096);
    });

    it('tokenCount and tokenLimit default to null', () => {
      const err = new TokenLimitError();
      expect(err.tokenCount).toBeNull();
      expect(err.tokenLimit).toBeNull();
    });
  });

  describe('ProviderUnavailableError', () => {
    it('extends LLMError', () => {
      const err = new ProviderUnavailableError();
      expect(err).toBeInstanceOf(LLMError);
      expect(err.name).toBe('ProviderUnavailableError');
    });

    it('has default message and fallbackAvailable=false', () => {
      const err = new ProviderUnavailableError();
      expect(err.message).toBe('Provider unavailable');
      expect(err.fallbackAvailable).toBe(false);
    });

    it('accepts fallbackAvailable=true', () => {
      const err = new ProviderUnavailableError('Down', ProviderType.ANTHROPIC, true);
      expect(err.fallbackAvailable).toBe(true);
      expect(err.provider).toBe(ProviderType.ANTHROPIC);
    });
  });

  describe('EmbeddingError', () => {
    it('extends Error', () => {
      const err = new EmbeddingError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('EmbeddingError');
      expect(err.message).toBe('test');
    });

    it('accepts provider', () => {
      const err = new EmbeddingError('embedding failed', ProviderType.OPENAI);
      expect(err.message).toBe('[openai] embedding failed');
      expect(err.provider).toBe(ProviderType.OPENAI);
    });

    it('provider defaults to null', () => {
      const err = new EmbeddingError('no provider');
      expect(err.provider).toBeNull();
      expect(err.message).toBe('no provider');
    });
  });
});
