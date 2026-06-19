import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const graphQueryMock = vi.hoisted(() => vi.fn());
const graphGetCharacterMock = vi.hoisted(() => vi.fn());
const graphGetForeshadowsMock = vi.hoisted(() => vi.fn());
const graphGetRelationshipsMock = vi.hoisted(() => vi.fn());
const graphAddEntityMock = vi.hoisted(() => vi.fn());
const getConfigValueMock = vi.hoisted(() => vi.fn());
const normalizeProjectWorkspaceContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph', () => ({
  graphQuery: graphQueryMock,
  graphGetCharacter: graphGetCharacterMock,
  graphGetForeshadows: graphGetForeshadowsMock,
  graphGetRelationships: graphGetRelationshipsMock,
  graphAddEntity: graphAddEntityMock,
}));

vi.mock('../../mcp/config', () => ({
  getConfigValue: getConfigValueMock,
}));

vi.mock('../../project/workspace-model.js', () => ({
  normalizeProjectWorkspaceContext: normalizeProjectWorkspaceContextMock,
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return { method: 'POST', url: '/graph', headers: {}, body, query: {}, params: {} };
}

describe('graph endpoints — blocked cypher and depth fallback branches', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ---------------------------------------------------------------
  // isCypherSafe — blocked pattern returns 403
  // ---------------------------------------------------------------

  it('rejects DETACH DELETE cypher with 403', async () => {
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'MATCH (n) DETACH DELETE n',
    }));

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error: 'Cypher query contains blocked patterns (DETACH DELETE, DROP, CREATE CONSTRAINT/INDEX, REMOVE label). Only read-only queries are allowed.',
    });
    expect(graphQueryMock).not.toHaveBeenCalled();
  });

  it('rejects DROP cypher with 403', async () => {
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'DROP INDEX my_index',
    }));

    expect(response.statusCode).toBe(403);
    expect(graphQueryMock).not.toHaveBeenCalled();
  });

  it('rejects CREATE CONSTRAINT cypher with 403', async () => {
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'CREATE CONSTRAINT FOR (n:Character) REQUIRE n.name IS UNIQUE',
    }));

    expect(response.statusCode).toBe(403);
    expect(graphQueryMock).not.toHaveBeenCalled();
  });

  it('rejects CREATE INDEX cypher with 403', async () => {
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'CREATE INDEX FOR (n:Character) ON (n.name)',
    }));

    expect(response.statusCode).toBe(403);
    expect(graphQueryMock).not.toHaveBeenCalled();
  });

  it('rejects REMOVE label cypher with 403', async () => {
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'MATCH (n) REMOVE n:Character',
    }));

    expect(response.statusCode).toBe(403);
    expect(graphQueryMock).not.toHaveBeenCalled();
  });

  it('allows safe read-only cypher to pass through', async () => {
    graphQueryMock.mockResolvedValueOnce([{ n: { name: 'Alice' } }]);
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: 'MATCH (n:Character) RETURN n LIMIT 5',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([{ n: { name: 'Alice' } }]);
    expect(graphQueryMock).toHaveBeenCalledWith('MATCH (n:Character) RETURN n LIMIT 5', null);
  });

  it('skips cypher safety check when cypher string is empty or whitespace', async () => {
    graphQueryMock.mockResolvedValueOnce([]);
    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await graphQueryEndpoint(makeRequest({
      cypher: '   ',
    }));

    expect(response.statusCode).toBe(200);
    expect(graphQueryMock).toHaveBeenCalledWith('   ', null);
  });

  // ---------------------------------------------------------------
  // characterDepthEndpoint — dimensionScores not an object (line 225)
  // ---------------------------------------------------------------

  it('falls back to empty scores when five_dimension_score in properties is a string', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({
      properties: {
        five_dimension_score: 'not-an-object',
      },
    });
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'char-Alice',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      character: 'Alice',
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

  it('falls back to empty scores when five_dimension_score in properties is a number', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({
      properties: {
        five_dimension_score: 42,
      },
    });
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'Bob',
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

  it('falls back to default scores when five_dimension_score in properties is an array (typeof is object but keys are numeric)', async () => {
    // typeof [] === 'object' is true, so the array takes the truthy branch of
    // the ternary on line 223-224. Numeric array indices (0,1,2) do not match
    // the expected score keys, so all scores fall back to 50.
    graphGetCharacterMock.mockResolvedValueOnce({
      properties: {
        five_dimension_score: [88, 72, 60],
      },
    });
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'Eve',
    }));

    expect(response.statusCode).toBe(200);
    // Array takes truthy branch but numeric keys don't match score names
    expect((response.body as Record<string, unknown>).scores).toEqual({
      dynamicScore: 50,
      competenceScore: 50,
      eccentricityScore: 50,
      contrastScore: 50,
      dualityScore: 50,
    });
  });

  it('falls back to empty scores when five_dimension_score in properties is null', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({
      properties: {
        five_dimension_score: null,
      },
    });
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'NullChar',
    }));

    // null triggers `?? {}` on line 222, producing `{}` which IS an object,
    // so it takes the truthy branch. This confirms the null path behavior.
    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).scores).toEqual({
      dynamicScore: 50,
      competenceScore: 50,
      eccentricityScore: 50,
      contrastScore: 50,
      dualityScore: 50,
    });
  });

  it('uses valid dimension scores when five_dimension_score is a proper object', async () => {
    graphGetCharacterMock.mockResolvedValueOnce({
      properties: {
        five_dimension_score: {
          dynamicScore: 88,
          competenceScore: 72,
          eccentricityScore: 60,
        },
      },
    });
    const { characterDepthEndpoint } = await import('../../mcp/endpoints/graph');

    const response = await characterDepthEndpoint(makeRequest({
      id: 'FullChar',
    }));

    expect(response.statusCode).toBe(200);
    expect((response.body as Record<string, unknown>).scores).toEqual({
      dynamicScore: 88,
      competenceScore: 72,
      eccentricityScore: 60,
      contrastScore: 50,
      dualityScore: 50,
    });
  });
});
