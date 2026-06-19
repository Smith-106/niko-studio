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

describe('mcp/endpoints/m10-consistency', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects cross-chapter requests without chapters', async () => {
    getContainerMock.mockReturnValue({ graph: null, search: null });
    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await crossChapterConsistencyEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'chapters array is required' });
  });

  it('detects cross-chapter issues and enriches the report with graph hits', async () => {
    const getNode = vi.fn(async (name: string) => (name === 'Alan' ? { id: name } : null));
    getContainerMock.mockReturnValue({ graph: { getNode } });

    const { crossChapterConsistencyEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');
    const response = await crossChapterConsistencyEndpoint(
      makeRequest({
        chapters: [
          {
            chapterNumber: 1,
            title: 'Dockside Whisper',
            content:
              'Alan 在 2025年 提到了阿明的秘密。昨天 Alan 冷酷地离开了仓库，Alen 只是在阴影里注视。',
          },
          {
            chapterNumber: 2,
            title: 'Bell Toll',
            content:
              'Alan 在 2024年 仍在追查阿明的秘密。昨天 Alan 变得温柔，而 Alen 再次出现却没有揭开真相。',
          },
        ],
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      chaptersChecked: 2,
      graphEnriched: true,
      graphEntities: 1,
      overallScore: expect.any(Number),
    });

    const body = response.body as {
      nameConflicts: Array<{ character: string }>;
      timelineIssues: unknown[];
      unresolvedThreads: unknown[];
      traitDrifts: unknown[];
    };

    expect(body.nameConflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          character: expect.stringContaining('Alan'),
        }),
      ]),
    );
    expect(body.timelineIssues.length).toBeGreaterThan(0);
    expect(body.unresolvedThreads.length).toBeGreaterThan(0);
    expect(body.traitDrifts.length).toBeGreaterThan(0);
    expect(getNode).toHaveBeenCalled();
  });

  it('returns 400 when context-aware suggestions receive empty text', async () => {
    getContainerMock.mockReturnValue({ search: null });
    const { contextAwareSuggestionsEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');

    const response = await contextAwareSuggestionsEndpoint(makeRequest({ text: '   ' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('builds context-aware suggestions from search results and degrades gracefully on search failure', async () => {
    const search = { search: vi.fn().mockResolvedValue([{ content: 'first clue' }, { content: 'second clue' }]) };
    getContainerMock.mockReturnValueOnce({ search });

    const { contextAwareSuggestionsEndpoint } = await import('../../mcp/endpoints/m10-consistency.js');
    const success = await contextAwareSuggestionsEndpoint(
      makeRequest({ text: 'Find the ledger' }),
    );

    expect(success.statusCode).toBe(200);
    expect(success.body).toEqual({
      context: 'first clue\nsecond clue',
      suggestions: ['Found 2 related passages from search index'],
    });
    expect(search.search).toHaveBeenCalledWith('Find the ledger', { limit: 3 });

    const brokenSearch = { search: vi.fn().mockRejectedValue(new Error('offline')) };
    getContainerMock.mockReturnValueOnce({ search: brokenSearch });

    const degraded = await contextAwareSuggestionsEndpoint(
      makeRequest({ text: 'Fallback check' }),
    );

    expect(degraded.statusCode).toBe(200);
    expect(degraded.body).toEqual({
      context: '',
      suggestions: [],
    });
  });
});
