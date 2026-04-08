import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from './http-types';

const memoryAddMock = vi.fn();
const memorySearchMock = vi.fn();
const memoryGetTemporalMock = vi.fn();

vi.mock('./services/memory', () => ({
  memoryAdd: memoryAddMock,
  memorySearch: memorySearchMock,
  memoryGetTemporal: memoryGetTemporalMock,
}));

function makeRequest(body: Record<string, unknown>, url = '/memory/add'): HttpRequest {
  return {
    method: 'POST',
    url,
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

  const workspace = {
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
  };

  it('keeps generic memory writes generic when entity_id is omitted', async () => {
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-workspace', status: 'created' });

    const { memoryAddEndpoint } = await import('./endpoints/memory.js');

    const response = await memoryAddEndpoint(
      makeRequest({
        content: 'workspace-derived memory',
        workspace,
      }),
    );

    expect(memoryAddMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'workspace-derived memory',
      projectId: 'atlas-project',
      sessionId: 'workflow-session-3',
      entityId: undefined,
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ id: 'mem-workspace', status: 'created' });
  });

  it('allows callers to opt into the focused entity explicitly', async () => {
    memoryAddMock.mockResolvedValueOnce({ id: 'mem-focus', status: 'created' });

    const { memoryAddEndpoint } = await import('./endpoints/memory.js');

    await memoryAddEndpoint(
      makeRequest({
        content: 'entity memory',
        use_focus_entity: true,
        workspace,
      }),
    );

    expect(memoryAddMock).toHaveBeenCalledWith(expect.objectContaining({
      content: 'entity memory',
      projectId: 'atlas-project',
      sessionId: 'workflow-session-3',
      entityId: 'hero-3',
    }));
  });

  it('keeps workspace-scoped searches generic unless entity scope is explicit', async () => {
    memorySearchMock.mockResolvedValueOnce([]);

    const { memorySearchEndpoint } = await import('./endpoints/memory.js');

    await memorySearchEndpoint(
      makeRequest(
        {
          query: 'plot outline',
          workspace,
        },
        '/memory/search',
      ),
    );

    expect(memorySearchMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'plot outline',
      projectId: 'atlas-project',
      sessionId: 'workflow-session-3',
      entityId: undefined,
    }));
  });

  it('keeps temporal lookups explicit while still deriving project and session scope', async () => {
    memoryGetTemporalMock.mockResolvedValueOnce([]);

    const { memoryTemporalEndpoint } = await import('./endpoints/memory.js');

    await memoryTemporalEndpoint(
      makeRequest(
        {
          entity_id: 'hero-9',
          at_time: '2026-04-08T00:00:00Z',
          workspace,
        },
        '/memory/temporal',
      ),
    );

    expect(memoryGetTemporalMock).toHaveBeenCalledWith(
      'hero-9',
      '2026-04-08T00:00:00Z',
      expect.objectContaining({
        projectId: 'atlas-project',
        sessionId: 'workflow-session-3',
      }),
    );
  });
});
