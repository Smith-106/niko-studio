import type { IncomingMessage, ServerResponse } from 'node:http';

import type { GatewayRoute } from './gateway-route-types';
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
      return;
    }

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
      const httpResponse = await matched.route.handler(httpRequest);
      sendHttpResponse(res, httpResponse);
    } catch (error) {
      console.error(`Error handling ${method} ${path}:`, error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };
}
