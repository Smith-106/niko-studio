import type { IncomingMessage, ServerResponse } from 'node:http';

import type { HttpRequest, HttpResponse } from './http-types';

const CORS_ORIGINS = (process.env.NIKO_CORS_ORIGINS ?? '*')
  .split(',')
  .map((value) => value.trim());

export function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function parseQuery(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return {};
  }

  const queryString = url.slice(queryIndex + 1);
  const params: Record<string, string> = {};
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  return params;
}

export function extractPath(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

export function toHttpRequest(
  req: IncomingMessage,
  body: unknown,
  query: Record<string, string>,
  params: Record<string, string>,
): HttpRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers[key] = value;
    } else if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    }
  }

  return {
    method: req.method ?? 'GET',
    url: req.url ?? '/',
    headers,
    body,
    query,
    params,
  };
}

export function sendHttpResponse(res: ServerResponse, httpResponse: HttpResponse): void {
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    ...((httpResponse.headers ?? {}) as Record<string, string>),
  };

  res.writeHead(httpResponse.statusCode, headers);
  res.end(
    typeof httpResponse.body === 'string'
      ? httpResponse.body
      : JSON.stringify(httpResponse.body),
  );
}

export function addCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (CORS_ORIGINS.includes('*') || (origin && CORS_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}
