import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const graphQueryMock = vi.hoisted(() => vi.fn());
const graphGetRelationshipsMock = vi.hoisted(() => vi.fn());
const runConsistencyCheckMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph.js', () => ({
  graphQuery: graphQueryMock,
  graphGetRelationships: graphGetRelationshipsMock,
}));

vi.mock('../../mcp/endpoints/critic.js', () => ({
  runConsistencyCheck: runConsistencyCheckMock,
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

function makeConsistencyResult() {
  return {
    timeline: {
      totalConflicts: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      infoCount: 0,
      conflicts: [],
    },
    character: {
      characterTimelines: new Map(),
    },
  };
}

describe('analysis endpoints more additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T09:00:00.000Z'));
    graphQueryMock.mockReset();
    graphGetRelationshipsMock.mockReset();
    runConsistencyCheckMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('treats non-array graph query results as empty pattern input', async () => {
    graphQueryMock.mockResolvedValueOnce({ unexpected: true });

    const { analysisPatternsEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisPatternsEndpoint(makeRequest({ category: 'theme' }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('builds pattern matches from mixed entity records and fallback fields', async () => {
    graphQueryMock.mockResolvedValueOnce([
      {
        id: 'scene-1',
        name: 'Redemption arc',
        observations: 'not-an-array',
      },
      {
        id: null,
        name: undefined,
        observations: ['The growth arc resolves here.'],
      },
    ]);

    const { analysisPatternsEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisPatternsEndpoint(makeRequest({ category: 'character' }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject([
      {
        name: 'character-arc',
        category: 'character',
        occurrences: [
          {
            entityId: 'scene-1',
            entityName: 'Redemption arc',
          },
          {
            entityId: '',
            entityName: '',
          },
        ],
      },
    ]);
  });

  it('defaults missing chapter and relationship fields during normalization', async () => {
    runConsistencyCheckMock.mockResolvedValueOnce(makeConsistencyResult());
    graphGetRelationshipsMock.mockResolvedValueOnce([{}]);

    const { analysisNarrativeVisualizationEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisNarrativeVisualizationEndpoint(makeRequest({
      relationshipRoot: null,
      chapters: [{ content: null }],
    }));
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(runConsistencyCheckMock).toHaveBeenCalledWith(expect.objectContaining({
      chapters: [''],
      chapterMeta: [{ chapterNumber: 1, title: 'Chapter 1' }],
    }));
    expect(graphGetRelationshipsMock).toHaveBeenCalledWith('', null, 2);
    expect(body.timeline.chapters).toEqual([
      expect.objectContaining({
        chapterIndex: 0,
        chapterNumber: 1,
        title: 'Chapter 1',
      }),
    ]);
    expect(body.characterGraph.edges).toEqual([
      expect.objectContaining({
        source: '',
        target: '',
        type: 'related',
        weight: 0.5,
      }),
    ]);
  });

  it('ignores non-array relationship payloads when building the graph bundle', async () => {
    runConsistencyCheckMock.mockResolvedValueOnce(makeConsistencyResult());
    graphGetRelationshipsMock.mockResolvedValueOnce('not-an-array');

    const { analysisNarrativeVisualizationEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisNarrativeVisualizationEndpoint(makeRequest({
      chapters: [{ content: 'Only chapter', chapterIndex: 3, chapterNumber: 4, title: 'Start' }],
    }));
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.characterGraph.empty).toBe(true);
    expect(body.characterGraph.nodes).toEqual([]);
    expect(body.characterGraph.edges).toEqual([]);
  });
});
