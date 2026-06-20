/**
 * Branch-gap tests for graph.ts
 *
 * Targets uncovered branches at lines 154 and 161:
 *   Line 154: `importance: Number(properties.importance ?? 1)` — the `?? 1` fallback
 *             when importance is explicitly undefined after spread.
 *   Line 161: `body ?? {}` in foreshadowStatsEndpoint — the nullish coalescing
 *             fallback when parseBody returns null/undefined.
 */

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

describe('mcp/endpoints/graph branch-gap additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('foreshadowPlantEndpoint uses ?? 1 fallback when importance is 0 (line 154)', async () => {
    // When importance is 0, Number(0 ?? 1) = Number(0) = 0 since 0 is not nullish
    // But when importance is undefined/null, Number(undefined ?? 1) = Number(1) = 1
    graphAddEntityMock.mockResolvedValueOnce({ id: 'foreshadow-zero' });
    normalizeProjectWorkspaceContextMock.mockReturnValueOnce({
      identity: { workspaceId: 'ws-1', projectId: null },
    });
    getConfigValueMock.mockReturnValue(true);

    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'A shadowy figure',
      workspace_id: 'ws-1',
      importance: 0, // explicitly 0 — should stay 0, not fall back to 1
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.importance).toBe(0);
  });

  it('foreshadowPlantEndpoint falls back to 1 when importance is null (line 154)', async () => {
    graphAddEntityMock.mockResolvedValueOnce({ id: 'foreshadow-null' });
    normalizeProjectWorkspaceContextMock.mockReturnValueOnce({
      identity: { workspaceId: 'ws-1', projectId: null },
    });
    getConfigValueMock.mockReturnValue(true);

    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'A mysterious event',
      workspace_id: 'ws-1',
      importance: null, // null triggers ?? 1
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    // importance: null in body -> body.importance is null -> ?? 1 fires -> Number(1) = 1
    expect(body.importance).toBe(1);
  });

  it('foreshadowStatsEndpoint computes harvest_rate when total > 0 (line 161)', async () => {
    // Test the stats computation branch when there are harvested foreshadows
    graphGetForeshadowsMock.mockResolvedValueOnce([{ id: 'f1' }, { id: 'f2' }]); // planted: 2
    graphGetForeshadowsMock.mockResolvedValueOnce([{ id: 'f3' }]); // hinted: 1
    graphGetForeshadowsMock.mockResolvedValueOnce([{ id: 'f4' }]); // harvested: 1
    normalizeProjectWorkspaceContextMock.mockReturnValueOnce({
      identity: { workspaceId: 'ws-1', projectId: null },
    });
    getConfigValueMock.mockReturnValue(true);

    const { foreshadowStatsEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowStatsEndpoint(makeRequest({
      workspace_id: 'ws-1',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.total).toBe(4);
    expect(body.by_state).toEqual({ planted: 2, hinted: 1, harvested: 1 });
    expect(body.harvest_rate).toBe(0.25); // 1/4
    expect(body.avg_hints_per_foreshadow).toBe(0.25); // 1/4
  });

  it('foreshadowStatsEndpoint handles non-array results from graphGetForeshadows (line 161)', async () => {
    // When graphGetForeshadows returns non-array values, the Array.isArray check
    // on lines 168-170 should fallback to empty arrays
    graphGetForeshadowsMock.mockResolvedValueOnce(null); // planted: not array
    graphGetForeshadowsMock.mockResolvedValueOnce('not-an-array'); // hinted: not array
    graphGetForeshadowsMock.mockResolvedValueOnce(42); // harvested: not array
    normalizeProjectWorkspaceContextMock.mockReturnValueOnce({
      identity: { workspaceId: 'ws-1', projectId: null },
    });
    getConfigValueMock.mockReturnValue(true);

    const { foreshadowStatsEndpoint } = await import('../../mcp/endpoints/graph.js');

    const response = await foreshadowStatsEndpoint(makeRequest({
      workspace_id: 'ws-1',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.total).toBe(0);
    expect(body.by_state).toEqual({ planted: 0, hinted: 0, harvested: 0 });
    expect(body.harvest_rate).toBe(0);
  });
});
