import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  learningImportEndpoint,
  learningReadingExtractEndpoint,
  learningReadingSessionEndpoint,
  learningStyleDriftEndpoint,
} from '../../mcp/endpoints/learning.js';
import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';

function createRequest(
  body: Record<string, unknown> = {},
  overrides: Partial<HttpRequest> = {},
): HttpRequest {
  return {
    method: 'POST',
    url: '/learning',
    headers: {},
    body,
    query: {},
    params: {},
    ...overrides,
  };
}

function responseBody(response: HttpResponse): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe('learning endpoints additional default branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-09T06:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defaults missing import content to an empty string and rejects the request', async () => {
    const response = await learningImportEndpoint(createRequest());

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({ error: 'content is required' });
  });

  it('defaults missing style drift dimensions to an empty object', async () => {
    const response = await learningStyleDriftEndpoint(createRequest());

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({ error: 'dimensions object is required' });
  });

  it('defaults missing total chapters to zero for reading sessions', async () => {
    const response = await learningReadingSessionEndpoint(
      createRequest({
        bookId: 'novel-42',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({ error: 'totalChapters must be > 0' });
  });

  it('defaults missing reading extract content to an empty string and rejects the request', async () => {
    const response = await learningReadingExtractEndpoint(
      createRequest({
        bookId: 'novel-42',
      }),
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({ error: 'content is required' });
  });

  it('defaults missing reading extract bookId to unknown for valid requests', async () => {
    const response = await learningReadingExtractEndpoint(
      createRequest({
        content: 'Extract this chapter fragment',
      }),
    );

    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toEqual({
      message: 'Reading extraction pipeline triggered',
      bookId: 'unknown',
      contentLength: 29,
      input: {
        content: 'Extract this chapter fragment',
        metadata: {
          bookId: 'unknown',
          session: {
            bookId: 'unknown',
            currentChapter: 0,
            totalChapters: 0,
            lastPosition: '',
            startedAt: '2026-06-09T06:00:00.000Z',
            updatedAt: '2026-06-09T06:00:00.000Z',
          },
        },
      },
    });
  });
});
