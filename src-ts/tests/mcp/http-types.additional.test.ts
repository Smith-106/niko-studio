import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  envelope,
  errorEnvelope,
  jsonResponse,
  parseBody,
  type HttpRequest,
} from '../../mcp/http-types';

function makeRequest(body: unknown): HttpRequest {
  return {
    method: 'POST',
    url: '/unit-test',
    headers: { accept: 'application/json' },
    body,
    query: {},
    params: {},
  };
}

describe('mcp/http-types additional coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds json responses, merges custom headers, and parses bodies with defaults', () => {
    const response = jsonResponse(
      { ok: true },
      201,
      { 'X-Test': 'yes' },
    );

    expect(response).toEqual({
      statusCode: 201,
      body: { ok: true },
      headers: {
        'Content-Type': 'application/json',
        'X-Test': 'yes',
      },
    });

    expect(parseBody<{ task: string }>(makeRequest({ task: 'write' }))).toEqual({
      task: 'write',
    });
    expect(parseBody(makeRequest(null))).toEqual({});
  });

  it('wraps success and error envelopes with versioned metadata', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T13:10:00.000Z'));

    const success = envelope({ answer: 42 }, '2.0.0');
    const failure = errorEnvelope('boom', 418, '2.1.0');

    expect(success).toEqual({
      success: true,
      data: { answer: 42 },
      meta: {
        version: '2.0.0',
        timestamp: '2026-06-05T13:10:00.000Z',
      },
    });

    expect(failure).toEqual({
      statusCode: 418,
      body: {
        success: false,
        error: 'boom',
        meta: {
          version: '2.1.0',
          timestamp: '2026-06-05T13:10:00.000Z',
        },
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
});
