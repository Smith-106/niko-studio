/**
 * Sync MCP Endpoints — push/pull/status for cloud data synchronization.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

let syncStatus = { lastSyncAt: 0, isConfigured: false };

export async function syncStatusEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  return jsonResponse({
    success: true,
    data: {
      lastSyncAt: syncStatus.lastSyncAt,
      isConfigured: syncStatus.isConfigured,
    },
  });
}

export async function syncPushEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as {
    keys?: string[];
    remoteUrl?: string;
    authToken?: string;
  };

  if (!body.remoteUrl) {
    return jsonResponse({ success: false, error: 'remoteUrl is required' }, 400);
  }

  try {
    const { SyncEngine } = await import('../../sync/sync-engine');
    const { LocalStorageAdapter } = await import('../../sync/storage-adapter');
    const { RemoteStorageAdapter } = await import('../../sync/storage-adapter');

    const local = new LocalStorageAdapter();
    const remote = new RemoteStorageAdapter(body.remoteUrl, body.authToken);
    const engine = new SyncEngine(local, remote);

    const result = await engine.push(body.keys);
    syncStatus = { lastSyncAt: result.timestamp, isConfigured: true };

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: `Sync push failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, 500);
  }
}

export async function syncPullEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as {
    keys?: string[];
    remoteUrl?: string;
    authToken?: string;
  };

  if (!body.remoteUrl) {
    return jsonResponse({ success: false, error: 'remoteUrl is required' }, 400);
  }

  try {
    const { SyncEngine } = await import('../../sync/sync-engine');
    const { LocalStorageAdapter } = await import('../../sync/storage-adapter');
    const { RemoteStorageAdapter } = await import('../../sync/storage-adapter');

    const local = new LocalStorageAdapter();
    const remote = new RemoteStorageAdapter(body.remoteUrl, body.authToken);
    const engine = new SyncEngine(local, remote);

    const result = await engine.pull(body.keys);
    syncStatus = { lastSyncAt: result.timestamp, isConfigured: true };

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: `Sync pull failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, 500);
  }
}

export async function syncFullEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as {
    remoteUrl?: string;
    authToken?: string;
  };

  if (!body.remoteUrl) {
    return jsonResponse({ success: false, error: 'remoteUrl is required' }, 400);
  }

  try {
    const { SyncEngine } = await import('../../sync/sync-engine');
    const { LocalStorageAdapter } = await import('../../sync/storage-adapter');
    const { RemoteStorageAdapter } = await import('../../sync/storage-adapter');

    const local = new LocalStorageAdapter();
    const remote = new RemoteStorageAdapter(body.remoteUrl, body.authToken);
    const engine = new SyncEngine(local, remote);

    const result = await engine.syncFull();
    syncStatus = { lastSyncAt: result.timestamp, isConfigured: true };

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: `Sync full failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, 500);
  }
}
