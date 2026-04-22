/**
 * MCP HTTP Types
 *
 * Generic request/response interfaces for MCP endpoints.
 * Adapted from Starlette request/response to framework-agnostic pattern.
 */

export interface HttpRequestTraceContext {
  requestId: string;
  route: string;
  method: string;
  startAtMs: number;
}

export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  traceContext?: HttpRequestTraceContext;
}

export interface HttpResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function jsonResponse(
  body: unknown,
  statusCode = 200,
  headers?: Record<string, string>
): HttpResponse {
  return {
    statusCode,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
}

export function parseBody<T = Record<string, unknown>>(request: HttpRequest): T {
  return (request.body ?? {}) as T;
}
