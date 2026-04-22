import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

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

export function createGatewayRequestHandler(routes: readonly GatewayRoute[]) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    addCorsHeaders(req, res);

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
    const requestId = randomUUID();

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
      httpRequest.traceContext = {
        requestId,
        route: routePattern,
        method,
        startAtMs: startedAt,
      };
      const httpResponse = await matched.route.handler(httpRequest);
      sendHttpResponse(res, httpResponse);
      recordRequestMetrics({
        route: routePattern,
        method,
        statusCode: httpResponse.statusCode,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error(`Error handling ${method} ${path}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
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
