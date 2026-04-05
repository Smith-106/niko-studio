import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

const memoryAddMock = vi.fn();

vi.mock('../../mcp/services/memory', () => ({
  memoryAdd: memoryAddMock,
  memorySearch: vi.fn(),
  memoryGetTemporal: vi.fn(),
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/memory/add',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('memory endpoints', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('maps snake_case add payload fields into memory service parameters', async () => {
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-endpoint', status: 'created' });

    const { memoryAddEndpoint } = await import('../../mcp/endpoints/memory.js');

    const response = await memoryAddEndpoint(
      makeRequest({
        content: 'endpoint memory',
        layer: 'project',
        dimension: 'character',
        entity_id: 'hero-endpoint',
        valid_from: '2026-04-01T00:00:00Z',
        valid_until: '2026-08-01T00:00:00Z',
        user_id: 'user-endpoint',
        project_id: 'project-endpoint',
        session_id: 'session-endpoint',
        importance: 0.77,
        confidence: 0.66,
        source: 'endpoint-import',
        tags: ['phase4', 'endpoint'],
      }),
    );

    expect(memoryAddMock).toHaveBeenCalledWith({
      content: 'endpoint memory',
      layer: 'project',
      dimension: 'character',
      entityId: 'hero-endpoint',
      validFrom: '2026-04-01T00:00:00Z',
      validUntil: '2026-08-01T00:00:00Z',
      userId: 'user-endpoint',
      projectId: 'project-endpoint',
      sessionId: 'session-endpoint',
      importance: 0.77,
      confidence: 0.66,
      source: 'endpoint-import',
      tags: ['phase4', 'endpoint'],
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'mem-endpoint', status: 'created' });
  });
});
