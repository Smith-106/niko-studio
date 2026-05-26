import type { IncomingMessage, ServerResponse } from 'node:http';

import { resolveCorsOrigins } from './config';
import type { HttpRequest, HttpResponse } from './http-types';

export const API_PROTOCOL_VERSION = '1.0.0';

export function readRequestBody(req: IncomingMessage, timeoutMs: number = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Request body read timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    const cleanup = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
      }
    };

    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      cleanup();
      resolve(data);
    });
    req.on('error', (err) => {
      cleanup();
      reject(err);
    });
    req.on('close', () => {
      // Client disconnected before sending full body
      if (!settled) {
        cleanup();
        reject(new Error('Client disconnected before request body was fully received'));
      }
    });
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
    const eqIndex = pair.indexOf('=');
    const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const value = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);
    if (key) {
      try {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      } catch {
        params[key] = value;
      }
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
    'X-API-Version': API_PROTOCOL_VERSION,
    ...((httpResponse.headers ?? {}) as Record<string, string>),
  };

  res.writeHead(httpResponse.statusCode, headers);
  res.end(
    typeof httpResponse.body === 'string'
      ? httpResponse.body
      : JSON.stringify(httpResponse.body),
  );
}

export function resolveGatewayCorsOrigins(): string[] {
  try {
    return resolveCorsOrigins();
  } catch {
    return [];
  }
}

export function addCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  const corsOrigins = resolveGatewayCorsOrigins();

  if (corsOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  } else if (origin && corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}
