import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpResponse } from '../../mcp/http-types';
import type { GatewayRoute } from '../../mcp/gateway-route-types';

const { createGatewayRequestHandler } = await import('../../mcp/gateway-request-handler');

function createMockIncoming(partial: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    on: vi.fn(),
    ...partial,
  } as unknown as IncomingMessage;
}

function createMockServerResponse(): {
  res: ServerResponse;
  captured: { statusCode?: number; headers: Record<string, string | number>; body: string };
} {
  const captured: { statusCode?: number; headers: Record<string, string | number>; body: string } = {
    headers: {},
    body: '',
  };

  const res = {
    writeHead: vi.fn((statusCode: number, headers: Record<string, string | number>) => {
      captured.statusCode = statusCode;
      Object.assign(captured.headers, headers);
    }),
    end: vi.fn((data?: unknown) => {
      captured.body = String(data ?? '');
    }),
    setHeader: vi.fn((key: string, value: string | number) => {
      captured.headers[key] = value;
    }),
  } as unknown as ServerResponse;

  return { res, captured };
}

function buildRoute(method: string, pattern: RegExp, handler: (body: Record<string, unknown>) => HttpResponse): GatewayRoute {
  return {
    method,
    pattern,
    handler: (req) => Promise.resolve(handler(req.body as Record<string, unknown>)),
    paramNames: [],
  };
}

describe('gateway-request-handler', () => {
  let routes: GatewayRoute[];

  beforeEach(() => {
    routes = [
      buildRoute('GET', /^\/health$/, () => ({ statusCode: 200, body: { status: 'ok' } })),
      buildRoute('POST', /^\/chat$/, (body) => ({
        statusCode: 200,
        body: { reply: `echo:${String(body.message ?? '')}` },
      })),
      buildRoute('POST', /^\/admin\/services\/([^/]+)$/, (body) => ({
        statusCode: 200,
        body: { updated: body },
      })),
    ];
  });

  it('routes a matching GET request to the correct handler', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'GET', url: '/health' });
    const { res, captured } = createMockServerResponse();

    // Stub req.on for OPTIONS passthrough
    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(200);
    expect(JSON.parse(captured.body)).toEqual({ status: 'ok' });
  });

  it('returns 404 for an unmatched route', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'GET', url: '/nonexistent' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(404);
    expect(JSON.parse(captured.body)).toMatchObject({ error: 'Not found', path: '/nonexistent' });
  });

  it('returns 204 for OPTIONS preflight requests', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'OPTIONS', url: '/chat' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(204);
  });

  it('parses JSON body for POST requests', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/chat' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'data') (handler as (chunk: unknown) => void)('{"message":"hello"}');
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(200);
    expect(JSON.parse(captured.body)).toEqual({ reply: 'echo:hello' });
  });

  it('handles invalid JSON body gracefully (keeps as string)', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/chat' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'data') (handler as (chunk: unknown) => void)('not-json');
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(200);
  });

  it('returns 500 with error message when a handler throws', async () => {
    routes.push(
      buildRoute('POST', /^\/fail$/, () => {
        throw new Error('handler exploded');
      }),
    );

    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/fail' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(500);
    const parsed = JSON.parse(captured.body);
    expect(parsed).toMatchObject({
      error: 'Internal server error',
      message: 'handler exploded',
    });
  });

  it('extracts route params for parameterized routes', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/admin/services/my-svc' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(200);
  });

  it('skips body parsing for GET requests', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'GET', url: '/health' });
    const { res, captured } = createMockServerResponse();

    // Ensure no 'data' event is listened for on GET
    const onSpy = vi.spyOn(req, 'on').mockImplementation((_event, handler) => {
      if (_event === 'end') (handler as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(200);
    // The data listener should not have been called for GET
    const dataCalls = onSpy.mock.calls.filter(([event]) => event === 'data');
    expect(dataCalls).toHaveLength(0);
  });
});
