import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writingCraftLLMEndpoint } from '../../mcp/endpoints/writing-craft-llm.js';
import type { HttpResponse } from '../../mcp/http-types.js';

function mockRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return {
    method: 'POST',
    url: '/writing-craft/llm',
    headers,
    body,
    query: {},
    params: {},
  } as any;
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

function mockFetchResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const SAMPLE_TEXT = 'The wind howled through the empty corridor.';

describe('writingCraftLLMEndpoint header-based provider config', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves api_key from x-llm-api-key header (lowercase)', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({ score: 7, evidence: ['good'], suggestions: [], analysis: 'ok' }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, base_url: 'https://api.test.com', model: 'gpt-4o' },
        { 'x-llm-api-key': 'header-key-lower' },
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).success).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer header-key-lower');
  });

  it('resolves api_key from X-LLM-API-Key header (canonical case)', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({ score: 8, evidence: [], suggestions: [], analysis: 'test' }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, base_url: 'https://api.test.com', model: 'gpt-4o' },
        { 'X-LLM-API-Key': 'header-key-upper' },
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer header-key-upper');
  });

  it('resolves base_url from x-llm-base-url header (lowercase)', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({ score: 5, evidence: [], suggestions: [], analysis: 'low' }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, api_key: 'sk-test', model: 'gpt-4o' },
        { 'x-llm-base-url': 'https://header-base.test.com' },
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain('https://header-base.test.com');
  });

  it('resolves base_url from X-LLM-Base-Url header (canonical case)', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({ score: 6, evidence: [], suggestions: [], analysis: 'mid' }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, api_key: 'sk-test', model: 'gpt-4o' },
        { 'X-LLM-Base-Url': 'https://header-base-canonical.test.com' },
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain('https://header-base-canonical.test.com');
  });

  it('prefers header api_key over body api_key when both are present', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({ score: 9, evidence: [], suggestions: [], analysis: 'high' }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, api_key: 'body-key', base_url: 'https://api.test.com', model: 'gpt-4o' },
        { 'x-llm-api-key': 'header-key-priority' },
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer header-key-priority');
  });

  it('returns 400 when api_key from headers is whitespace-only', async () => {
    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, base_url: 'https://api.test.com', model: 'gpt-4o' },
        { 'x-llm-api-key': '   ' },
      ),
    );

    expect(response.statusCode).toBe(400);
    expect(getBody(response).error).toContain('LLM config');
  });

  it('returns 400 when base_url from headers is whitespace-only and body has none', async () => {
    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, api_key: 'sk-test', model: 'gpt-4o' },
        { 'x-llm-base-url': '   ' },
      ),
    );

    expect(response.statusCode).toBe(400);
    expect(getBody(response).error).toContain('LLM config');
  });

  it('trims whitespace from header values before using them', async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({ score: 7, evidence: [], suggestions: [], analysis: 'trimmed' }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest(
        { text: SAMPLE_TEXT, model: 'gpt-4o' },
        { 'x-llm-api-key': '  trimmed-key  ', 'x-llm-base-url': '  https://trimmed.test.com  ' },
      ),
    );

    expect(response.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer trimmed-key');
    expect(fetchMock.mock.calls[0][0]).toContain('https://trimmed.test.com');
  });
});
