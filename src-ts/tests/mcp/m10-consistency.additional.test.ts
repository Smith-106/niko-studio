import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const getContainerMock = vi.hoisted(() => vi.fn());

vi.mock('../../container/ServiceContainer.js', () => ({
  getContainer: getContainerMock,
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/m10/consistency',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('mcp/endpoints/m10-consistency additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('covers default graph fallback plus trimmed and single-chapter character branches', async () => {
    getContainerMock.mockReturnValue({ graph: null });
    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await crossChapterConsistencyEndpoint(
      makeRequest({
        chapters: [
          {
            chapterNumber: 1,
            title: 'Chapter One',
            content:
              '\u5c0f\u8bf4\u8bf4\u8fd9\u4e2a\u79d8\u5bc6\u8fd8\u6ca1\u6709\u7b54\u6848\u3002 Mara waits by the window.',
          },
          {
            chapterNumber: 2,
            title: 'Chapter Two',
            content: '\u539f\u6765\u771f\u76f8\u662f\u4ed6\u7ec8\u4e8e\u56de\u6765\u4e86\u3002',
          },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      chaptersChecked: 2,
      graphEnriched: false,
      graphEntities: 0,
    });
  });

  it('skips empty trait comparisons and swallows per-name graph lookup failures', async () => {
    const getNode = vi.fn().mockRejectedValue(new Error('lookup failed'));
    getContainerMock.mockReturnValue({ graph: { getNode } });
    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await crossChapterConsistencyEndpoint(
      makeRequest({
        chapters: [
          {
            chapterNumber: 1,
            title: 'Dock',
            content:
              '\u963f\u660e\u8bf4\u6628\u5929\u4ed6\u53bb\u4e86\u7801\u5934\u3002 Alan watched from the shadows while Alen took notes.',
          },
          {
            chapterNumber: 2,
            title: 'Bell',
            content:
              '\u963f\u660e\u8bf4\u4eca\u5929\u7ebf\u7d22\u8fd8\u6ca1\u5230\u3002 Alan returned quietly, and Alen stayed nearby.',
          },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      graphEnriched: false,
      graphEntities: 0,
      nameConflicts: expect.arrayContaining([
        expect.objectContaining({
          character: expect.stringContaining('Alan'),
        }),
      ]),
      traitDrifts: [],
    });
    expect(getNode).toHaveBeenCalled();
  });

  it('falls back cleanly when graph enrichment cannot resolve the container', async () => {
    getContainerMock.mockImplementation(() => {
      throw new Error('container unavailable');
    });
    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await crossChapterConsistencyEndpoint(
      makeRequest({
        chapters: [
          {
            chapterNumber: 1,
            title: 'Regression',
            content: 'Alan met Alen in 2025.',
          },
          {
            chapterNumber: 2,
            title: 'Earlier',
            content: 'Alan met Alen again in 2024.',
          },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      graphEnriched: false,
      graphEntities: 0,
    });
  });

  it('normalizes long chinese mentions that end with action characters before trait analysis', async () => {
    getContainerMock.mockReturnValue({ graph: null });
    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await crossChapterConsistencyEndpoint(
      makeRequest({
        chapters: [
          {
            chapterNumber: 1,
            title: 'Odd Name',
            content: '阿高站说自己依旧冷酷，并在仓库门口停下。',
          },
          {
            chapterNumber: 2,
            title: 'Return',
            content: '阿高站说自己忽然温柔下来，却没有更多解释。',
          },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      chaptersChecked: 2,
      graphEnriched: false,
      graphEntities: 0,
    });
  });

  it('retains 2-character names after normalization and still reports trait drift', async () => {
    getContainerMock.mockReturnValue({ graph: null });
    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await crossChapterConsistencyEndpoint(
      makeRequest({
        chapters: [
          {
            chapterNumber: 1,
            title: 'Short Name A',
            content: '阿站说自己依旧冷酷，却没有解释原因。',
          },
          {
            chapterNumber: 2,
            title: 'Short Name B',
            content: '阿站说自己忽然温柔下来，仍旧没有解释原因。',
          },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      chaptersChecked: 2,
      graphEnriched: false,
      graphEntities: 0,
      traitDrifts: [
        expect.objectContaining({
          character: '阿站',
          trait: 'personality',
        }),
      ],
    });
  });

  it('uses default empty text and stringifies search hits without content fields', async () => {
    const search = {
      search: vi.fn().mockResolvedValue([42, { note: 'fallback' }]),
    };
    getContainerMock.mockReturnValueOnce({ search });
    const { contextAwareSuggestionsEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const empty = await contextAwareSuggestionsEndpoint(makeRequest({}));
    expect(empty.statusCode).toBe(400);
    expect(empty.body).toEqual({ error: 'text is required' });

    const success = await contextAwareSuggestionsEndpoint(
      makeRequest({ text: 'Need search context' }),
    );

    expect(success.statusCode).toBe(200);
    expect(success.body).toEqual({
      context: '42\n[object Object]',
      suggestions: ['Found 2 related passages from search index'],
    });
    expect(search.search).toHaveBeenCalledWith('Need search context', { limit: 3 });
  });
});
