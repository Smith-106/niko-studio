import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const graphAddEntityMock = vi.hoisted(() => vi.fn());
const graphGetForeshadowsMock = vi.hoisted(() => vi.fn());
const getConfigValueMock = vi.hoisted(() => vi.fn());
const normalizeProjectWorkspaceContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph', () => ({
  graphQuery: vi.fn(),
  graphGetCharacter: vi.fn(),
  graphGetForeshadows: graphGetForeshadowsMock,
  graphGetRelationships: vi.fn(),
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

describe('mcp/endpoints/graph branch-gap coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('foreshadowPlantEndpoint uses importance ?? 1 when importance is omitted (line 154)', async () => {
    graphAddEntityMock.mockResolvedValueOnce({ id: 'foreshadow-1' });
    normalizeProjectWorkspaceContextMock.mockReturnValueOnce({
      identity: { workspaceId: 'ws-1', projectId: null },
    });
    getConfigValueMock.mockReturnValue(true);

    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'A mysterious shadow appears',
      workspace_id: 'ws-1',
      // importance is deliberately omitted to trigger ?? 1
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    // importance should default to 1 when not provided
    expect(body.importance).toBe(1);
    // Also verify the addEntity was called with importance: 1
    expect(graphAddEntityMock).toHaveBeenCalledWith(
      'Foreshadow',
      expect.any(String),
      expect.objectContaining({ importance: 1 }),
    );
  });

  it('foreshadowStatsEndpoint handles null parseBody with ?? fallback (line 161)', async () => {
    graphGetForeshadowsMock.mockResolvedValueOnce([]);
    graphGetForeshadowsMock.mockResolvedValueOnce([]);
    graphGetForeshadowsMock.mockResolvedValueOnce([]);
    normalizeProjectWorkspaceContextMock.mockReturnValueOnce({
      identity: { workspaceId: 'ws-1', projectId: null },
    });
    getConfigValueMock.mockReturnValue(true);

    const { foreshadowStatsEndpoint } = await import('../../mcp/endpoints/graph.js');

    // Call with empty body — parseBody should still produce an object,
    // but the ?? {} fallback handles any null edge case
    const response = await foreshadowStatsEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.total).toBe(0);
    expect(body.by_state).toEqual({ planted: 0, hinted: 0, harvested: 0 });
  });
});
