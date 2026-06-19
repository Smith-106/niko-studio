import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMServiceImpl } from '../../knowledge/llm-service';
import {
  createLLMRequest,
  createLLMResponse,
  LLMError,
  ModelTier,
  ProviderType,
  ProviderUnavailableError,
  RateLimitError,
  type LLMProviderEntry,
  type LLMRequest,
  type LLMResponse,
  type StreamChunk,
} from '../../knowledge/models';

class FakeProvider implements LLMProviderEntry {
  readonly providerType: string;
  readonly generateCalls: LLMRequest[] = [];
  readonly streamCalls: LLMRequest[] = [];
  private readonly _models: Record<string, string>;
  private _generateImpl: (request: LLMRequest) => Promise<LLMResponse>;
  private _streamChunks: StreamChunk[];

  constructor(providerType: string, models?: Partial<Record<ModelTier, string>>) {
    this.providerType = providerType;
    this._models = {
      [ModelTier.FAST]: models?.[ModelTier.FAST] ?? `${providerType}-fast`,
      [ModelTier.DEFAULT]: models?.[ModelTier.DEFAULT] ?? `${providerType}-default`,
      [ModelTier.POWERFUL]: models?.[ModelTier.POWERFUL] ?? `${providerType}-powerful`,
    };
    this._generateImpl = async (request) =>
      createLLMResponse({
        content: `${this.providerType}:${request.modelOverride}:${request.prompt}`,
        modelUsed: request.modelOverride ?? this._models[ModelTier.DEFAULT],
        provider: this.providerType as ProviderType,
      });
    this._streamChunks = [
      { content: 'part-1', isFinal: false, usage: null },
      { content: 'part-2', isFinal: true, usage: null },
    ];
  }

  getModelForTier(tier: ModelTier): string {
    return this._models[tier];
  }

  setGenerateImpl(fn: (request: LLMRequest) => Promise<LLMResponse>): void {
    this._generateImpl = fn;
  }

  setStreamChunks(chunks: StreamChunk[]): void {
    this._streamChunks = chunks;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.generateCalls.push({
      ...request,
      stopSequences: [...request.stopSequences],
    });
    return this._generateImpl(request);
  }

  async *streamGenerate(request: LLMRequest): AsyncGenerator<StreamChunk> {
    this.streamCalls.push({
      ...request,
      stopSequences: [...request.stopSequences],
    });
    for (const chunk of this._streamChunks) {
      yield chunk;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('knowledge/llm-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the default provider and default-tier model for generate()', async () => {
    const provider = new FakeProvider(ProviderType.OPENAI);
    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      defaultProvider: ProviderType.OPENAI,
    });

    const result = await service.generate('draft scene');

    expect(result).toBe('openai:openai-default:draft scene');
    expect(provider.generateCalls).toHaveLength(1);
    expect(provider.generateCalls[0].modelOverride).toBe('openai-default');
    expect(provider.generateCalls[0].temperature).toBe(0.7);
    expect(provider.generateCalls[0].stopSequences).toEqual([]);
  });

  it('supports explicit provider, tier, and metadata requests', async () => {
    const openai = new FakeProvider(ProviderType.OPENAI);
    const anthropic = new FakeProvider(ProviderType.ANTHROPIC, {
      [ModelTier.POWERFUL]: 'claude-opus-test',
    });
    const service = new LLMServiceImpl({
      providers: new Map([
        [ProviderType.OPENAI, openai],
        [ProviderType.ANTHROPIC, anthropic],
      ]),
      defaultProvider: ProviderType.OPENAI,
    });

    const generateResult = await service.generate('outline', {
      provider: ProviderType.ANTHROPIC,
      model: ModelTier.POWERFUL,
      temperature: 0.2,
      maxTokens: 512,
      systemPrompt: 'Return bullets',
      stopSequences: ['STOP'],
    });
    const metadataResult = await service.generateWithMetadata(createLLMRequest({
      prompt: 'metadata',
      modelTier: ModelTier.FAST,
      stopSequences: [],
    }));

    expect(generateResult).toBe('anthropic:claude-opus-test:outline');
    expect(anthropic.generateCalls[0].temperature).toBe(0.2);
    expect(anthropic.generateCalls[0].maxTokens).toBe(512);
    expect(anthropic.generateCalls[0].systemPrompt).toBe('Return bullets');
    expect(anthropic.generateCalls[0].stopSequences).toEqual(['STOP']);
    expect(metadataResult.modelUsed).toBe('openai-fast');
    expect(openai.generateCalls[0].stopSequences).toEqual([]);
  });

