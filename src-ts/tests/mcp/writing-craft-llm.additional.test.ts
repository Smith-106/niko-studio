import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writingCraftLLMEndpoint } from '../../mcp/endpoints/writing-craft-llm.js';
import type { HttpResponse } from '../../mcp/http-types.js';

function mockRequest(body: Record<string, unknown>) {
  return {
    method: 'POST',
    url: '/writing-craft/llm',
    headers: {},
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
      choices: [
        {
          message: { content },
        },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

const SAMPLE_TEXT = 'A narrow corridor hums with broken fluorescent light.';

describe('writingCraftLLMEndpoint additional coverage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 400 when text is blank after trimming', async () => {
    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: '   ',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(getBody(response)).toMatchObject({
      success: false,
      error: 'text is required',
    });
  });

  it('returns 400 when text is missing even if provider config exists', async () => {
    const response = await writingCraftLLMEndpoint(
      mockRequest({
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(getBody(response)).toMatchObject({
      success: false,
      error: 'text is required',
    });
  });

  it('returns an empty successful analysis when dimensions is explicitly empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimensions: [],
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response)).toMatchObject({
      success: true,
      data: {
        overallScore: 0,
        dimensions: [],
        source: 'llm',
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('analyzes the default dimension set when neither dimension nor dimensions is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse(
        JSON.stringify({
          score: 6,
          evidence: ['ok'],
          suggestions: ['improve'],
          analysis: 'default-dimensions',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('falls back to an empty raw response when the provider omits choices', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimension: 'structure',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions[0]).toMatchObject({
      dimension: 'structure',
      score: 0,
      evidence: [],
      suggestions: [],
      details: {
        analysis: '',
        source: 'llm',
      },
    });
  });

  it('falls back to raw analysis when the provider returns malformed JSON content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse('{"score": 8, "analysis": "broken"'),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimension: 'structure',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions[0]).toMatchObject({
      dimension: 'structure',
      score: 0,
      evidence: [],
      suggestions: [],
      details: {
        analysis: '{"score": 8, "analysis": "broken"',
        source: 'llm',
      },
    });
  });

  it('falls back to raw analysis when JSON parsing throws after a brace match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse('{"score": }'),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimension: 'dialogue',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions[0]).toMatchObject({
      dimension: 'dialogue',
      score: 0,
      evidence: [],
      suggestions: [],
      details: {
        analysis: '{"score": }',
        source: 'llm',
      },
    });
  });

  it('clamps parsed scores and defaults non-array evidence payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse(
          JSON.stringify({
            score: 42,
            evidence: 'not-an-array',
            suggestions: 'not-an-array',
            analysis: 'clamped',
          }),
        ),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimension: 'emotion',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions[0]).toMatchObject({
      dimension: 'emotion',
      score: 10,
      evidence: [],
      suggestions: [],
      details: {
        analysis: 'clamped',
        source: 'llm',
      },
    });
  });

  it('defaults score and analysis when parsed JSON uses unsupported types', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse(
          JSON.stringify({
            score: '9',
            evidence: ['signal'],
            suggestions: ['improve'],
            analysis: { summary: 'not-a-string' },
          }),
        ),
      ),
    );

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimension: 'suspense',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions[0]).toMatchObject({
      dimension: 'suspense',
      score: 0,
      evidence: ['signal'],
      suggestions: ['improve'],
      details: {
        analysis: '',
        source: 'llm',
      },
    });
  });

  it('uses the unknown-error fallback when the provider throws a non-Error value', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));

    const response = await writingCraftLLMEndpoint(
      mockRequest({
        text: SAMPLE_TEXT,
        dimension: 'character',
        api_key: 'sk-test',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).data.dimensions[0]).toMatchObject({
      dimension: 'character',
      score: 0,
      details: { error: true, source: 'llm' },
    });
    expect(getBody(response).data.dimensions[0].suggestions[0]).toContain('Unknown error');
  });
});
