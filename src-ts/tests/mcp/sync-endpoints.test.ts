import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { HttpRequest } from '../../mcp/http-types.js';

function mockRequest(body: Record<string, unknown>) {
  return { method: 'POST', url: '/sync/push', headers: {}, body, query: {}, params: {} } as any;
}

describe('Sync MCP Endpoints', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('status endpoint returns current state', async () => {
    const { syncStatusEndpoint } = await import('../../mcp/endpoints/sync.js');
    const resp = await syncStatusEndpoint({ method: 'GET', url: '', headers: {}, body: {}, query: {}, params: {} } as any);
    expect(resp.statusCode).toBe(200);
    const body = resp.body as any;
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('lastSyncAt');
    expect(body.data).toHaveProperty('isConfigured');
  });

  it('push returns 400 without remoteUrl', async () => {
    const { syncPushEndpoint } = await import('../../mcp/endpoints/sync.js');
    const resp = await syncPushEndpoint(mockRequest({}));
    expect(resp.statusCode).toBe(400);
  });

  it('pull returns 400 without remoteUrl', async () => {
    const { syncPullEndpoint } = await import('../../mcp/endpoints/sync.js');
    const resp = await syncPullEndpoint(mockRequest({}));
    expect(resp.statusCode).toBe(400);
  });

  it('full sync returns 400 without remoteUrl', async () => {
    const { syncFullEndpoint } = await import('../../mcp/endpoints/sync.js');
    const resp = await syncFullEndpoint(mockRequest({}));
    expect(resp.statusCode).toBe(400);
  });
});
