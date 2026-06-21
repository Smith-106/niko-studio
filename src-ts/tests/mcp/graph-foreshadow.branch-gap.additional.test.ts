import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const graphAddEntityMock = vi.hoisted(() => vi.fn());
const graphGetForeshadowsMock = vi.hoisted(() => vi.fn());
const getConfigValueMock = vi.hoisted(() => vi.fn());
const normalizeProjectWorkspaceContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/services/graph', () => ({
  graphAddEntity: graphAddEntityMock,
  graphGetForeshadows: graphGetForeshadowsMock,
  graphQuery: vi.fn(),
  graphGetCharacter: vi.fn(),
  graphGetRelationships: vi.fn(),
}));

vi.mock('../../mcp/config', () => ({
  getConfigValue: getConfigValueMock,
}));

vi.mock('../../project/workspace-model.js', () => ({
  normalizeProjectWorkspaceContext: normalizeProjectWorkspaceContextMock,
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return { method: 'POST', url: '/graph/foreshadow/plant', headers: {}, body, query: {}, params: {} };
}

function makeScopedRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/graph/foreshadow/plant',
    headers: {},
    body: {
      ...body,
      workspace_id: 'ws-test',
      project_id: 'proj-test',
    },
    query: {},
    params: {},
  };
}

describe('graph foreshadow endpoint branch coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    normalizeProjectWorkspaceContextMock.mockReturnValue({
      identity: { workspaceId: 'ws-normalized', projectId: 'proj-normalized' },
    });
  });

  it('plants a foreshadow and returns the entity id when graphAddEntity returns an object with id', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue({ id: 'fs-123', name: 'foreshadow-123' });

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'A dark shadow loomed',
      importance: 3,
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.id).toBe('fs-123');
    expect(body.state).toBe('planted');
    expect(body.importance).toBe(3);
    expect(graphAddEntityMock).toHaveBeenCalledWith('Foreshadow', expect.any(String), expect.objectContaining({
      description: 'A dark shadow loomed',
      state: 'planted',
      importance: 3,
    }));
  });

  it('falls back to generated id when graphAddEntity result has no id field', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    // Return an object without 'id' — triggers the fallback branch
    graphAddEntityMock.mockResolvedValue({ name: 'foreshadow-999' });

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'Mysterious clue',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    // Should use fallback format: foreshadow-{timestamp}
    expect(String(body.id)).toMatch(/^foreshadow-\d+$/);
  });

  it('falls back to generated id when graphAddEntity returns null', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue(null);

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'Hidden message',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(String(body.id)).toMatch(/^foreshadow-\d+$/);
  });

  it('includes scene_id, tags, and metadata when provided in the request', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue({ id: 'fs-full' });

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'Full props foreshadow',
      scene_id: 'scene-1',
      tags: ['mystery', 'clue'],
      metadata: { chapter: 5 },
    }));

    expect(response.statusCode).toBe(200);
    expect(graphAddEntityMock).toHaveBeenCalledWith('Foreshadow', expect.any(String), expect.objectContaining({
      scene_id: 'scene-1',
      tags: ['mystery', 'clue'],
      metadata: { chapter: 5 },
    }));
  });

  it('omits scene_id, tags, and metadata when not provided', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue({ id: 'fs-min' });

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'Minimal foreshadow',
    }));

    expect(response.statusCode).toBe(200);
    const callArgs = graphAddEntityMock.mock.calls[0][2] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty('scene_id');
    expect(callArgs).not.toHaveProperty('tags');
    expect(callArgs).not.toHaveProperty('metadata');
  });

  it('defaults importance to 1 when not specified', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue({ id: 'fs-default-imp' });

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'Default importance',
    }));

    expect(response.statusCode).toBe(200);
    expect(graphAddEntityMock).toHaveBeenCalledWith('Foreshadow', expect.any(String), expect.objectContaining({
      importance: 1,
    }));
  });

  it('includes workspaceId and projectId in properties when scope is provided', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue({ id: 'fs-scoped' });

    const response = await foreshadowPlantEndpoint(makeScopedRequest({
      description: 'Scoped foreshadow',
    }));

    expect(response.statusCode).toBe(200);
    expect(graphAddEntityMock).toHaveBeenCalledWith('Foreshadow', expect.any(String), expect.objectContaining({
      workspaceId: expect.any(String),
      projectId: expect.any(String),
    }));
  });

  it('returns empty tags and metadata when graphAddEntity result omits them', async () => {
    const { foreshadowPlantEndpoint } = await import('../../mcp/endpoints/graph');

    graphAddEntityMock.mockResolvedValue({ id: 'fs-no-props' });

    const response = await foreshadowPlantEndpoint(makeRequest({
      description: 'No extra props',
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.tags).toEqual([]);
    expect(body.metadata).toEqual({});
  });

  it('foreshadowStatsEndpoint returns counts for planted/hinted/harvested', async () => {
    const { foreshadowStatsEndpoint } = await import('../../mcp/endpoints/graph');

    graphGetForeshadowsMock.mockImplementation(async (state) => {
      if (state === 'planted') return [{ id: '1' }, { id: '2' }];
      if (state === 'hinted') return [{ id: '3' }];
      return []; // harvested
    });

    const response = await foreshadowStatsEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.total).toBe(3);
    expect(body.by_state).toMatchObject({ planted: 2, hinted: 1, harvested: 0 });
  });
});
