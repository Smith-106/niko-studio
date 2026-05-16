import { describe, expect, it } from 'vitest';
import { writingCraftAnalyzeEndpoint } from '../../mcp/endpoints/writing-craft.js';
import { writingCraftLLMEndpoint } from '../../mcp/endpoints/writing-craft-llm.js';
import type { HttpResponse } from '../../mcp/http-types.js';

function mockRequest(body: Record<string, unknown>) {
  return {
    method: 'POST',
    url: '/writing-craft/analyze',
    headers: {},
    body,
    query: {},
    params: {},
  } as any;
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

function mockFetchResponse(content: string, ok = true) {
  return new Response(JSON.stringify({
    choices: [
      {
        message: { content },
      },
    ],
  }), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_TEXT = `林岚站在破旧的警局走廊尽头，灯光忽明忽暗。她紧握着那封匿名信，指节发白。
"你确定要查下去？"老陈的声音从背后传来，带着一丝不易察觉的紧张。
她没有回头，只是将信纸折好，塞进了口袋。"真相不会因为有人害怕就消失。"
走廊尽头的门被推开，一阵冷风吹过，卷起地上的落叶。信封上的字迹在昏暗的灯光下若隐若现——那是只有死者才知道的笔迹。
这一刻，林岚知道，她已经被卷入了一个比案件本身更深的谜团。`;

describe('writingCraftAnalyzeEndpoint', () => {
  it('returns 400 when text is empty', async () => {
    const response = await writingCraftAnalyzeEndpoint(mockRequest({ text: '' }));
    expect(response.statusCode).toBe(400);
    expect(getBody(response).success).toBe(false);
  });

  it('returns 400 when text is missing', async () => {
    const response = await writingCraftAnalyzeEndpoint(mockRequest({}));
    expect(response.statusCode).toBe(400);
  });

  it('analyzes all 6 dimensions by default', async () => {
    const response = await writingCraftAnalyzeEndpoint(mockRequest({ text: SAMPLE_TEXT }));
    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.success).toBe(true);
    expect(body.data.dimensions).toHaveLength(6);
    expect(body.data.overallScore).toBeGreaterThanOrEqual(0);
    expect(body.data.textLength).toBe(SAMPLE_TEXT.length);

    const dims = body.data.dimensions.map((d: any) => d.dimension);
    expect(dims).toContain('structure');
    expect(dims).toContain('character');
    expect(dims).toContain('suspense');
    expect(dims).toContain('emotion');
    expect(dims).toContain('dialogue');
    expect(dims).toContain('webnovel');
  });

  it('analyzes only requested dimensions', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['emotion', 'dialogue'] }),
    );
    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.data.dimensions).toHaveLength(2);
    expect(body.data.dimensions[0].dimension).toBe('emotion');
    expect(body.data.dimensions[1].dimension).toBe('dialogue');
  });

  it('each dimension has required fields', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['suspense'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(dim).toHaveProperty('dimension', 'suspense');
    expect(dim).toHaveProperty('label');
    expect(dim).toHaveProperty('score');
    expect(dim).toHaveProperty('maxScore', 10);
    expect(dim).toHaveProperty('evidence');
    expect(dim).toHaveProperty('suggestions');
    expect(dim).toHaveProperty('details');
    expect(Array.isArray(dim.evidence)).toBe(true);
    expect(Array.isArray(dim.suggestions)).toBe(true);
  });

  it('suspense dimension returns detection results', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['suspense'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(dim.score).toBeGreaterThanOrEqual(0);
    expect(dim.score).toBeLessThanOrEqual(10);
    expect(typeof dim.details.techniqueScore).toBe('number');
  });

  it('emotion dimension returns show/tell ratio', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['emotion'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(typeof dim.details.showTellRatio).toBe('number');
    expect(typeof dim.details.emotionScore).toBe('number');
  });

  it('character dimension returns creation assessment', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['character'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(typeof dim.score).toBe('number');
    expect(dim.details).toHaveProperty('creationDimensions');
    expect(dim.details).toHaveProperty('plotCharacterBalance');
  });

  it('dialogue dimension returns subtext analysis', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['dialogue'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(typeof dim.details.subtextRatio).toBe('number');
    expect(typeof dim.details.voiceDistinctness).toBe('number');
  });

  it('hook dimension returns hook analysis', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['hook'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(dim.dimension).toBe('hook');
    expect(typeof dim.score).toBe('number');
    expect(typeof dim.details.hookScore).toBe('number');
    expect(dim.details.dimensions).toBeDefined();
  });

  it('cliffhanger dimension returns cliffhanger analysis', async () => {
    const response = await writingCraftAnalyzeEndpoint(
      mockRequest({ text: SAMPLE_TEXT, dimensions: ['cliffhanger'] }),
    );
    const body = getBody(response);
    const dim = body.data.dimensions[0];
    expect(dim.dimension).toBe('cliffhanger');
    expect(typeof dim.score).toBe('number');
    expect(typeof dim.details.cliffhangerScore).toBe('number');
    expect(dim.details.dimensions).toBeDefined();
  });
});

describe('writingCraftLLMEndpoint', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 400 when LLM config is missing', async () => {
    const response = await writingCraftLLMEndpoint(
      mockRequest({ text: SAMPLE_TEXT }),
    );

    expect(response.statusCode).toBe(400);
    expect(getBody(response).success).toBe(false);
  });

  it('calls the provider with the expected payload and parses the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse(JSON.stringify({
        score: 8.4,
        evidence: ['结构清晰'],
        suggestions: ['补强转折'],
        analysis: '结构层次完整',
      })),
    );
    vi.stubGlobal('fetch', fetchMock);

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
    const body = getBody(response);
    expect(body.success).toBe(true);
    expect(body.data.source).toBe('llm');
    expect(body.data.dimensions).toHaveLength(1);
    expect(body.data.dimensions[0].dimension).toBe('structure');
    expect(body.data.dimensions[0].score).toBe(8.4);
    expect(body.data.dimensions[0].details.analysis).toBe('结构层次完整');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test',
        }),
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = JSON.parse(String(requestInit?.body ?? '{}'));
    expect(requestBody.model).toBe('gpt-4o');
    expect(requestBody.messages[0].role).toBe('system');
    expect(requestBody.messages[1].role).toBe('user');
  });

  it('returns a structured fallback when the provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('server error', { status: 500 }),
    ));

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
    const body = getBody(response);
    expect(body.data.dimensions[0].score).toBe(0);
    expect(body.data.dimensions[0].suggestions[0]).toContain('LLM 分析失败');
  });
});
