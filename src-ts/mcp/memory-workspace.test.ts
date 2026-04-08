import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from './http-types';

const memoryAddMock = vi.fn();

vi.mock('./services/memory', () => ({
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

describe('memory workspace compatibility', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('derives memory scope from authoritative workspace context when legacy ids are absent', async () => {
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-workspace', status: 'created' });

    const { memoryAddEndpoint } = await import('./endpoints/memory.js');

    const response = await memoryAddEndpoint(
      makeRequest({
        content: 'workspace-derived memory',
        workspace: {
          identity: {
            workspaceId: 'atlas-workspace',
            projectId: 'atlas-project',
            projectName: 'atlas-project',
            workspaceRoot: '/tmp/atlas',
          },
          manuscript: {
            chapterId: 'chapter-3',
          },
          knowledge: {
            focusEntityId: 'hero-3',
          },
          workflow: {
            sessionId: 'workflow-session-3',
          },
        },
      }),
    );

    expect(memoryAddMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'workspace-derived memory',
      projectId: 'atlas-project',
      sessionId: 'workflow-session-3',
      entityId: 'hero-3',
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'mem-workspace', status: 'created' });
  });
});
