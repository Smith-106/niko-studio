import { afterEach, describe, expect, it, vi } from 'vitest';

import { LLMServiceImpl } from '../../knowledge/llm-service';
import {
  createLLMResponse,
  ProviderType,
  ProviderUnavailableError,
  type LLMProviderEntry,
  type LLMRequest,
  type LLMResponse,
  type StreamChunk,
} from '../../knowledge/models';

class ProbeProvider implements LLMProviderEntry {
  readonly providerType: string;
  readonly generateCalls: LLMRequest[] = [];
  private _generateImpl: (request: LLMRequest) => Promise<LLMResponse>;

  constructor(providerType: string) {
    this.providerType = providerType;
    this._generateImpl = async (request) =>
      createLLMResponse({
        content: `${request.prompt}:${request.modelOverride}`,
        modelUsed: request.modelOverride ?? `${providerType}-default`,
        provider: providerType as ProviderType,
      });
  }

  getModelForTier(): string {
    return `${this.providerType}-default`;
  }

  setGenerateImpl(fn: (request: LLMRequest) => Promise<LLMResponse>): void {
    this._generateImpl = fn;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.generateCalls.push({
      ...request,
      stopSequences: [...request.stopSequences],
    });
    return this._generateImpl(request);
  }

  async *streamGenerate(): AsyncGenerator<StreamChunk> {
    yield { content: 'unused', isFinal: true, usage: null };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('knowledge/llm-service additional coverage', () => {
  it('rethrows the last retryable error after exhausting max retries', async () => {
    const provider = new ProbeProvider(ProviderType.OPENAI);
    provider.setGenerateImpl(async () => {
      throw new ProviderUnavailableError('provider still unavailable', ProviderType.OPENAI);
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const timeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((fn: (...args: any[]) => void) => {
        fn();
        return 0 as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);

    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
      maxRetries: 1,
      retryBaseDelay: 0.1,
    });

    await expect(service.generate('fail-after-retry')).rejects.toThrow(ProviderUnavailableError);
    expect(provider.generateCalls).toHaveLength(2);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps the JSON system prompt unset when the computed prompt stays falsy', async () => {
    const provider = new ProbeProvider(ProviderType.OPENAI);
    provider.setGenerateImpl(async (request) =>
      createLLMResponse({
        content: '{"ok":true}',
        modelUsed: request.modelOverride ?? 'openai-default',
        provider: ProviderType.OPENAI,
      }),
    );

    const originalIncludes = String.prototype.includes;
    vi.spyOn(String.prototype, 'includes').mockImplementation(function (
      this: string,
      searchString: string,
      position?: number,
    ): boolean {
      if (this.valueOf() === '' && searchString === 'json') {
        return true;
      }
      return originalIncludes.call(this, searchString, position);
    });

    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
    });

    const result = await service.generateJson('json-with-empty-system', {
      systemPrompt: '',
    });

    expect(result).toEqual({ ok: true });
    expect(provider.generateCalls[0].systemPrompt).toBeNull();
    expect(provider.generateCalls[0].responseFormat).toEqual({ type: 'json' });
  });

  it('uses the default batch concurrency when options are omitted', async () => {
    const provider = new ProbeProvider(ProviderType.OPENAI);
    const service = new LLMServiceImpl({
      providers: new Map([[ProviderType.OPENAI, provider]]),
    });

    const results = await service.batchGenerate(['alpha', 'beta']);

    expect(results).toEqual([
      'alpha:openai-default',
      'beta:openai-default',
    ]);
    expect(provider.generateCalls).toHaveLength(2);
  });
});
