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

describe('analysis endpoints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:34:56.000Z'));
    graphQueryMock.mockReset();
    graphGetRelationshipsMock.mockReset();
    runConsistencyCheckMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('detects category-filtered patterns and escapes the category in graph queries', async () => {
    graphQueryMock.mockResolvedValueOnce([
      {
        id: 'scene-0',
        name: 'Ignored Scene',
        observations: ['No useful patterns here.'],
      },
    ]);

    const { analysisPatternsEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const escaped = await analysisPatternsEndpoint(makeRequest({
      category: "char'acter",
    }));

    expect(escaped.statusCode).toBe(200);
    expect(graphQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("n.category = 'char\\'acter'"),
    );
    expect(escaped.body).toEqual([]);

    graphQueryMock.mockResolvedValueOnce([
      {
        id: 'scene-1',
        name: 'Hero Redemption',
        observations: ['The lead begins a redemption arc.'],
      },
      {
        id: 'scene-2',
        name: 'Mentor Growth',
        observations: ['Another growth moment confirms the arc.'],
      },
    ]);
    const response = await analysisPatternsEndpoint(makeRequest({
      category: 'character',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject([
      {
        name: 'character-arc',
        category: 'character',
        occurrences: [
          { entityId: 'scene-1', entityName: 'Hero Redemption' },
          { entityId: 'scene-2', entityName: 'Mentor Growth' },
        ],
      },
    ]);
  });

  it('returns an empty session list', async () => {
    const { analysisSessionsEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisSessionsEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns an empty narrative visualization bundle when no chapters are provided', async () => {
    const { analysisNarrativeVisualizationEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisNarrativeVisualizationEndpoint(makeRequest({}));
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(body.timeline.empty).toBe(true);
    expect(body.tension.empty).toBe(true);
    expect(body.characterGraph.empty).toBe(true);
    expect(body.meta).toMatchObject({
      chapterCount: 0,
      hasData: false,
      source: 'existing-analysis',
      generatedAt: '2026-06-04T12:34:56.000Z',
    });
  });

  it('normalizes chapters, reuses consistency output, and builds a relationship graph bundle', async () => {
    runConsistencyCheckMock.mockResolvedValueOnce({
      timeline: {
        totalConflicts: 1,
        criticalCount: 0,
        majorCount: 1,
        minorCount: 0,
        infoCount: 0,
        conflicts: [
          {
            id: 'timeline-1',
            type: 'timeline-gap',
            severity: 'major',
            description: 'Gap detected',
            chaptersInvolved: [7],
          },
        ],
      },
      character: {
        characterTimelines: new Map([
          ['hero', [{ characterName: 'Hero', present: true }]],
          ['guide', [{ characterName: 'Guide', present: true }]],
        ]),
      },
    });
    graphGetRelationshipsMock.mockResolvedValueOnce([
      { from: 'Hero', to: 'Guide', type: 'ALLY', trust: 0.9 },
      { source: 'Guide', target: 'Oracle', relation_type: 'KNOWS', weight: 0.7 },
    ]);

    const { analysisNarrativeVisualizationEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisNarrativeVisualizationEndpoint(makeRequest({
      relationshipRoot: 'Hero',
      chapters: [
        { content: 'Hero enters the city.', chapterIndex: 0, chapterNumber: 7, title: 'Arrival' },
        { content: 'Guide reveals the map.' },
      ],
      chapterMeta: [
        { chapterNumber: 7, title: 'Arrival' },
        { chapterNumber: 8, title: 'Revelation' },
      ],
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    }));
    const body = response.body as Record<string, any>;

    expect(response.statusCode).toBe(200);
    expect(runConsistencyCheckMock).toHaveBeenCalledWith(expect.objectContaining({
      chapters: ['Hero enters the city.', 'Guide reveals the map.'],
      chapterMeta: [
        { chapterNumber: 7, title: 'Arrival' },
        { chapterNumber: 8, title: 'Revelation' },
      ],
    }));
    expect(graphGetRelationshipsMock).toHaveBeenCalledWith('Hero', null, 2);
    expect(body.timeline.summary).toContain('1 detected consistency issues');
    expect(body.timeline.events).toEqual([
      expect.objectContaining({
        id: 'timeline-1',
        chapterNumber: 7,
        severity: 'major',
      }),
    ]);
    expect(body.characterGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'Hero', name: 'Hero', importance: 1 }),
        expect.objectContaining({ id: 'Guide', name: 'Guide', importance: 1 }),
        expect.objectContaining({ id: 'Oracle', name: 'Oracle' }),
      ]),
    );
    expect(body.characterGraph.edges).toEqual([
      expect.objectContaining({ source: 'Hero', target: 'Guide', type: 'ALLY', weight: 0.9 }),
      expect.objectContaining({ source: 'Guide', target: 'Oracle', type: 'KNOWS', weight: 0.7 }),
    ]);
    expect(body.meta).toMatchObject({
      chapterCount: 2,
      hasData: true,
      generatedAt: '2026-06-04T12:34:56.000Z',
    });
  });
});