  it('falls back to the first available provider and throws when none exist', async () => {
    const fallback = new FakeProvider(ProviderType.ANTHROPIC);
    const fallbackService = new LLMServiceImpl({
      providers: new Map([[ProviderType.ANTHROPIC, fallback]]),
      defaultProvider: ProviderType.OPENAI,
    });
    const emptyService = new LLMServiceImpl({
      providers: new Map(),
    });

    await expect(fallbackService.generate('fallback')).resolves.toBe(
      'anthropic:anthropic-default:fallback',
    );
    await expect(emptyService.generate('missing')).rejects.toThrow(ProviderUnavailableError);
  });

  it('retries rate-limit failures and respects retryAfter seconds', async () => {
    const provider = new FakeProvider(ProviderType.OPENAI);
    let attempts = 0;
    provider.setGenerateImpl(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new RateLimitError('slow down', ProviderType.OPENAI, 2);
      }
      return createLLMResponse({
        content: 'success-after-retry',
        modelUsed: 'openai-default',
      });
    });

    const timeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((fn: (...args: any[]) => void) => {
        fn();
        return 0 as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      maxRetries: 3,
      retryBaseDelay: 0.1,
    });

    await expect(service.generate('retry-me')).resolves.toBe('success-after-retry');
    expect(provider.generateCalls).toHaveLength(3);
    expect(timeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 2000);
    expect(timeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 2000);
  });

  it('uses exponential backoff with jitter when retryAfter is unavailable', async () => {
    const provider = new FakeProvider(ProviderType.OPENAI);
    let attempts = 0;
    provider.setGenerateImpl(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new ProviderUnavailableError('temporary outage', ProviderType.OPENAI);
      }
      return createLLMResponse({
        content: 'recovered-with-jitter',
        modelUsed: 'openai-default',
      });
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const timeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((fn: (...args: any[]) => void) => {
        fn();
        return 0 as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      maxRetries: 1,
      retryBaseDelay: 0.2,
    });

    await expect(service.generate('retry-with-jitter')).resolves.toBe('recovered-with-jitter');
    expect(provider.generateCalls).toHaveLength(2);
    expect(randomSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 220.00000000000003);
  });

  it('does not retry non-retryable errors', async () => {
    const provider = new FakeProvider(ProviderType.OPENAI);
    provider.setGenerateImpl(async () => {
      throw new LLMError('invalid schema', ProviderType.OPENAI);
    });
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      maxRetries: 5,
      retryBaseDelay: 0.1,
    });

    await expect(service.generate('boom')).rejects.toThrow(LLMError);
    expect(provider.generateCalls).toHaveLength(1);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('adds JSON instructions only when needed and surfaces parse failures', async () => {
    const provider = new FakeProvider(ProviderType.OPENAI);
    provider.setGenerateImpl(async (request) => {
      if (request.prompt === 'bad-json') {
        return createLLMResponse({
          content: 'not valid json',
          modelUsed: request.modelOverride ?? 'openai-default',
        });
      }
      return createLLMResponse({
        content: JSON.stringify({ ok: true, prompt: request.prompt }),
        modelUsed: request.modelOverride ?? 'openai-default',
      });
    });
    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
    });

    const plain = await service.generateJson('json-please');
    const alreadyJson = await service.generateJson('already-json', {
      systemPrompt: 'Return JSON only.',
    });

    expect(plain).toEqual({ ok: true, prompt: 'json-please' });
    expect(alreadyJson).toEqual({ ok: true, prompt: 'already-json' });
    expect(provider.generateCalls[0].systemPrompt).toContain('Respond with valid JSON only.');
    expect(provider.generateCalls[0].responseFormat).toEqual({ type: 'json' });
    expect(provider.generateCalls[1].systemPrompt).toBe('Return JSON only.');
    await expect(service.generateJson('bad-json')).rejects.toThrow(LLMError);
  });

  it('streams from the selected provider and batches prompts through the queue path', async () => {
    const provider = new FakeProvider(ProviderType.OPENAI);
    provider.setStreamChunks([
      { content: 'Hello', isFinal: false, usage: null },
      { content: ' world', isFinal: true, usage: null },
    ]);
    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
    });

    const chunks: StreamChunk[] = [];
    for await (const chunk of service.stream('stream-me', {
      model: 'custom-model',
      temperature: 0.5,
      maxTokens: 64,
      systemPrompt: 'Stay concise',
      provider: ProviderType.OPENAI,
    })) {
      chunks.push(chunk);
    }

    const batchResults = await service.batchGenerate(['a', 'b', 'c'], {
      maxConcurrency: 1,
      model: 'batch-model',
      provider: ProviderType.OPENAI,
    });

    expect(chunks.map((chunk) => chunk.content)).toEqual(['Hello', ' world']);
    expect(provider.streamCalls[0].modelOverride).toBe('custom-model');
    expect(provider.streamCalls[0].systemPrompt).toBe('Stay concise');
    expect(batchResults).toEqual([
      'openai:batch-model:a',
      'openai:batch-model:b',
      'openai:batch-model:c',
    ]);
  });
});
