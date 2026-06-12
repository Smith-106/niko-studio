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

describe('analysis endpoints additional coverage', () => {
  beforeEach(() => {
    graphQueryMock.mockReset();
    graphGetRelationshipsMock.mockReset();
    runConsistencyCheckMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('uses the full pattern template list when no category filter is provided', async () => {
    graphQueryMock.mockResolvedValueOnce([]);

    const { analysisPatternsEndpoint } = await import('../../mcp/endpoints/analysis.js');
    const response = await analysisPatternsEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
    expect(graphQueryMock).toHaveBeenCalledWith(
      expect.not.stringContaining("n.category = '"),
    );
  });
});
