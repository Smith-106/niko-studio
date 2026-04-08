import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const graphQueryMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph', () => ({
  graphQuery: graphQueryMock,
  graphGetCharacter: vi.fn(),
  graphGetForeshadows: vi.fn(),
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/graph/query',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('graph endpoints', () => {
  beforeEach(() => {
    graphQueryMock.mockReset();
  });

  it('passes scoped MERGE authoring requests through the graph query endpoint', async () => {
    const cypher = `MERGE (n:Character ${JSON.stringify({ name: 'Alice', workspaceId: 'atlas-workspace' })}) SET ${JSON.stringify({
      name: 'Alicia',
      description: 'Updated archive captain',
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      itemKind: 'character',
    })} RETURN n`;
    const payload = [
      {
        n: {
          id: 'character-1',
          name: 'Alicia',
          type: 'Character',
          properties: {
            description: 'Updated archive captain',
            workspaceId: 'atlas-workspace',
            projectId: 'atlas-project',
            itemKind: 'character',
          },
        },
      },
    ];
    graphQueryMock.mockResolvedValueOnce(payload);

    const { graphQueryEndpoint } = await import('../../mcp/endpoints/graph.js');
    const response = await graphQueryEndpoint(makeRequest({
      cypher,
      workspace: {
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
        },
      },
    }));

    expect(graphQueryMock).toHaveBeenCalledWith(cypher);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(payload);
  });
});
