import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfigManager, setConfigValue } from '../../config';
import { addCorsHeaders } from '../../mcp/gateway-http-adapter';
import { buildConfigAccess } from '../../mcp/gateway-state';
import type { IncomingMessage, ServerResponse } from 'node:http';

function createMockReq(origin: string): IncomingMessage {
  return {
    method: 'GET',
    url: '/',
    headers: { origin },
    on: vi.fn(),
  } as unknown as IncomingMessage;
}

function createMockRes(): { res: ServerResponse; calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {};
  const res = {
    setHeader: vi.fn((...args: unknown[]) => {
      calls['setHeader'] = calls['setHeader'] ?? [];
      calls['setHeader'].push(args);
    }),
    writeHead: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse;
  return { res, calls };
}

function hasAllowOrigin(calls: Record<string, unknown[]>, value: string): boolean {
  const setHeaderCalls = calls['setHeader'] ?? [];
  return setHeaderCalls.some(([key, headerValue]) => key === 'Access-Control-Allow-Origin' && headerValue === value);
}

afterEach(() => {
  ConfigManager.resetInstance();
  delete process.env.NIKO_ENV;
  delete process.env.NIKO_CORS_DEV_ORIGINS;
  delete process.env.NIKO_CORS_PROD_ORIGINS;
});

describe('gateway cors reload', () => {
  it('applies config reload to subsequent CORS decisions', () => {
    process.env.NIKO_ENV = 'development';

    setConfigValue('gateway.corsDevOrigins', ['http://allowed-before.local']);

    const access = buildConfigAccess();

    const beforeReq = createMockReq('http://allowed-before.local');
    const beforeRes = createMockRes();
    addCorsHeaders(beforeReq, beforeRes.res);
    expect(hasAllowOrigin(beforeRes.calls, 'http://allowed-before.local')).toBe(true);

    setConfigValue('gateway.corsDevOrigins', ['http://allowed-after.local']);
    access.reloadConfig();

    const afterAllowReq = createMockReq('http://allowed-after.local');
    const afterAllowRes = createMockRes();
    addCorsHeaders(afterAllowReq, afterAllowRes.res);
    expect(hasAllowOrigin(afterAllowRes.calls, 'http://allowed-after.local')).toBe(true);

    const afterDenyReq = createMockReq('http://allowed-before.local');
    const afterDenyRes = createMockRes();
    addCorsHeaders(afterDenyReq, afterDenyRes.res);
    expect(hasAllowOrigin(afterDenyRes.calls, 'http://allowed-before.local')).toBe(false);
  });
});
