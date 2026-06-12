import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ITokenService } from '../../container/types';
import { Hook, HookRegistry, HookType, hookOk } from '../../hooks/writing-hooks.js';
import type { LLMProvider, LLMResponse, StreamChunk } from '../../protocols/llm';
import { CircuitState } from '../../services/circuit-breaker.js';
import {
  BudgetExceededError,
  CircuitOpenError,
  LLMServiceImpl,
  ModelTier,
  ProviderType,
  ProviderUnavailableError,
} from '../../services/llm-service';

type MockProvider = LLMProvider & {
  complete: ReturnType<typeof vi.fn>;
  streamComplete: ReturnType<typeof vi.fn>;
  healthCheck: ReturnType<typeof vi.fn>;
  getModelForTier: ReturnType<typeof vi.fn>;
};

type MockTokenService = ITokenService & {
  countTokens: ReturnType<typeof vi.fn>;
  isWithinBudget: ReturnType<typeof vi.fn>;
  updateUsage: ReturnType<typeof vi.fn>;
  getUsage: ReturnType<typeof vi.fn>;
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
  healthCheckImpl?: () => Promise<boolean>;
  tierModel?: string;
} = {}): MockProvider {
  const providerType = options.providerType ?? ProviderType.OPENAI;
  const complete = vi.fn(
    options.completeImpl ??
      (async (prompt: string, model: string) => ({
        content: `${providerType}:${model}:${prompt}`,
        metadata: { providerType, model },
      })),
  );
  const streamComplete = vi.fn(
    options.streamImpl ??
      ((prompt: string, model: string) =>
        (async function* () {
          yield { content: `${providerType}:${model}:${prompt}`, isFinished: false };
          yield { content: '', isFinished: true };
        })()),
  );
  const healthCheck = vi.fn(options.healthCheckImpl ?? (async () => true));
  const getModelForTier = vi.fn((tier: string) => options.tierModel ?? `${providerType}-${tier}`);

  return {
    providerType,
    complete,
    streamComplete,
    healthCheck,
    getModelForTier,
  };
}

function createTokenService(overrides: Partial<MockTokenService> = {}): MockTokenService {
  return {
    countTokens: vi.fn().mockReturnValue(0),
    isWithinBudget: vi.fn().mockReturnValue(true),
    updateUsage: vi.fn(),
    getUsage: vi.fn().mockReturnValue({ used: 0, budget: 100, remaining: 100 }),
    ...overrides,
  } as unknown as MockTokenService;
}

