import { describe, expect, it, vi } from 'vitest';

import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  addCorsHeaders,
  extractPath,
  parseQuery,
  readRequestBody,
  sendHttpResponse,
  toHttpRequest,
} from '../../mcp/gateway-http-adapter';
import type { HttpResponse } from '../../mcp/http-types';

function createMockReq(partial: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    on: vi.fn(),
    ...partial,
  } as unknown as IncomingMessage;
}

function createMockRes(): { res: ServerResponse; calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {};
  const res = {
    writeHead: vi.fn((...args: unknown[]) => { calls['writeHead'] = calls['writeHead'] ?? []; calls['writeHead'].push(args); }),
    setHeader: vi.fn((...args: unknown[]) => { calls['setHeader'] = calls['setHeader'] ?? []; calls['setHeader'].push(args); }),
    end: vi.fn((...args: unknown[]) => { calls['end'] = calls['end'] ?? []; calls['end'].push(args); }),
  } as unknown as ServerResponse;
  return { res, calls };
}

describe('gateway-http-adapter', () => {
  describe('extractPath', () => {
    it('returns the full URL when there is no query string', () => {
      expect(extractPath('/health')).toBe('/health');
    });

    it('strips the query string and returns only the path', () => {
      expect(extractPath('/wiki/list?status=curated&limit=5')).toBe('/wiki/list');
    });

    it('handles an empty path', () => {
      expect(extractPath('')).toBe('');
    });

    it('handles root path with query', () => {
      expect(extractPath('/?foo=bar')).toBe('/');
    });
  });

  describe('parseQuery', () => {
    it('parses a single key-value pair', () => {
      expect(parseQuery('/search?q=hello')).toEqual({ q: 'hello' });
    });

    it('parses multiple key-value pairs', () => {
      expect(parseQuery('/list?status=curated&limit=5')).toEqual({
        status: 'curated',
        limit: '5',
      });
    });

    it('decodes percent-encoded characters', () => {
      expect(parseQuery('/search?q=%E4%BD%A0%E5%A5%BD')).toEqual({ q: '\u4F60\u597D' });
    });

    it('returns an empty object when there is no query string', () => {
      expect(parseQuery('/health')).toEqual({});
    });

    it('handles keys without values', () => {
      const result = parseQuery('/page?flag');
      expect(result).toHaveProperty('flag', '');
    });
  });

  describe('readRequestBody', () => {
    it('resolves with accumulated data on end event', async () => {
      const req = createMockReq();
      const dataChunks: string[] = [];
      const onFn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'data') {
          dataChunks.push(handler);
        } else if (event === 'end') {
          dataChunks.push(handler);
        } else if (event === 'error') {
          dataChunks.push(handler);
        }
      });
      (req as unknown as { on: ReturnType<typeof vi.fn> }).on = onFn;

      const promise = readRequestBody(req);

      // Simulate data events
      const dataHandlers = onFn.mock.calls.filter(([event]) => event === 'data').map(([, fn]) => fn);
      for (const handler of dataHandlers) {
        handler('{"key":"value"}');
      }
      const endHandlers = onFn.mock.calls.filter(([event]) => event === 'end').map(([, fn]) => fn);
      for (const handler of endHandlers) {
        handler();
      }

      expect(await promise).toBe('{"key":"value"}');
    });

    it('rejects when an error event fires', async () => {
      const req = createMockReq();
      const onFn = vi.fn((_event: string, handler: (...args: unknown[]) => void) => {
        if (_event === 'error') {
          handler(new Error('stream broken'));
        }
      });
      (req as unknown as { on: ReturnType<typeof vi.fn> }).on = onFn;

      await expect(readRequestBody(req)).rejects.toThrow('stream broken');
    });
  });

  describe('toHttpRequest', () => {
    it('maps an IncomingMessage into an HttpRequest with defaults', () => {
      const req = createMockReq({
        method: 'POST',
        url: '/chat',
        headers: { 'content-type': 'application/json' },
      });
      const httpRequest = toHttpRequest(req, { message: 'hi' }, { lang: 'zh' }, { id: '1' });

      expect(httpRequest.method).toBe('POST');
      expect(httpRequest.url).toBe('/chat');
      expect(httpRequest.headers['content-type']).toBe('application/json');
      expect(httpRequest.body).toEqual({ message: 'hi' });
      expect(httpRequest.query).toEqual({ lang: 'zh' });
      expect(httpRequest.params).toEqual({ id: '1' });
    });

    it('falls back to GET and / when method or url are missing', () => {
      const req = createMockReq({ method: undefined, url: undefined });
      const httpRequest = toHttpRequest(req, null, {}, {});

      expect(httpRequest.method).toBe('GET');
      expect(httpRequest.url).toBe('/');
    });

    it('joins array header values with comma', () => {
      const req = createMockReq({
        headers: { accept: ['text/html', 'application/json'] },
      });
      const httpRequest = toHttpRequest(req, null, {}, {});

      expect(httpRequest.headers['accept']).toBe('text/html, application/json');
    });
  });

  describe('sendHttpResponse', () => {
    it('writes statusCode, Content-Type header, and JSON body', () => {
      const { res, calls } = createMockRes();
      const httpResponse: HttpResponse = {
        statusCode: 200,
        body: { status: 'ok' },
      };

      sendHttpResponse(res, httpResponse);

      expect(calls['writeHead']).toHaveLength(1);
      expect(calls['writeHead']![0][0]).toBe(200);
      expect(calls['end']).toHaveLength(1);
      const bodyArg = calls['end']![0][0];
      expect(JSON.parse(String(bodyArg))).toEqual({ status: 'ok' });
    });

    it('serializes string bodies without double-encoding', () => {
      const { res, calls } = createMockRes();
      const httpResponse: HttpResponse = {
        statusCode: 200,
        body: 'plain text',
      };

      sendHttpResponse(res, httpResponse);

      const bodyArg = calls['end']![0][0];
      expect(bodyArg).toBe('plain text');
    });

    it('merges custom headers with Content-Type', () => {
      const { res, calls } = createMockRes();
      const httpResponse: HttpResponse = {
        statusCode: 201,
        body: {},
        headers: { 'X-Custom': 'value' },
      };

      sendHttpResponse(res, httpResponse);

      const writeHeadArgs = calls['writeHead']![0];
      const headers = writeHeadArgs[1] as Record<string, unknown>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Custom']).toBe('value');
    });
  });

  describe('addCorsHeaders', () => {
    it('sets CORS headers allowing wildcard origin', () => {
      const req = createMockReq({ headers: { origin: 'http://localhost:3000' } });
      const { res, calls } = createMockRes();

      addCorsHeaders(req, res);

      const setHeaderCalls = calls['setHeader'] ?? [];
      expect(setHeaderCalls.some(([key]) => key === 'Access-Control-Allow-Origin')).toBe(true);
      expect(setHeaderCalls.some(([key]) => key === 'Access-Control-Allow-Methods')).toBe(true);
      expect(setHeaderCalls.some(([key]) => key === 'Access-Control-Allow-Headers')).toBe(true);
      expect(setHeaderCalls.some(([key]) => key === 'Access-Control-Max-Age')).toBe(true);
    });
  });
});
