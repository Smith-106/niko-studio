import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/sync/test',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

async function loadSyncModule(options?: {
  pushImpl?: () => Promise<unknown>;
  pullImpl?: () => Promise<unknown>;
  fullImpl?: () => Promise<unknown>;
}) {
  vi.resetModules();

  const pushMock = vi.fn(options?.pushImpl);
  const pullMock = vi.fn(options?.pullImpl);
  const syncFullMock = vi.fn(options?.fullImpl);

  vi.doMock('../../sync/sync-engine', () => ({
    SyncEngine: vi.fn().mockImplementation(() => ({
      push: pushMock,
      pull: pullMock,
      syncFull: syncFullMock,
    })),
  }));

  vi.doMock('../../sync/storage-adapter', () => ({
    LocalStorageAdapter: vi.fn().mockImplementation(() => ({})),
    RemoteStorageAdapter: vi.fn().mockImplementation(() => ({})),
  }));

  const mod = await import('../../mcp/endpoints/sync.js');
  return { ...mod, pushMock, pullMock, syncFullMock };
}

describe('Sync MCP Endpoints branch-gap coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('formats push failures from both Error and non-Error throws', async () => {
    const { syncPushEndpoint, pushMock } = await loadSyncModule();
    pushMock
      .mockRejectedValueOnce(new Error('push boom'))
      .mockRejectedValueOnce('string failure');

    const errorResponse = await syncPushEndpoint(makeRequest({
      remoteUrl: 'https://example.com/push',
    }));
    expect(errorResponse.statusCode).toBe(500);
    expect(errorResponse.body).toEqual({ error: 'Sync push failed: push boom' });

    const stringResponse = await syncPushEndpoint(makeRequest({
      remoteUrl: 'https://example.com/push',
    }));
    expect(stringResponse.statusCode).toBe(500);
    expect(stringResponse.body).toEqual({ error: 'Sync push failed: Unknown error' });
  });

  it('formats pull failures from both Error and non-Error throws', async () => {
    const { syncPullEndpoint, pullMock } = await loadSyncModule();
    pullMock
      .mockRejectedValueOnce(new Error('pull boom'))
      .mockRejectedValueOnce({ bad: true });

    const errorResponse = await syncPullEndpoint(makeRequest({
      remoteUrl: 'https://example.com/pull',
    }));
    expect(errorResponse.statusCode).toBe(500);
    expect(errorResponse.body).toEqual({ error: 'Sync pull failed: pull boom' });

    const otherResponse = await syncPullEndpoint(makeRequest({
      remoteUrl: 'https://example.com/pull',
    }));
    expect(otherResponse.statusCode).toBe(500);
    expect(otherResponse.body).toEqual({ error: 'Sync pull failed: Unknown error' });
  });

  it('formats full-sync failures from both Error and non-Error throws', async () => {
    const { syncFullEndpoint, syncFullMock } = await loadSyncModule();
    syncFullMock
      .mockRejectedValueOnce(new Error('full boom'))
      .mockRejectedValueOnce(123);

    const errorResponse = await syncFullEndpoint(makeRequest({
      remoteUrl: 'https://example.com/full',
    }));
    expect(errorResponse.statusCode).toBe(500);
    expect(errorResponse.body).toEqual({ error: 'Sync full failed: full boom' });

    const otherResponse = await syncFullEndpoint(makeRequest({
      remoteUrl: 'https://example.com/full',
    }));
    expect(otherResponse.statusCode).toBe(500);
    expect(otherResponse.body).toEqual({ error: 'Sync full failed: Unknown error' });
  });
});
