/**
 * Sync MCP Endpoints — push/pull/status for cloud data synchronization.
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

let syncStatus = { lastSyncAt: 0, isConfigured: false };

/**
 * Validate remoteUrl to prevent SSRF attacks.
 * Rejects private/internal IP ranges, localhost, and link-local addresses.
 */
function validateRemoteUrl(remoteUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(remoteUrl);
  } catch {
    return 'Invalid URL format';
  }

  // Only allow http/https schemes
  const scheme = url.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    return 'URL must use http or https scheme';
  }

  const host = url.hostname.toLowerCase();

  // Reject localhost variants
  if (host === 'localhost' || host === '::1' || host === '0:0:0:0:0:0:0:1') {
    return 'Localhost URLs are not allowed';
  }

  // Reject IPv4 private ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const octets = [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10), parseInt(match[4], 10)];

    // Validate octet ranges
    if (octets.some(o => o > 255)) {
      return 'Invalid IP address';
    }

    const [a, b] = octets;

    // 127.0.0.0/8 - Loopback
    if (a === 127) {
      return 'Loopback addresses are not allowed';
    }
    // 10.0.0.0/8 - Private Class A
    if (a === 10) {
      return 'Private IP addresses (10.0.0.0/8) are not allowed';
    }
    // 172.16.0.0/12 - Private Class B
    if (a === 172 && b >= 16 && b <= 31) {
      return 'Private IP addresses (172.16.0.0/12) are not allowed';
    }
    // 192.168.0.0/16 - Private Class C
    if (a === 192 && b === 168) {
      return 'Private IP addresses (192.168.0.0/16) are not allowed';
    }
    // 169.254.0.0/16 - Link-local
    if (a === 169 && b === 254) {
      return 'Link-local addresses (169.254.0.0/16) are not allowed';
    }
    // 0.0.0.0/8 - Current network
    if (a === 0) {
      return '0.0.0.0/8 addresses are not allowed';
    }
    // 224.0.0.0/4 - Multicast
    if (a >= 224 && a <= 239) {
      return 'Multicast addresses are not allowed';
    }
    // 240.0.0.0/4 - Reserved
    if (a >= 240) {
      return 'Reserved IP addresses are not allowed';
    }
  }

  // Reject IPv6 private/link-local ranges (simplified check)
  if (host.startsWith('fc') || host.startsWith('fd')) {
    return 'IPv6 unique local addresses are not allowed';
  }
  if (host.startsWith('fe80:')) {
    return 'IPv6 link-local addresses are not allowed';
  }
  if (host === '::' || host === '0:0:0:0:0:0:0:0') {
    return 'IPv6 unspecified address is not allowed';
  }

  return null; // Valid
}

export async function syncStatusEndpoint(_request: HttpRequest): Promise<HttpResponse> {
  return jsonResponse({
    lastSyncAt: syncStatus.lastSyncAt,
    isConfigured: syncStatus.isConfigured,
  });
}

export async function syncPushEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as {
    keys?: string[];
    remoteUrl?: string;
    authToken?: string;
  };

  if (!body.remoteUrl) {
    return jsonResponse({ error: 'remoteUrl is required' }, 400);
  }

  // SSRF protection: reject private/internal IP ranges
  const urlError = validateRemoteUrl(body.remoteUrl);
  if (urlError) {
    return jsonResponse({ error: urlError }, 400);
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

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({
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
    return jsonResponse({ error: 'remoteUrl is required' }, 400);
  }

  // SSRF protection: reject private/internal IP ranges
  const urlError = validateRemoteUrl(body.remoteUrl);
  if (urlError) {
    return jsonResponse({ error: urlError }, 400);
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

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({
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
    return jsonResponse({ error: 'remoteUrl is required' }, 400);
  }

  // SSRF protection: reject private/internal IP ranges
  const urlError = validateRemoteUrl(body.remoteUrl);
  if (urlError) {
    return jsonResponse({ error: urlError }, 400);
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

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({
      error: `Sync full failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }, 500);
  }
}