async function collectStream(stream: AsyncIterableIterator<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('services/llm-service additional coverage', () => {
  it('constructs budget and circuit-open errors with expected metadata', () => {
    const budgetError = new BudgetExceededError('limit hit', 40, 32);
    expect(budgetError.message).toBe('limit hit');
    expect(budgetError.used).toBe(40);
    expect(budgetError.budget).toBe(32);

    const circuitError = new CircuitOpenError('openai', CircuitState.OPEN);
    expect(circuitError.providerName).toBe('openai');
    expect(circuitError.circuitState).toBe(CircuitState.OPEN);
    expect(circuitError.provider).toBe(ProviderType.OPENAI);
  });

  it('falls back to the first available provider for health checks and throws when no provider exists', async () => {
    const anthropic = createProvider({ providerType: ProviderType.ANTHROPIC });
    const fallbackService = new LLMServiceImpl(
      new Map([[ProviderType.ANTHROPIC, anthropic]]),
      { defaultProvider: ProviderType.OPENAI },
    );

    await expect(fallbackService.healthCheck(ProviderType.OPENAI)).resolves.toBe(true);
    expect(anthropic.healthCheck).toHaveBeenCalledTimes(1);

    const emptyService = new LLMServiceImpl({});
    await expect(emptyService.healthCheck()).rejects.toThrow(ProviderUnavailableError);
  });

  it('tracks token usage, reports budget status, and updates the token service', async () => {
    const provider = createProvider({
      completeImpl: async () => ({
        content: 'tracked',
        metadata: {},
        usage: { promptTokens: 2, completionTokens: 3 },
      }),
    });
    const tokenService = createTokenService();
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { tokenBudget: 100, tokenService },
    );

    expect(service.getBudgetStatus()).toEqual({ used: 0, budget: 100, remaining: 100 });

    const response = await service.generateWithMetadata({
      prompt: 'track me',
      maxTokens: 5,
    });

    expect(response.content).toBe('tracked');
    expect(service.getBudgetStatus()).toEqual({ used: 5, budget: 100, remaining: 95 });
    expect(tokenService.isWithinBudget).toHaveBeenCalledWith('llm-default', 5);
    expect(tokenService.updateUsage).toHaveBeenCalledWith('llm-default', 5);
  });

  it('rejects requests that exceed the internal token budget', async () => {
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: createProvider() },
      { tokenBudget: 4 },
    );

    await expect(service.generate('budget', { maxTokens: 5 })).rejects.toMatchObject({
      name: 'BudgetExceededError',
      used: 0,
      budget: 4,
    });
  });

  it('rejects requests that exceed the injected token-service budget', async () => {
    const tokenService = createTokenService({
      isWithinBudget: vi.fn().mockReturnValue(false),
      getUsage: vi.fn().mockReturnValue({ used: 90, budget: 100, remaining: 10 }),
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: createProvider() },
      { tokenService },
    );

    await expect(service.generate('blocked by session budget', { maxTokens: 25 })).rejects.toMatchObject({
      name: 'BudgetExceededError',
      used: 90,
      budget: 100,
    });
    expect(tokenService.getUsage).toHaveBeenCalledWith('llm-default');
    expect(tokenService.updateUsage).not.toHaveBeenCalled();
  });

  it('runs before and after hooks for generateWithMetadata', async () => {
    const events: Array<{ type: HookType; content: string; metadata: Record<string, unknown> }> = [];
    const hooks = new HookRegistry();
    hooks.addHook(
      new Hook({
        name: 'before-llm',
        hookType: HookType.BEFORE_LLM_CALL,
        func: (ctx) => {
          events.push({ type: HookType.BEFORE_LLM_CALL, content: ctx.content, metadata: ctx.metadata });
          return hookOk();
        },
      }),
    );
    hooks.addHook(
      new Hook({
        name: 'after-llm',
        hookType: HookType.AFTER_LLM_CALL,
        func: (ctx) => {
          events.push({ type: HookType.AFTER_LLM_CALL, content: ctx.content, metadata: ctx.metadata });
          return hookOk();
        },
      }),
    );

    const provider = createProvider({
      completeImpl: async () => ({
        content: 'hooked response',
        metadata: {},
        usage: { totalTokens: 11 },
      }),
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { hooks },
    );

    await service.generateWithMetadata({ prompt: 'hook prompt', maxTokens: 8 });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: HookType.BEFORE_LLM_CALL,
      content: 'hook prompt',
      metadata: { operation: 'generate' },
    });
    expect(events[1]).toMatchObject({
      type: HookType.AFTER_LLM_CALL,
      content: 'hooked response',
      metadata: { tokens: 11 },
    });
  });

  it('covers the non-string model-like branch in the resolver without changing public string enum behavior', () => {
    const provider = createProvider({
      tierModel: 'power-model',
    });
    const service = new LLMServiceImpl({ [ProviderType.OPENAI]: provider });
    const serviceAny = service as unknown as {
      resolveModel(model: unknown, provider: MockProvider): string;
    };

    expect(serviceAny.resolveModel(42, provider)).toBe('power-model');
    expect(provider.getModelForTier).toHaveBeenCalledWith(42);
  });

  it('retries retryable stream errors, respects retry-after, and runs stream hooks on success', async () => {
    let attempts = 0;
    const events: Array<{ type: HookType; metadata: Record<string, unknown> }> = [];
    const hooks = new HookRegistry();
    hooks.addHook(
      new Hook({
        name: 'before-stream',
        hookType: HookType.BEFORE_LLM_CALL,
        func: (ctx) => {
          events.push({ type: HookType.BEFORE_LLM_CALL, metadata: ctx.metadata });
          return hookOk();
        },
      }),
    );
    hooks.addHook(
      new Hook({
        name: 'after-stream',
        hookType: HookType.AFTER_LLM_CALL,
        func: (ctx) => {
          events.push({ type: HookType.AFTER_LLM_CALL, metadata: ctx.metadata });
          return hookOk();
        },
      }),
    );

    const provider = createProvider({
      streamImpl: () =>
        (async function* () {
          attempts += 1;
          if (attempts === 1) {
            const error = new Error('rate limited') as Error & {
              status: number;
              headers: Record<string, string>;
            };
            error.status = 429;
            error.headers = { 'retry-after': '0' };
            throw error;
          }
          yield { content: 'retry-ok', isFinished: false };
          yield { content: '', isFinished: true };
        })(),
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: provider },
      { hooks, retry: { baseDelay: 1, maxDelay: 5 } },
    );

    const chunks = await collectStream(service.stream('stream prompt'));

    expect(attempts).toBe(2);
    expect(chunks).toEqual([
      { content: 'retry-ok', isFinished: false },
      { content: '', isFinished: true },
    ]);
    expect(events.map((event) => event.type)).toEqual([
      HookType.BEFORE_LLM_CALL,
      HookType.AFTER_LLM_CALL,
    ]);
    expect(events[0].metadata.operation).toBe('stream');
    expect(events[1].metadata.status).toBe('completed');
  });

  it('falls back to the next provider when streaming fails with a non-retryable error', async () => {
    const failing = createProvider({
      providerType: ProviderType.OPENAI,
      streamImpl: () =>
        (async function* () {
          throw new Error('fatal stream failure');
        })(),
    });
    const backup = createProvider({
      providerType: ProviderType.ANTHROPIC,
      streamImpl: () =>
        (async function* () {
          yield { content: 'fallback', isFinished: false };
          yield { content: '', isFinished: true };
        })(),
    });
    const service = new LLMServiceImpl(
      new Map([
        [ProviderType.OPENAI, failing],
        [ProviderType.ANTHROPIC, backup],
      ]),
      { defaultProvider: ProviderType.OPENAI, retry: { baseDelay: 1, maxDelay: 5 } },
    );

    const chunks = await collectStream(service.stream('fallback me'));

    expect(chunks.map((chunk) => chunk.content)).toEqual(['fallback', '']);
    expect(failing.streamComplete).toHaveBeenCalledTimes(1);
    expect(backup.streamComplete).toHaveBeenCalledTimes(1);
  });

  it('throws ProviderUnavailableError when all stream providers fail without open circuits', async () => {
    const failing = createProvider({
      providerType: ProviderType.OPENAI,
      streamImpl: () =>
        (async function* () {
          throw new Error('fatal stream failure');
        })(),
    });
    const service = new LLMServiceImpl(
      { [ProviderType.OPENAI]: failing },
      { defaultProvider: ProviderType.OPENAI, retry: { baseDelay: 1, maxDelay: 5 } },
    );

    await expect(collectStream(service.stream('no fallback'))).rejects.toThrow(
      'All providers failed for stream: fatal stream failure',
    );
  });

  it('throws circuit-open errors when all providers are blocked for generate and stream', async () => {
    const openai = createProvider({ providerType: ProviderType.OPENAI });
    const anthropic = createProvider({ providerType: ProviderType.ANTHROPIC });
    const service = new LLMServiceImpl(
      new Map([
        [ProviderType.OPENAI, openai],
        [ProviderType.ANTHROPIC, anthropic],
      ]),
      { defaultProvider: ProviderType.OPENAI },
    );
    const registry = (
      service as unknown as {
        _circuitBreakerRegistry: {
          recordFailure(providerName: string): void;
        };
      }
    )._circuitBreakerRegistry;

    for (let i = 0; i < 5; i += 1) {
      registry.recordFailure(ProviderType.OPENAI);
      registry.recordFailure(ProviderType.ANTHROPIC);
    }

    await expect(service.generate('blocked')).rejects.toThrow(CircuitOpenError);
    await expect(collectStream(service.stream('blocked stream'))).rejects.toThrow(CircuitOpenError);
    expect(openai.complete).not.toHaveBeenCalled();
    expect(anthropic.complete).not.toHaveBeenCalled();
  });

  it('registers providers dynamically and exposes them through health checks and provider listing', async () => {
    const openai = createProvider({ providerType: ProviderType.OPENAI });
    const anthropic = createProvider({ providerType: ProviderType.ANTHROPIC });
    const service = new LLMServiceImpl({ [ProviderType.OPENAI]: openai });

    service.registerProvider(ProviderType.ANTHROPIC, anthropic);

    expect(service.getAvailableProviders()).toEqual(
      expect.arrayContaining([ProviderType.OPENAI, ProviderType.ANTHROPIC]),
    );
    await expect(service.healthCheck(ProviderType.ANTHROPIC)).resolves.toBe(true);
    expect(anthropic.healthCheck).toHaveBeenCalledTimes(1);
  });
});
