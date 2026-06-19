import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  learningImportEndpoint,
  learningReadingExtractEndpoint,
  learningReadingSessionEndpoint,
  learningRulesEndpoint,
  learningStatusEndpoint,
  learningStyleDriftEndpoint,
  learningStyleFeedbackEndpoint,
} from '../../mcp/endpoints/learning.js';
import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import { LearningCapability } from '../../learning/learning-types.js';

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

function responseBody(response: HttpResponse): Record<string, any> {
  return response.body as Record<string, any>;
}

describe('learning endpoints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rejects empty import content and returns normalized import payload', async () => {
    const invalid = await learningImportEndpoint(createRequest({ content: '   ' }));
    expect(invalid.statusCode).toBe(400);
    expect(responseBody(invalid)).toEqual({ error: 'content is required' });

    const valid = await learningImportEndpoint(
      createRequest({
        content: 'Alpha draft',
        sourceType: 'note',
        sourceName: 'chapter-1',
      }),
    );
    expect(valid.statusCode).toBe(200);
    expect(responseBody(valid)).toEqual({
      message: 'Import learning pipeline triggered',
      sourceName: 'chapter-1',
      sourceType: 'note',
      contentLength: 11,
      input: {
        content: 'Alpha draft',
        metadata: {
          sourceType: 'note',
          sourceName: 'chapter-1',
        },
      },
    });
  });

  it('validates style feedback inputs and records evidence', async () => {
    const missingDimension = await learningStyleFeedbackEndpoint(createRequest());
    expect(missingDimension.statusCode).toBe(400);
    expect(responseBody(missingDimension)).toEqual({ error: 'dimension is required' });

    const invalidAction = await learningStyleFeedbackEndpoint(
      createRequest({
        dimension: 'voice',
        action: 'skip',
      }),
    );
    expect(invalidAction.statusCode).toBe(400);
    expect(responseBody(invalidAction)).toEqual({
      error: 'action must be accept, reject, or modify',
    });

    const valid = await learningStyleFeedbackEndpoint(
      createRequest({
        dimension: 'voice',
        action: 'modify',
        value: 0.9,
        source: 'review-loop',
      }),
    );
    expect(valid.statusCode).toBe(200);
    expect(responseBody(valid)).toEqual({
      message: 'Feedback recorded',
      evidence: {
        dimension: 'voice',
        action: 'modify',
        value: 0.9,
        timestamp: '2026-06-04T10:00:00.000Z',
        source: 'review-loop',
      },
    });
  });

  it('validates and reports style drift checks', async () => {
    const invalid = await learningStyleDriftEndpoint(createRequest({ dimensions: {} }));
    expect(invalid.statusCode).toBe(400);
    expect(responseBody(invalid)).toEqual({ error: 'dimensions object is required' });

    const valid = await learningStyleDriftEndpoint(
      createRequest({
        dimensions: {
          pacing: 0.4,
          tone: 0.8,
          structure: 0.6,
        },
      }),
    );
    expect(valid.statusCode).toBe(200);
    expect(responseBody(valid)).toEqual({
      message: 'Style drift detection triggered',
      dimensionCount: 3,
    });
  });

  it('returns active rules and status capabilities', async () => {
    const rules = await learningRulesEndpoint(createRequest());
    expect(rules.statusCode).toBe(200);
    expect(responseBody(rules)).toEqual({
      message: 'Active style rules',
      rules: [],
    });

    const status = await learningStatusEndpoint(createRequest({}, { method: 'GET' }));
    expect(status.statusCode).toBe(200);
    expect(responseBody(status)).toEqual({
      capabilities: [
        { id: LearningCapability.IMPORT, enabled: true },
        { id: LearningCapability.SELF_EVOLVING, enabled: true },
        { id: LearningCapability.READING, enabled: true },
      ],
    });
  });

  it('validates reading session requests and returns a session snapshot', async () => {
    const missingBook = await learningReadingSessionEndpoint(
      createRequest({ totalChapters: 5 }),
    );
    expect(missingBook.statusCode).toBe(400);
    expect(responseBody(missingBook)).toEqual({ error: 'bookId is required' });

    const invalidTotal = await learningReadingSessionEndpoint(
      createRequest({
        bookId: 'novel-1',
        currentChapter: 2,
        totalChapters: 0,
      }),
    );
    expect(invalidTotal.statusCode).toBe(400);
    expect(responseBody(invalidTotal)).toEqual({ error: 'totalChapters must be > 0' });

    const valid = await learningReadingSessionEndpoint(
      createRequest({
        bookId: 'novel-1',
        currentChapter: 2,
        totalChapters: 10,
      }),
    );
    expect(valid.statusCode).toBe(200);
    expect(responseBody(valid)).toEqual({
      message: 'Reading session updated',
      session: {
        bookId: 'novel-1',
        currentChapter: 2,
        totalChapters: 10,
        lastPosition: '',
        startedAt: '2026-06-04T10:00:00.000Z',
        updatedAt: '2026-06-04T10:00:00.000Z',
      },
    });
  });

  it('validates reading extracts and returns extraction metadata', async () => {
    const invalid = await learningReadingExtractEndpoint(
      createRequest({
        content: '   ',
        bookId: 'novel-2',
      }),
    );
    expect(invalid.statusCode).toBe(400);
    expect(responseBody(invalid)).toEqual({ error: 'content is required' });

    const valid = await learningReadingExtractEndpoint(
      createRequest({
        content: 'Scene evidence',
        bookId: 'novel-2',
        currentChapter: 5,
        totalChapters: 12,
      }),
    );
    expect(valid.statusCode).toBe(200);
    expect(responseBody(valid)).toEqual({
      message: 'Reading extraction pipeline triggered',
      bookId: 'novel-2',
      contentLength: 14,
      input: {
        content: 'Scene evidence',
        metadata: {
          bookId: 'novel-2',
          session: {
            bookId: 'novel-2',
            currentChapter: 5,
            totalChapters: 12,
            lastPosition: '',
            startedAt: '2026-06-04T10:00:00.000Z',
            updatedAt: '2026-06-04T10:00:00.000Z',
          },
        },
      },
    });
  });
});
