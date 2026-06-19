import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/sync',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

async function loadSyncEndpoints() {
  const pushMock = vi.fn();
  const pullMock = vi.fn();
  const syncFullMock = vi.fn();
  const localCtor = vi.fn();
  const remoteCtor = vi.fn();
  const engineCtor = vi.fn();

  vi.resetModules();
  vi.doMock('../../sync/storage-adapter', () => ({
    LocalStorageAdapter: vi.fn().mockImplementation(function LocalStorageAdapter(this: Record<string, unknown>) {
      localCtor();
      Object.assign(this, { type: 'local' });
    }),
    RemoteStorageAdapter: vi.fn().mockImplementation(function RemoteStorageAdapter(
      this: Record<string, unknown>,
      remoteUrl: string,
      authToken?: string,
    ) {
      remoteCtor(remoteUrl, authToken);
      Object.assign(this, { type: 'remote', remoteUrl, authToken });
    }),
  }));
  vi.doMock('../../sync/sync-engine', () => ({
    SyncEngine: vi.fn().mockImplementation(function SyncEngine(
      this: Record<string, unknown>,
      local: unknown,
      remote: unknown,
    ) {
      engineCtor(local, remote);
      Object.assign(this, {
        push: pushMock,
        pull: pullMock,
        syncFull: syncFullMock,
      });
    }),
  }));

  const mod = await import('../../mcp/endpoints/sync.js');
  return {
    ...mod,
    pushMock,
    pullMock,
    syncFullMock,
    localCtor,
    remoteCtor,
    engineCtor,
  };
}

