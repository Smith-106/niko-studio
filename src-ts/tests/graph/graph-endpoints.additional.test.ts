import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const graphAddEntityMock = vi.hoisted(() => vi.fn());
const graphGetForeshadowsMock = vi.hoisted(() => vi.fn());
const graphGetCharacterMock = vi.hoisted(() => vi.fn());
const graphGetRelationshipsMock = vi.hoisted(() => vi.fn());
const graphQueryMock = vi.hoisted(() => vi.fn());
const getConfigValueMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph.js', () => ({
  graphAddEntity: graphAddEntityMock,
  graphGetForeshadows: graphGetForeshadowsMock,
  graphGetCharacter: graphGetCharacterMock,
  graphGetRelationships: graphGetRelationshipsMock,
  graphQuery: graphQueryMock,
}));

vi.mock('../../mcp/config.js', () => ({
  getConfigValue: getConfigValueMock,
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/graph',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('graph endpoints additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T13:00:00.000Z'));
    graphAddEntityMock.mockReset();
    graphGetForeshadowsMock.mockReset();
    graphGetCharacterMock.mockReset();
    graphGetRelationshipsMock.mockReset();
    graphQueryMock.mockReset();
    getConfigValueMock.mockReset();
    getConfigValueMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('validates foreshadow planting input and forwards normalized properties', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph.js');

    const invalid = await foreshadowPlantEndpoint(makeRequest({ description: '   ' }));
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toEqual({ error: 'description is required' });

    graphAddEntityMock.mockResolvedValueOnce({ id: 'foreshadow-1', status: 'created' });
    const valid = await foreshadowPlantEndpoint(makeRequest({
      description: 'A bell tolls before each attack.',
      importance: 3,
      scene_id: 'scene-7',
      tags: ['omen', 'bell'],
      metadata: { source: 'draft' },
    }));

    expect(valid.statusCode).toBe(200);
    expect(valid.body).toEqual({ id: 'foreshadow-1', status: 'created' });
    expect(graphAddEntityMock).toHaveBeenCalledWith(
      'foreshadow',
      expect.stringMatching(/^foreshadow-\d+$/),
      {
        description: 'A bell tolls before each attack.',
        state: 'planted',
        planted_at: '2026-06-04T13:00:00.000Z',
        importance: 3,
        scene_id: 'scene-7',
        tags: ['omen', 'bell'],
        metadata: { source: 'draft' },
      },
    );
  });

  it('applies default foreshadow properties when optional fields are absent or invalid', async () => {
    graphAddEntityMock.mockResolvedValueOnce({ id: 'foreshadow-defaults', status: 'created' });
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'Defaultable omen',
      tags: 'not-an-array' as unknown as string[],
      metadata: 'not-an-object' as unknown as Record<string, unknown>,
    }));

    expect(response.statusCode).toBe(200);
    expect(graphAddEntityMock).toHaveBeenCalledWith(
      'foreshadow',
      expect.stringMatching(/^foreshadow-\d+$/),
      {
        description: 'Defaultable omen',
        state: 'planted',
        planted_at: '2026-06-04T13:00:00.000Z',
        importance: 1,
      },
    );
  });

  it('rejects foreshadow planting when description is omitted entirely', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowPlantEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'description is required' });
  });

  it('passes a null scope to graph queries when no workspace or project identity is available', async () => {
    graphQueryMock.mockResolvedValueOnce([{ id: 'row-1' }]);
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'MATCH (n) RETURN n LIMIT 1',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id: 'row-1' }]);
    expect(graphQueryMock).toHaveBeenCalledWith('MATCH (n) RETURN n LIMIT 1', null);
  });

  it('falls back to an empty cypher string and trims blank workspace ids when resolving scope', async () => {
    graphQueryMock.mockResolvedValueOnce([{ id: 'row-2' }]);
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await graphQueryEndpoint(makeRequest({
      workspaceId: '   ',
      projectId: 'atlas-project',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id: 'row-2' }]);
    expect(graphQueryMock).toHaveBeenCalledWith(
      '',
      {
        workspaceId: null,
        projectId: 'atlas-project',
        allowLegacy: false,
      },
    );
  });

  it('forwards explicit relation flags and a workspace-only scope to character queries', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({ id: 'hero-2', ok: true });
    const { graphCharacterEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await graphCharacterEndpoint(makeRequest({
      name: 'Heroine',
      include_relations: false,
      include_timeline: true,
      workspaceId: 'workspace-only',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'hero-2', ok: true });
    expect(graphGetCharacterMock).toHaveBeenCalledWith(
      'Heroine',
      false,
      true,
      {
        workspaceId: 'workspace-only',
        projectId: null,
        allowLegacy: false,
      },
    );
  });

  it('uses default graph character flags when request fields are omitted', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({ id: 'hero-defaults' });
    const { graphCharacterEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await graphCharacterEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'hero-defaults' });
    expect(graphGetCharacterMock).toHaveBeenCalledWith('', true, false, null);
  });

  it('uses default foreshadow status and a project-only scope when listing foreshadows', async () => {
    graphGetForeshadowsMock.mockResolvedValueOnce([{ id: 'foreshadow-2' }]);
    const { graphForeshadowsEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await graphForeshadowsEndpoint(makeRequest({
      chapter: 7,
      context: {
        projectId: 'context-project',
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ id: 'foreshadow-2' }]);
    expect(graphGetForeshadowsMock).toHaveBeenCalledWith(
      'pending',
      7,
      {
        workspaceId: null,
        projectId: 'context-project',
        allowLegacy: false,
      },
    );
  });

  it('aggregates foreshadow stats across planted, hinted, and harvested states', async () => {
    graphGetForeshadowsMock
      .mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }])
      .mockResolvedValueOnce([{ id: 'h1' }])
      .mockResolvedValueOnce([{ id: 'done1' }]);

    const { foreshadowStatsEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await foreshadowStatsEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    expect(graphGetForeshadowsMock.mock.calls).toEqual([
      ['planted'],
      ['hinted'],
      ['harvested'],
    ]);
    expect(response.body).toEqual({
      total: 4,
      by_state: { planted: 2, hinted: 1, harvested: 1 },
      total_hints: 1,
      avg_hints_per_foreshadow: 0.25,
      harvest_rate: 0.25,
    });
  });

  it('falls back to empty foreshadow stats when graph results are not arrays', async () => {
    graphGetForeshadowsMock
      .mockResolvedValueOnce({ total: 1 })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('done');

    const { foreshadowStatsEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await foreshadowStatsEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      total: 0,
      by_state: { planted: 0, hinted: 0, harvested: 0 },
      total_hints: 0,
      avg_hints_per_foreshadow: 0,
      harvest_rate: 0,
    });
  });

  it('validates and maps character profile data with fallback timestamps', async () => {
    const { characterProfileEndpoint } = await import('../../mcp/endpoints/graph.js');

    const invalid = await characterProfileEndpoint(makeRequest({ name: ' ' }));
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toEqual({ error: 'name is required' });

    graphGetCharacterMock.mockResolvedValueOnce({
      id: 'hero-1',
      role: 'lead',
    });
    const valid = await characterProfileEndpoint(makeRequest({
      name: 'Hero',
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    }));

    expect(valid.statusCode).toBe(200);
    expect(graphGetCharacterMock).toHaveBeenCalledWith(
      'Hero',
      true,
      false,
      {
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        allowLegacy: false,
      },
    );
    expect(valid.body).toEqual({
      id: 'hero-1',
      name: 'Hero',
      role: 'lead',
      personality: {},
      background: {},
      motivation: {},
      relationships: {},
      growth: {},
      five_dimension_score: {},
      created_at: '2026-06-04T13:00:00.000Z',
      updated_at: '2026-06-04T13:00:00.000Z',
    });
  });

  it('rejects profile requests when the name field is omitted entirely', async () => {
    const { characterProfileEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await characterProfileEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'name is required' });
  });

  it('falls back to generated profile defaults when the character payload is not an object', async () => {
    graphGetCharacterMock.mockResolvedValueOnce('broken-profile');
    const { characterProfileEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await characterProfileEndpoint(makeRequest({
      name: 'Fallback Hero',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      id: 'char-Fallback Hero',
      name: 'Fallback Hero',
      role: 'unknown',
      personality: {},
      background: {},
      motivation: {},
      relationships: {},
      growth: {},
      five_dimension_score: {},
      created_at: '2026-06-04T13:00:00.000Z',
      updated_at: '2026-06-04T13:00:00.000Z',
    });
  });

  it('validates character depth requests, strips legacy ids, and fills default scores', async () => {
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph.js');

    const invalid = await characterDepthEndpoint(makeRequest({ id: '' }));
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toEqual({ error: 'id is required' });

    graphGetCharacterMock.mockResolvedValueOnce({
      five_dimension_score: {
        dynamicScore: 88,
        contrastScore: 61,
      },
    });
    const valid = await characterDepthEndpoint(makeRequest({
      id: 'char-Alice',
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    }));

    expect(valid.statusCode).toBe(200);
    expect(graphGetCharacterMock).toHaveBeenCalledWith(
      'Alice',
      true,
      false,
      {
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        allowLegacy: false,
      },
    );
    expect(valid.body).toEqual({
      character: 'Alice',
      scores: {
        dynamicScore: 88,
        competenceScore: 50,
        eccentricityScore: 50,
        contrastScore: 61,
        dualityScore: 50,
      },
      depth_level: 'moderate',
      suggestions: [],
    });
  });

  it('rejects depth requests when the id field is omitted entirely', async () => {
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await characterDepthEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'id is required' });
  });

  it('falls back to default depth scores when dimension payload is not an object', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({
      five_dimension_score: 'broken-payload',
    });
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'Bob',
      projectId: 'atlas-project',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      character: 'Bob',
      scores: {
        dynamicScore: 50,
        competenceScore: 50,
        eccentricityScore: 50,
        contrastScore: 50,
        dualityScore: 50,
      },
      depth_level: 'moderate',
      suggestions: [],
    });
  });

  it('falls back to empty depth data when the character service returns a primitive payload', async () => {
    graphGetCharacterMock.mockResolvedValueOnce('broken-character-payload');
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'Eve',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      character: 'Eve',
      scores: {
        dynamicScore: 50,
        competenceScore: 50,
        eccentricityScore: 50,
        contrastScore: 50,
        dualityScore: 50,
      },
      depth_level: 'moderate',
      suggestions: [],
    });
  });

  it('builds relationship nodes and edges, including protagonist fallback and trust defaults', async () => {
    graphGetRelationshipsMock.mockResolvedValueOnce([
      { from: 'Bob', to: 'Carol', relation_type: 'KNOWS' },
      { source: 'Carol', target: 'Oracle', type: 'GUIDES', weight: 0.7 },
    ]);

    const { characterRelationshipsEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await characterRelationshipsEndpoint(makeRequest({
      name: 'Solo Hero',
      context: {
        projectId: 'atlas-project',
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(graphGetRelationshipsMock).toHaveBeenCalledWith(
      'Solo Hero',
      null,
      2,
      {
        workspaceId: null,
        projectId: 'atlas-project',
        allowLegacy: false,
      },
    );
    expect(response.body).toEqual({
      nodes: expect.arrayContaining([
        { id: 'Bob', name: 'Bob', role: 'character' },
        { id: 'Carol', name: 'Carol', role: 'character' },
        { id: 'Oracle', name: 'Oracle', role: 'character' },
        { id: 'Solo Hero', name: 'Solo Hero', role: 'protagonist' },
      ]),
      edges: [
        { source: 'Bob', target: 'Carol', type: 'KNOWS', trust: 0.5 },
        { source: 'Carol', target: 'Oracle', type: 'GUIDES', trust: 0.7 },
      ],
    });
  });

  it('handles empty names, non-array relationship payloads, and missing edge fields', async () => {
    graphGetRelationshipsMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce([
        { trust: 0.2 },
      ]);

    const { characterRelationshipsEndpoint } = await import('../../mcp/endpoints/graph.js');

    const emptyResponse = await characterRelationshipsEndpoint(makeRequest({}));
    expect(emptyResponse.statusCode).toBe(200);
    expect(graphGetRelationshipsMock).toHaveBeenNthCalledWith(
      1,
      '',
      null,
      2,
      null,
    );
    expect(emptyResponse.body).toEqual({
      nodes: [],
      edges: [],
    });

    const sparseResponse = await characterRelationshipsEndpoint(makeRequest({
      name: 'Sparse Hero',
    }));
    expect(sparseResponse.statusCode).toBe(200);
    expect(sparseResponse.body).toEqual({
      nodes: [
        { id: 'Sparse Hero', name: 'Sparse Hero', role: 'protagonist' },
      ],
      edges: [
        { source: '', target: '', type: 'related', trust: 0.2 },
      ],
    });
  });
});
