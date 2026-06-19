import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const mockQuickExtract = vi.fn();

vi.mock('../../narrative/worldview-extractor.js', () => {
  return {
    WorldviewExtractor: vi.fn().mockImplementation(() => ({
      quickExtract: mockQuickExtract,
    })),
    __esModule: true,
  };
});

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/m11/worldview/extract',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function makeGetRequest(params: Record<string, string>): HttpRequest {
  return {
    method: 'GET',
    url: '/m11/worldview/get',
    headers: {},
    body: {},
    query: {},
    params,
  };
}

describe('m11-worldview endpoint', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // --- worldviewExtractEndpoint ---

  it('returns 400 when chapters array is empty', async () => {
    const { worldviewExtractEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewExtractEndpoint(makeRequest({ chapters: [] }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'chapters array is required' });
  });

  it('returns 400 when chapters is missing', async () => {
    const { worldviewExtractEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewExtractEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'chapters array is required' });
  });

  it('returns 200 with settings and count for valid chapters', async () => {
    const mockSettings = [
      { term: '法术', nature: 'magic_system', detail: '魔法系统中使用的法术能力', source: 'Ch.1: Opening' },
      { term: '灵力', nature: 'magic_system', detail: '角色内在的精神能量', source: 'Ch.1: Opening' },
    ];
    mockQuickExtract.mockReturnValueOnce(mockSettings);

    const { worldviewExtractEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewExtractEndpoint(
      makeRequest({
        chapters: [
          { chapterNumber: 1, title: 'Opening', content: '他使用法术攻击，灵力涌动。' },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.settings).toEqual(mockSettings);
    expect(body.count).toBe(2);
  });

  it('calls quickExtract with the chapters array', async () => {
    mockQuickExtract.mockReturnValueOnce([]);

    const { worldviewExtractEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const chapters = [
      { chapterNumber: 1, title: 'Chapter One', content: 'Some content here.' },
      { chapterNumber: 2, title: 'Chapter Two', content: 'More content here.' },
    ];

    await worldviewExtractEndpoint(makeRequest({ chapters }));

    expect(mockQuickExtract).toHaveBeenCalledWith(chapters);
  });

  it('returns 500 when WorldviewExtractor.quickExtract throws', async () => {
    mockQuickExtract.mockImplementationOnce(() => {
      throw new Error('Extraction engine crashed');
    });

    const { worldviewExtractEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewExtractEndpoint(
      makeRequest({
        chapters: [{ chapterNumber: 1, title: 'Test', content: 'content' }],
      }),
    );

    expect(response.statusCode).toBe(500);
    const body = response.body as Record<string, unknown>;
    expect(body.error).toBe('Extraction engine crashed');
  });

  // --- worldviewGetEndpoint ---

  it('returns 400 when projectId is missing', async () => {
    const { worldviewGetEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewGetEndpoint(makeGetRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'projectId is required' });
  });

  it('returns 400 when projectId is empty string', async () => {
    const { worldviewGetEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewGetEndpoint(makeGetRequest({ projectId: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'projectId is required' });
  });

  it('returns 200 with settings array and projectId for valid request', async () => {
    const { worldviewGetEndpoint } = await import('../../mcp/endpoints/m11-worldview.js');

    const response = await worldviewGetEndpoint(
      makeGetRequest({ projectId: 'proj-world-001' }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.settings).toEqual([]);
    expect(body.projectId).toBe('proj-world-001');
  });
});
