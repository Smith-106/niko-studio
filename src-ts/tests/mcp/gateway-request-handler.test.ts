import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { HttpRequest, HttpResponse } from '../../mcp/http-types';
import type { GatewayRoute } from '../../mcp/gateway-route-types';

const recordRequestMetricsMock = vi.fn();

vi.mock('../../mcp/metrics', () => ({
  recordRequestMetrics: recordRequestMetricsMock,
}));

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

function buildRoute(method: string, pattern: RegExp, handler: (request: HttpRequest) => HttpResponse): GatewayRoute {
  return {
    method,
    pattern,
    handler: (req) => Promise.resolve(handler(req)),
    paramNames: [],
  };
}

describe('gateway-request-handler', () => {
  let routes: GatewayRoute[];

  beforeEach(() => {
    recordRequestMetricsMock.mockReset();
    routes = [
      buildRoute('GET', /^\/health$/, () => ({ statusCode: 200, body: { status: 'ok' } })),
      buildRoute('POST', /^\/chat$/, (request) => ({
        statusCode: 200,
        body: { reply: `echo:${String((request.body as Record<string, unknown>)?.message ?? '')}` },
      })),
      buildRoute('POST', /^\/admin\/services\/([^/]+)$/, (request) => ({
        statusCode: 200,
        body: { updated: request.body },
      })),
    ];
  });

  it('routes a matching GET request to the correct handler', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'GET', url: '/health' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
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

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
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

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(204);
    expect(recordRequestMetricsMock).not.toHaveBeenCalled();
  });

  it('parses JSON body for POST requests', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/chat' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'data') (callback as (chunk: unknown) => void)('{"message":"hello"}');
      if (_event === 'end') (callback as () => void)();
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

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'data') (callback as (chunk: unknown) => void)('not-json');
      if (_event === 'end') (callback as () => void)();
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

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
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

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(200);
  });

  it('injects trace context and records request metrics for successful requests', async () => {
    const traceCollector = vi.fn((request: HttpRequest) => ({
      statusCode: 201,
      body: {
        traceContext: request.traceContext,
      },
    }));
    routes = [
      {
        method: 'POST',
        pattern: /^\/trace$/,
        paramNames: [],
        handler: (request) => Promise.resolve(traceCollector(request)),
      },
    ];

    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/trace' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    const before = Date.now();
    await handler(req, res);

    expect(captured.statusCode).toBe(201);
    expect(traceCollector).toHaveBeenCalledTimes(1);

    const responseBody = JSON.parse(captured.body) as { traceContext?: HttpRequest['traceContext'] };
    const traceContext = responseBody.traceContext;
    expect(traceContext).toMatchObject({
      route: '^\\/trace$',
      method: 'POST',
    });
    expect(typeof traceContext?.requestId).toBe('string');
    expect(traceContext?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof traceContext?.startAtMs).toBe('number');
    expect((traceContext?.startAtMs ?? 0) >= before).toBe(true);

    expect(recordRequestMetricsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        route: '^\\/trace$',
        method: 'POST',
        statusCode: 201,
      }),
    );
    const metricsPayload = recordRequestMetricsMock.mock.calls.at(-1)?.[0] as { latencyMs?: number } | undefined;
    expect(typeof metricsPayload?.latencyMs).toBe('number');
    expect((metricsPayload?.latencyMs ?? -1) >= 0).toBe(true);
  });

  it('records 404 metrics using request path when route is not matched', async () => {
    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'GET', url: '/missing-route' });
    const { res } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(recordRequestMetricsMock).toHaveBeenCalledWith({
      route: '/missing-route',
      method: 'GET',
      statusCode: 404,
      latencyMs: 0,
    });
  });

  it('records 500 metrics for handler failures with route pattern dimensions', async () => {
    routes = [
      {
        method: 'POST',
        pattern: /^\/explode$/,
        paramNames: [],
        handler: () => {
          throw new Error('boom');
        },
      },
    ];

    const handler = createGatewayRequestHandler(routes);
    const req = createMockIncoming({ method: 'POST', url: '/explode' });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(captured.statusCode).toBe(500);
    expect(recordRequestMetricsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        route: '^\\/explode$',
        method: 'POST',
        statusCode: 500,
      }),
    );
    const metricsPayload = recordRequestMetricsMock.mock.calls.at(-1)?.[0] as { latencyMs?: number } | undefined;
    expect(typeof metricsPayload?.latencyMs).toBe('number');
    expect((metricsPayload?.latencyMs ?? -1) >= 0).toBe(true);
  });
});

