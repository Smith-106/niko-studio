import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenAILLMProvider } from '../../knowledge/providers/openai-llm';
import type { StreamChunk } from '../../knowledge/models';

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

describe('knowledge/providers/openai-llm branch gaps', () => {
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

  it('omits authorization when no api key exists in params or env', async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAILLMProvider({
      apiKey: undefined,
      baseUrl: 'https://openai.example/v1/',
    });

    await provider.complete('Prompt', 'gpt-4o-mini');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('falls back to an empty carry buffer when split returns no trailing segment', async () => {
    const originalSplit = String.prototype.split;
    const splitSpy = vi.spyOn(String.prototype, 'split').mockImplementation(function (
      this: string,
      separator: string | RegExp,
      limit?: number,
    ) {
      if (String(this) === 'trigger-no-trailing-segment' && separator === '\n') {
        return [];
      }
      return (originalSplit as any).call(String(this), separator, limit);
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createStreamResponse([
      'trigger-no-trailing-segment',
    ])));

    const provider = new OpenAILLMProvider({ apiKey: 'explicit-key' });

    await expect(collectStream(provider.streamComplete('Prompt', 'gpt-4o-mini'))).resolves.toEqual([]);
    expect(splitSpy).toHaveBeenCalled();
  });
});
