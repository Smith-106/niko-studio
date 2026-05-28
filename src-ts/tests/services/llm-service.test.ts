/**
 * LLMService Tests
 *
 * Comprehensive test coverage for TypeScript LLMService implementation
 * Covers: provider management, retry logic, streaming, JSON generation, batch processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LLMServiceImpl,
  ModelTier,
  ProviderType,
  LLMError,
  RateLimitError,
  TokenLimitError,
  ProviderUnavailableError,
} from '../../services/llm-service';
import type { LLMProvider, LLMResponse, StreamChunk } from '../../protocols/llm';

// Mock LLM Provider
class MockLLMProvider implements LLMProvider {
  readonly providerType = 'mock' as ProviderType;

  private shouldFail = false;
  private failCount = 0;
  private callCount = 0;

  async complete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
      responseFormat?: Record<string, unknown>;
    }
  ): Promise<LLMResponse> {
    this.callCount++;

    if (this.shouldFail) {
      this.failCount++;
      throw new Error('Provider failed');
    }

    return {
      content: `Mock response for: ${prompt.slice(0, 20)}`,
      metadata: {
        model,
        provider: this.providerType,
        tokensUsed: 100,
      },
    };
  }

  async *streamComplete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): AsyncIterableIterator<StreamChunk> {
    const words = ['Mock', ' stream', ' response'];
    for (const word of words) {
      yield { content: word, isFinished: false };
    }
    yield { content: '', isFinished: true };
  }

  async healthCheck(): Promise<boolean> {
    return !this.shouldFail;
  }

  getModelForTier(tier: string): string {
    const models: Record<string, string> = {
      [ModelTier.FAST]: 'mock-fast',
      [ModelTier.DEFAULT]: 'mock-default',
      [ModelTier.POWERFUL]: 'mock-powerful',
    };
    return models[tier] || 'mock-default';
  }

  // Test helpers
  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  getCallCount(): number {
    return this.callCount;
  }

  getFailCount(): number {
    return this.failCount;
  }

  reset(): void {
    this.shouldFail = false;
    this.failCount = 0;
    this.callCount = 0;
  }
}

// Rate Limit Mock Provider
class RateLimitMockProvider implements LLMProvider {
  readonly providerType = ProviderType.OPENAI;
  private callCount = 0;

  async complete(): Promise<LLMResponse> {
    this.callCount++;
    if (this.callCount < 3) {
      throw new RateLimitError('Rate limit exceeded', ProviderType.OPENAI, 100);
    }
    return { content: 'Success after retries', metadata: {} };
  }

  async *streamComplete(): AsyncIterableIterator<StreamChunk> {
    yield { content: 'test', isFinished: true };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getModelForTier(tier: string): string {
    return 'mock-model';
  }

  getCallCount(): number {
    return this.callCount;
  }
}

describe('LLMServiceImpl', () => {
  let service: LLMServiceImpl;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: mockProvider },
      { defaultProvider: ProviderType.OPENAI }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockProvider.reset();
  });

  // ============================================================
  // Provider Management Tests
  // ============================================================

  describe('Provider Management', () => {
    it('should initialize with provider map', () => {
      const providers = new Map([[ProviderType.OPENAI, mockProvider]]);
      const svc = new LLMServiceImpl(providers);
      expect(svc.getAvailableProviders()).toContain(ProviderType.OPENAI);
    });

    it('should initialize with provider record', () => {
      const svc = new LLMServiceImpl({ [ProviderType.ANTHROPIC]: mockProvider });
      expect(svc.getAvailableProviders()).toContain(ProviderType.ANTHROPIC);
    });

    it('should get default provider', () => {
      expect(service.getDefaultProvider()).toBe(ProviderType.OPENAI);
    });

    it('should list available providers', () => {
      const providers = {
        [ProviderType.OPENAI]: mockProvider,
        [ProviderType.ANTHROPIC]: new MockLLMProvider(),
      };
      const svc = new LLMServiceImpl(providers);
      const available = svc.getAvailableProviders();
      expect(available).toHaveLength(2);
      expect(available).toContain(ProviderType.OPENAI);
      expect(available).toContain(ProviderType.ANTHROPIC);
    });

    it('should fallback to first available provider when default not found', async () => {
      const svc = new LLMServiceImpl(
        { [ProviderType.ANTHROPIC]: mockProvider },
        { defaultProvider: ProviderType.OPENAI }
      );

      // Should use Anthropic instead of failing
      const result = await svc.generate('test');
      expect(result).toBeDefined();
    });

    it('should throw ProviderUnavailableError when no providers available', async () => {
      const svc = new LLMServiceImpl({});
      await expect(svc.generate('test')).rejects.toThrow(ProviderUnavailableError);
    });
  });

  // ============================================================
  // Model Resolution Tests
  // ============================================================

  describe('Model Resolution', () => {
    it('should use model tier for model selection', async () => {
      const result = await service.generate('test', { model: ModelTier.POWERFUL });
      expect(result).toBeDefined();
    });

    it('should use explicit model name', async () => {
      const result = await service.generate('test', { model: 'custom-model' });
      expect(result).toBeDefined();
    });

    it('should use default tier when model not specified', async () => {
      const result = await service.generate('test');
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // Generation Tests
  // ============================================================

  describe('Generation', () => {
    it('should generate text response', async () => {
      const prompt = 'What is AI?';
      const response = await service.generate(prompt);

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response).toContain('Mock response');
    });

    it('should pass generation options to provider', async () => {
      const spy = vi.spyOn(mockProvider, 'complete');
      await service.generate('test', {
        temperature: 0.5,
        maxTokens: 100,
        systemPrompt: 'System instruction',
        stopSequences: ['\n'],
      });

      expect(spy).toHaveBeenCalled();
      const call = spy.mock.calls[0];
      expect(call[2]?.temperature).toBe(0.5);
      expect(call[2]?.maxTokens).toBe(100);
      expect(call[2]?.systemPrompt).toBe('System instruction');
      expect(call[2]?.stopSequences).toEqual(['\n']);
    });

    it('should generate with metadata', async () => {
      const request = {
        prompt: 'Test prompt',
        temperature: 0.7,
        maxTokens: 200,
      };

      const response = await service.generateWithMetadata(request);

      expect(response.content).toBeDefined();
      expect(response.metadata).toBeDefined();
    });
  });

  // ============================================================
  // JSON Generation Tests
  // ============================================================

  describe('JSON Generation', () => {
    it('should generate JSON response', async () => {
      const jsonProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(): Promise<LLMResponse> {
          return {
            content: JSON.stringify({ status: 'success', data: { id: 123 } }),
            metadata: {},
          };
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: '{}', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl({ [ProviderType.OPENAI]: jsonProvider });
      const result = await svc.generateJson('Return JSON');

      expect(result).toHaveProperty('status', 'success');
      expect(result).toHaveProperty('data');
    });

    it('should add JSON format instruction to system prompt', async () => {
      const jsonProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(
          prompt: string,
          model: string,
          options?: {
            temperature?: number;
            maxTokens?: number;
            systemPrompt?: string;
            stopSequences?: string[];
            responseFormat?: Record<string, unknown>;
          }
        ): Promise<LLMResponse> {
          return {
            content: JSON.stringify({ status: 'ok' }),
            metadata: {},
          };
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: '{}', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl({ [ProviderType.OPENAI]: jsonProvider });
      const spy = vi.spyOn(jsonProvider, 'complete');
      await svc.generateJson('test');

      const systemPrompt = spy.mock.calls[0][2]?.systemPrompt;
      expect(systemPrompt?.toLowerCase()).toContain('json');
    });

    it('should use lower temperature for JSON generation', async () => {
      const jsonProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(): Promise<LLMResponse> {
          return {
            content: JSON.stringify({ status: 'ok' }),
            metadata: {},
          };
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: '{}', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl({ [ProviderType.OPENAI]: jsonProvider });
      const spy = vi.spyOn(jsonProvider, 'complete');
      await svc.generateJson('test');

      const temperature = spy.mock.calls[0][2]?.temperature;
      expect(temperature).toBe(0.3);
    });

    it('should throw LLMError on JSON parse failure', async () => {
      const invalidJsonProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(): Promise<LLMResponse> {
          return { content: 'Not valid JSON', metadata: {} };
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: 'test', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl({ [ProviderType.OPENAI]: invalidJsonProvider });

      await expect(svc.generateJson('test')).rejects.toThrow(LLMError);
    });
  });

  // ============================================================
  // Streaming Tests
  // ============================================================

  describe('Streaming', () => {
    it('should stream response chunks', async () => {
      const chunks: StreamChunk[] = [];
      for await (const chunk of service.stream('test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isFinished).toBe(true);
    });

    it('should handle streaming options', async () => {
      const chunks: StreamChunk[] = [];
      for await (const chunk of service.stream('test', {
        temperature: 0.8,
        maxTokens: 100,
        systemPrompt: 'System',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Batch Generation Tests
  // ============================================================

  describe('Batch Generation', () => {
    it('should generate batch responses', async () => {
      const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];
      const results = await service.batchGenerate(prompts);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(typeof result).toBe('string');
        expect(result).toContain('Mock response');
      });
    });

    it('should respect max concurrency', async () => {
      const prompts = Array(10).fill('test');
      const results = await service.batchGenerate(prompts, { maxConcurrency: 3 });

      expect(results).toHaveLength(10);
    });

    it('should handle empty prompts array', async () => {
      const results = await service.batchGenerate([]);
      expect(results).toEqual([]);
    });
  });

  // ============================================================
  // Retry Logic Tests
  // ============================================================

  describe('Retry Logic', () => {
    it('should retry on RateLimitError', async () => {
      const rateLimitProvider = new RateLimitMockProvider();
      const svc = new LLMServiceImpl(
        { [ProviderType.OPENAI]: rateLimitProvider },
        { retry: { maxRetries: 3, baseDelay: 10 } }
      );

      const result = await svc.generate('test');
      expect(result).toBe('Success after retries');
      expect(rateLimitProvider.getCallCount()).toBe(3);
    });

    it('should use retry-after delay from RateLimitError', async () => {
      let callCount = 0;
      const retryProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(): Promise<LLMResponse> {
          callCount++;
          if (callCount < 2) {
            throw new RateLimitError('Rate limited', ProviderType.OPENAI, 50);
          }
          return { content: 'Success', metadata: {} };
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: 'test', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl(
        { [ProviderType.OPENAI]: retryProvider },
        { retry: { maxRetries: 3, baseDelay: 1000 } }
      );

      const startTime = Date.now();
      await svc.generate('test');
      const elapsed = Date.now() - startTime;

      // Should use 50ms retry-after instead of exponential backoff
      expect(elapsed).toBeLessThan(500);
    });

    it('should fail after max retries', async () => {
      const failingProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(): Promise<LLMResponse> {
          throw new RateLimitError('Always rate limited', ProviderType.OPENAI);
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: 'test', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl(
        { [ProviderType.OPENAI]: failingProvider },
        { retry: { maxRetries: 2, baseDelay: 10 } }
      );

      await expect(svc.generate('test')).rejects.toThrow(ProviderUnavailableError);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryProvider = new (class implements LLMProvider {
        readonly providerType = ProviderType.OPENAI;
        async complete(): Promise<LLMResponse> {
          throw new LLMError('Non-retryable error', ProviderType.OPENAI);
        }
        async *streamComplete(): AsyncIterableIterator<StreamChunk> {
          yield { content: 'test', isFinished: true };
        }
        async healthCheck(): Promise<boolean> {
          return true;
        }
        getModelForTier(): string {
          return 'mock';
        }
      })();

      const svc = new LLMServiceImpl(
        { [ProviderType.OPENAI]: nonRetryProvider },
        { retry: { maxRetries: 3 } }
      );

      await expect(svc.generate('test')).rejects.toThrow(LLMError);
    });
  });

  // ============================================================
  // Error Handling Tests
  // ============================================================

  describe('Error Handling', () => {
    it('should throw LLMError with provider info', () => {
      const error = new LLMError('Test error', ProviderType.OPENAI);
      expect(error.message).toBe('Test error');
      expect(error.provider).toBe(ProviderType.OPENAI);
    });

    it('should throw RateLimitError with retry-after', () => {
      const error = new RateLimitError('Rate limited', ProviderType.ANTHROPIC, 60);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.retryAfter).toBe(60);
    });

    it('should throw TokenLimitError with token info', () => {
      const error = new TokenLimitError('Token limit', ProviderType.OPENAI, 5000, 4000);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.tokenCount).toBe(5000);
      expect(error.tokenLimit).toBe(4000);
    });

    it('should throw ProviderUnavailableError with fallback info', () => {
      const error = new ProviderUnavailableError('Unavailable', ProviderType.AZURE, true);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.fallbackAvailable).toBe(true);
    });

  });

  // ============================================================
  // Health Check Tests
  // ============================================================

  describe('Health Check', () => {
    it('should check provider health', async () => {
      const healthy = await service.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should check specific provider health', async () => {
      const healthy = await service.healthCheck(ProviderType.OPENAI);
      expect(healthy).toBe(true);
    });

    it('should report unhealthy provider', async () => {
      mockProvider.setShouldFail(true);
      const healthy = await service.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  // ============================================================
  // Configuration Tests
  // ============================================================

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const svc = new LLMServiceImpl({ [ProviderType.OPENAI]: mockProvider });
      expect(svc.getDefaultProvider()).toBe(ProviderType.OPENAI);
    });

    it('should accept custom retry configuration', async () => {
      const retryProvider = new RateLimitMockProvider();
      const svc = new LLMServiceImpl(
        { [ProviderType.OPENAI]: retryProvider },
        { retry: { maxRetries: 5, baseDelay: 100 } }
      );

      await svc.generate('test');
      expect(retryProvider.getCallCount()).toBe(3);
    });

    it('should accept custom default provider', () => {
      const svc = new LLMServiceImpl(
        {
          [ProviderType.OPENAI]: mockProvider,
          [ProviderType.ANTHROPIC]: new MockLLMProvider(),
        },
        { defaultProvider: ProviderType.ANTHROPIC }
      );

      expect(svc.getDefaultProvider()).toBe(ProviderType.ANTHROPIC);
    });
  });

  // ============================================================
  // Edge Cases Tests
  // ============================================================

  describe('Edge Cases', () => {
    it('should handle empty prompt', async () => {
      const result = await service.generate('');
      expect(result).toBeDefined();
    });

    it('should handle very long prompt', async () => {
      const longPrompt = 'A'.repeat(10000);
      const result = await service.generate(longPrompt);
      expect(result).toBeDefined();
    });

    it('should handle special characters in prompt', async () => {
      const specialPrompt = 'Test with special chars: \n\t\r"\'`~!@#$%^&*()';
      const result = await service.generate(specialPrompt);
      expect(result).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(10)
        .fill(null)
        .map((_, i) => service.generate(`Prompt ${i}`));

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((result) => expect(result).toBeDefined());
    });
  });
});
