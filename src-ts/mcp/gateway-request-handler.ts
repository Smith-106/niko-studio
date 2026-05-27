import type { IncomingMessage, ServerResponse } from 'node:http';

import type { GatewayRoute } from './gateway-route-types';
import { recordRequestMetrics } from './metrics';
import {
  addCorsHeaders,
  extractPath,
  parseQuery,
  readRequestBody,
  sendHttpResponse,
  toHttpRequest,
} from './gateway-http-adapter';
import { matchGatewayRoute } from './routes';
import { InMemoryRateLimiter } from './rate-limiter';
import { createLogger } from '../logger';

const log = createLogger('gateway');
const rateLimiter = new InMemoryRateLimiter(60);
rateLimiter.start();

const DEFAULT_RATE_LIMIT = 120;
const DEFAULT_RATE_WINDOW_SECONDS = 60;

// 轻量级请求 ID 生成器，替代 randomUUID() 降低开销
let _requestCounter = 0;
function lightweightRequestId(): string {
  return Date.now().toString(36) + '-' + (++_requestCounter);
}

/** SSE 流式路径下的内部 chunk 不需要 trace ID */
function isSSEStreamChunk(path: string): boolean {
  return path.includes('/stream') || path.includes('/chunk') || path.includes('/events');
}

export function createGatewayRequestHandler(routes: readonly GatewayRoute[]): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    addCorsHeaders(req, res);

    // In-memory rate limiting (applies regardless of Redis availability)
    const clientKey = req.socket.remoteAddress ?? 'unknown';
    const routeKey = `${clientKey}:${extractPath(req.url ?? '/')}`;
    if (!rateLimiter.allow(routeKey, DEFAULT_RATE_LIMIT, DEFAULT_RATE_WINDOW_SECONDS)) {
      log.warn('Rate limit exceeded', { client: clientKey, path: extractPath(req.url ?? '/'), retryAfter: DEFAULT_RATE_WINDOW_SECONDS });
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests', retryAfter: DEFAULT_RATE_WINDOW_SECONDS }));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const path = extractPath(req.url ?? '/');
    const query = parseQuery(req.url ?? '/');
    const method = (req.method ?? 'GET').toUpperCase();
    const matched = matchGatewayRoute(method, path, routes);

    if (!matched) {
      log.warn('Route not found', { method, path });
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path }));
      recordRequestMetrics({
        route: path,
        method,
        statusCode: 404,
        latencyMs: 0,
      });
      return;
    }

    const startedAt = Date.now();
    const routePattern = matched.route.pattern.source;
    // SSE 流式内部 chunk 不需要 trace ID，仅外部请求生成轻量级 ID
    const requestId = isSSEStreamChunk(path) ? undefined : lightweightRequestId();

    try {
      let body: unknown;
      if (method !== 'GET' && method !== 'HEAD') {
        const raw = await readRequestBody(req);
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
        }
      }

      const httpRequest = toHttpRequest(req, body, query, matched.params);
      // SSE 流式请求跳过 traceContext（内部 chunk 不需要追踪）
      if (requestId) {
        httpRequest.traceContext = {
          requestId,
          route: routePattern,
          method,
          startAtMs: startedAt,
        };
      }
      const httpResponse = await matched.route.handler(httpRequest);
      sendHttpResponse(res, httpResponse);
      recordRequestMetrics({
        route: routePattern,
        method,
        statusCode: httpResponse.statusCode,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      log.error('Request handler error', {
        method,
        path,
        route: routePattern,
        requestId: requestId ?? 'no-trace',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        latencyMs: Date.now() - startedAt,
      });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Internal server error',
        }),
      );
      recordRequestMetrics({
        route: routePattern,
        method,
        statusCode: 500,
        latencyMs: Date.now() - startedAt,
      });
    }
  };
}
