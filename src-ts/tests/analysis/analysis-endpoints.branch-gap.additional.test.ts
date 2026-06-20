import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const graphQueryMock = vi.hoisted(() => vi.fn());
const graphGetRelationshipsMock = vi.hoisted(() => vi.fn());
const runConsistencyCheckMock = vi.hoisted(() => vi.fn());
const buildNarrativeVisualizationMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph.js', () => ({
  graphQuery: graphQueryMock,
  graphGetRelationships: graphGetRelationshipsMock,
}));

vi.mock('../../mcp/endpoints/critic.js', () => ({
  runConsistencyCheck: runConsistencyCheckMock,
}));

vi.mock('../../narrative/narrative-visualization.js', () => ({
  buildNarrativeVisualizationBundle: buildNarrativeVisualizationMock,
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/analysis',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('mcp/endpoints/analysis branch-gap coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('falls back to index-based chapterNumber and title when chapters omit them (lines 64-65)', async () => {
    runConsistencyCheckMock.mockResolvedValueOnce({
      timeline: { issues: [] },
      character: { issues: [] },
    });
    graphGetRelationshipsMock.mockResolvedValueOnce([]);
    buildNarrativeVisualizationMock.mockReturnValueOnce({ bundle: true });

    const { analysisNarrativeVisualizationEndpoint } = await import('../../mcp/endpoints/analysis.js');

    // Provide chapters without chapterNumber and title — this triggers the ?? fallbacks
    const response = await analysisNarrativeVisualizationEndpoint(makeRequest({
      chapters: [
        { content: 'First chapter content here.' },
        { content: 'Second chapter content here.' },
      ],
    }));

    expect(response.statusCode).toBe(200);

    // Verify the fallbacks were used: chapterNumber should be index+1, title should be "Chapter N"
    expect(runConsistencyCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterMeta: [
          { chapterNumber: 1, title: 'Chapter 1' },
          { chapterNumber: 2, title: 'Chapter 2' },
        ],
      }),
    );

    // Also verify buildNarrativeVisualizationBundle received chapters with fallbacks
    expect(buildNarrativeVisualizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chapters: [
          expect.objectContaining({
            chapterNumber: 1,
            title: 'Chapter 1',
          }),
          expect.objectContaining({
            chapterNumber: 2,
            title: 'Chapter 2',
          }),
        ],
      }),
    );
  });

  it('uses provided chapterNumber and title when present (non-fallback path)', async () => {
    runConsistencyCheckMock.mockResolvedValueOnce({
      timeline: { issues: [] },
      character: { issues: [] },
    });
    graphGetRelationshipsMock.mockResolvedValueOnce([]);
    buildNarrativeVisualizationMock.mockReturnValueOnce({ bundle: true });

    const { analysisNarrativeVisualizationEndpoint } = await import('../../mcp/endpoints/analysis.js');

    const response = await analysisNarrativeVisualizationEndpoint(makeRequest({
      chapters: [
        { content: 'Chapter content', chapterNumber: 5, title: 'The Beginning' },
      ],
    }));

    expect(response.statusCode).toBe(200);
    expect(runConsistencyCheckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterMeta: [
          { chapterNumber: 5, title: 'The Beginning' },
        ],
      }),
    );
  });
});