describe('sync endpoints additional coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../sync/storage-adapter');
    vi.doUnmock('../../sync/sync-engine');
  });

  it.each([
    ['not-a-url', 'Invalid URL format'],
    ['ftp://example.com', 'URL must use http or https scheme'],
    ['http://localhost:8080', 'Localhost URLs are not allowed'],
    ['http://256.1.1.1', 'Invalid URL format'],
    ['http://127.0.0.1', 'Loopback addresses are not allowed'],
    ['http://10.0.0.2', 'Private IP addresses (10.0.0.0/8) are not allowed'],
    ['http://172.20.0.3', 'Private IP addresses (172.16.0.0/12) are not allowed'],
    ['http://192.168.1.8', 'Private IP addresses (192.168.0.0/16) are not allowed'],
    ['http://169.254.1.1', 'Link-local addresses (169.254.0.0/16) are not allowed'],
    ['http://0.1.2.3', '0.0.0.0/8 addresses are not allowed'],
    ['http://224.1.2.3', 'Multicast addresses are not allowed'],
    ['http://250.1.2.3', 'Reserved IP addresses are not allowed'],
    ['http://[::1]', 'Localhost URLs are not allowed'],
    ['http://[fc00::1]', 'IPv6 unique local addresses are not allowed'],
    ['http://[fe80::1]', 'IPv6 link-local addresses are not allowed'],
    ['http://[::]', 'IPv6 unspecified address is not allowed'],
  ])('rejects unsafe remote URL %s', async (remoteUrl, error) => {
    vi.resetModules();
    const { syncPushEndpoint } = await import('../../mcp/endpoints/sync.js');

    const response = await syncPushEndpoint(makeRequest({ remoteUrl }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error });
  });

  it('rejects unsafe remote URLs for pull and full sync flows', async () => {
    vi.resetModules();
    const { syncPullEndpoint, syncFullEndpoint } = await import('../../mcp/endpoints/sync.js');

    const pullResponse = await syncPullEndpoint(makeRequest({
      remoteUrl: 'http://127.0.0.1',
    }));
    expect(pullResponse.statusCode).toBe(400);
    expect(pullResponse.body).toEqual({
      error: 'Loopback addresses are not allowed',
    });

    const fullResponse = await syncFullEndpoint(makeRequest({
      remoteUrl: 'http://[::1]',
    }));
    expect(fullResponse.statusCode).toBe(400);
    expect(fullResponse.body).toEqual({
      error: 'Localhost URLs are not allowed',
    });
  });

  it('rejects dotted-quad hosts whose octets exceed the IPv4 range', async () => {
    vi.resetModules();
    const originalUrl = globalThis.URL;

    class MockUrl {
      protocol = 'http:';
      hostname = '256.1.1.1';
    }

    Object.defineProperty(globalThis, 'URL', {
      value: MockUrl,
      configurable: true,
      writable: true,
    });

    try {
      const { syncPushEndpoint } = await import('../../mcp/endpoints/sync.js');

      const response = await syncPushEndpoint(makeRequest({
        remoteUrl: 'http://example.com',
      }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid IP address',
      });
    } finally {
      Object.defineProperty(globalThis, 'URL', {
        value: originalUrl,
        configurable: true,
        writable: true,
      });
    }
  });

  it('pushes selected keys, wires adapters, and updates status', async () => {
    const {
      syncPushEndpoint,
      syncStatusEndpoint,
      pushMock,
      localCtor,
      remoteCtor,
      engineCtor,
    } = await loadSyncEndpoints();
    pushMock.mockResolvedValueOnce({
      pushed: 2,
      pulled: 0,
      conflicts: 0,
      changes: [],
      timestamp: 1710001234567,
    });

    const response = await syncPushEndpoint(makeRequest({
      remoteUrl: 'https://sync.example.com',
      authToken: 'secret-token',
      keys: ['draft-1', 'draft-2'],
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      pushed: 2,
      pulled: 0,
      conflicts: 0,
      timestamp: 1710001234567,
    });
    expect(localCtor).toHaveBeenCalledTimes(1);
    expect(remoteCtor).toHaveBeenCalledWith('https://sync.example.com', 'secret-token');
    expect(engineCtor).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(['draft-1', 'draft-2']);

    const status = await syncStatusEndpoint(makeRequest({}));
    expect(status.body).toEqual({
      lastSyncAt: 1710001234567,
      isConfigured: true,
    });
  });

  it('returns a structured 500 when push fails', async () => {
    const { syncPushEndpoint, pushMock } = await loadSyncEndpoints();
    pushMock.mockRejectedValueOnce(new Error('push exploded'));

    const response = await syncPushEndpoint(makeRequest({
      remoteUrl: 'https://sync.example.com',
    }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'Sync push failed: push exploded',
    });
  });

  it('pulls selected keys and preserves configured status', async () => {
    const {
      syncPullEndpoint,
      syncStatusEndpoint,
      pullMock,
      remoteCtor,
    } = await loadSyncEndpoints();
    pullMock.mockResolvedValueOnce({
      pushed: 0,
      pulled: 3,
      conflicts: 1,
      changes: [],
      timestamp: 1710007654321,
    });

    const response = await syncPullEndpoint(makeRequest({
      remoteUrl: 'https://remote.example.com',
      authToken: 'pull-token',
      keys: ['outline'],
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      pulled: 3,
      conflicts: 1,
      timestamp: 1710007654321,
    });
    expect(remoteCtor).toHaveBeenCalledWith('https://remote.example.com', 'pull-token');
    expect(pullMock).toHaveBeenCalledWith(['outline']);

    const status = await syncStatusEndpoint(makeRequest({}));
    expect(status.body).toEqual({
      lastSyncAt: 1710007654321,
      isConfigured: true,
    });
  });

  it('returns a structured 500 when pull fails', async () => {
    const { syncPullEndpoint, pullMock } = await loadSyncEndpoints();
    pullMock.mockRejectedValueOnce(new Error('pull exploded'));

    const response = await syncPullEndpoint(makeRequest({
      remoteUrl: 'https://remote.example.com',
    }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: 'Sync pull failed: pull exploded',
    });
  });

  it('runs full sync and normalizes unknown failures', async () => {
    const { syncFullEndpoint, syncFullMock } = await loadSyncEndpoints();
    syncFullMock.mockResolvedValueOnce({
      pushed: 1,
      pulled: 4,
      conflicts: 2,
      changes: [],
      timestamp: 1710011111111,
    });

    const success = await syncFullEndpoint(makeRequest({
      remoteUrl: 'https://bidirectional.example.com',
      authToken: 'full-token',
    }));

    expect(success.statusCode).toBe(200);
    expect(success.body).toMatchObject({
      pushed: 1,
      pulled: 4,
      conflicts: 2,
      timestamp: 1710011111111,
    });
    expect(syncFullMock).toHaveBeenCalledTimes(1);

    syncFullMock.mockRejectedValueOnce('string failure');
    const failure = await syncFullEndpoint(makeRequest({
      remoteUrl: 'https://bidirectional.example.com',
    }));

    expect(failure.statusCode).toBe(500);
    expect(failure.body).toEqual({
      error: 'Sync full failed: Unknown error',
    });
  });
});
