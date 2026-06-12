import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GatewayRoute } from '../../mcp/gateway-route-types';
import type { HttpRequest, HttpResponse } from '../../mcp/http-types';

function createMockIncoming(partial: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
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
    writeHead: vi.fn((statusCode: number, headers?: Record<string, string | number>) => {
      captured.statusCode = statusCode;
      if (headers) {
        Object.assign(captured.headers, headers);
      }
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

function buildRoute(
  method: string,
  pattern: RegExp,
  handler: (request: HttpRequest) => HttpResponse | Promise<HttpResponse>,
): GatewayRoute {
  return {
    method,
    pattern,
    handler: (request) => Promise.resolve(handler(request)),
    paramNames: [],
  };
}

async function loadHandler(allowReturn: boolean = true) {
  vi.resetModules();

  const recordRequestMetricsMock = vi.fn();
  const allowMock = vi.fn().mockReturnValue(allowReturn);
  const startMock = vi.fn();
  const warnMock = vi.fn();
  const errorMock = vi.fn();
  const debugMock = vi.fn();
  const infoMock = vi.fn();

  vi.doMock('../../mcp/metrics', () => ({
    recordRequestMetrics: recordRequestMetricsMock,
  }));

  vi.doMock('../../logger/index.js', () => ({
    createLogger: () => ({
      debug: debugMock,
      info: infoMock,
      warn: warnMock,
      error: errorMock,
      child: vi.fn(),
    }),
  }));

  vi.doMock('../../mcp/rate-limiter', () => ({
    InMemoryRateLimiter: class {
      start = startMock;
      allow = allowMock;
    },
  }));

  const { createGatewayRequestHandler } = await import('../../mcp/gateway-request-handler');

  return {
    createGatewayRequestHandler,
    mocks: {
      allowMock,
      startMock,
      recordRequestMetricsMock,
      warnMock,
      errorMock,
      debugMock,
      infoMock,
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock('../../mcp/metrics');
  vi.doUnmock('../../logger/index.js');
  vi.doUnmock('../../mcp/rate-limiter');
});

describe('gateway-request-handler additional coverage', () => {
  it('falls back to unknown client, root path, empty query, and GET when request fields are absent', async () => {
    const { createGatewayRequestHandler, mocks } = await loadHandler(true);
    const requestCollector = vi.fn((request: HttpRequest) => ({
      statusCode: 200,
      body: {
        method: request.method,
        url: request.url,
        query: request.query,
      },
    }));

    const handler = createGatewayRequestHandler([
      buildRoute('GET', /^\/$/, requestCollector),
    ]);
    const req = createMockIncoming({
      method: undefined as never,
      url: undefined as never,
      socket: { remoteAddress: undefined } as never,
    });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(mocks.startMock).toHaveBeenCalledOnce();
    expect(mocks.allowMock).toHaveBeenCalledWith('unknown:/', 120, 60);
    expect(requestCollector).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET',
      url: '/',
      query: {},
    }));
    expect(captured.statusCode).toBe(200);
    expect(JSON.parse(captured.body)).toEqual({
      method: 'GET',
      url: '/',
      query: {},
    });
  });

  it('returns 429 and logs the normalized path when the rate limiter blocks a request', async () => {
    const { createGatewayRequestHandler, mocks } = await loadHandler(false);
    const handler = createGatewayRequestHandler([
      buildRoute('GET', /^\/limited$/, () => ({
        statusCode: 200,
        body: { ok: true },
      })),
    ]);
    const req = createMockIncoming({
      method: 'GET',
      url: '/limited?foo=1',
      socket: { remoteAddress: '10.0.0.5' } as never,
    });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(mocks.allowMock).toHaveBeenCalledWith('10.0.0.5:/limited', 120, 60);
    expect(mocks.warnMock).toHaveBeenCalledWith('Rate limit exceeded', {
      client: '10.0.0.5',
      path: '/limited',
      retryAfter: 60,
    });
    expect(captured.statusCode).toBe(429);
    expect(JSON.parse(captured.body)).toEqual({
      error: 'Too many requests',
      retryAfter: 60,
    });
    expect(mocks.recordRequestMetricsMock).not.toHaveBeenCalled();
  });

  it('falls back to root path in rate-limit logs when the request url is absent', async () => {
    const { createGatewayRequestHandler, mocks } = await loadHandler(false);
    const handler = createGatewayRequestHandler([
      buildRoute('GET', /^\/$/, () => ({
        statusCode: 200,
        body: { ok: true },
      })),
    ]);
    const req = createMockIncoming({
      method: 'GET',
      url: undefined as never,
      socket: { remoteAddress: '10.0.0.6' } as never,
    });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(mocks.allowMock).toHaveBeenCalledWith('10.0.0.6:/', 120, 60);
    expect(mocks.warnMock).toHaveBeenCalledWith('Rate limit exceeded', {
      client: '10.0.0.6',
      path: '/',
      retryAfter: 60,
    });
    expect(captured.statusCode).toBe(429);
  });

  it('skips trace ids for SSE stream requests and stringifies non-Error handler failures', async () => {
    const { createGatewayRequestHandler, mocks } = await loadHandler(true);
    let capturedRequest: HttpRequest | undefined;

    const handler = createGatewayRequestHandler([
      buildRoute('GET', /^\/stream$/, (request) => {
        capturedRequest = request;
        throw 'stream exploded';
      }),
    ]);
    const req = createMockIncoming({
      method: 'GET',
      url: '/stream',
    });
    const { res, captured } = createMockServerResponse();

    vi.spyOn(req, 'on').mockImplementation((_event, callback) => {
      if (_event === 'end') (callback as () => void)();
      return req as unknown as IncomingMessage;
    });

    await handler(req, res);

    expect(capturedRequest?.traceContext).toBeUndefined();
    expect(captured.statusCode).toBe(500);
    expect(JSON.parse(captured.body)).toEqual({
      error: 'Internal server error',
    });
    expect(mocks.errorMock).toHaveBeenCalledWith(
      'Request handler error',
      expect.objectContaining({
        method: 'GET',
        path: '/stream',
        route: '^\\/stream$',
        requestId: 'no-trace',
        error: 'stream exploded',
        stack: undefined,
      }),
    );
    expect(mocks.recordRequestMetricsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        route: '^\\/stream$',
        method: 'GET',
        statusCode: 500,
      }),
    );
  });
});
