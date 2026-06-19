import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types';

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/learning',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('learning endpoints', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // --- CAP-001: learningImportEndpoint ---

  describe('learningImportEndpoint', () => {
    it('returns 400 when content is empty', async () => {
      const { learningImportEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningImportEndpoint(makeRequest({ content: '' }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'content is required' });
    });

    it('returns 400 when content is whitespace only', async () => {
      const { learningImportEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningImportEndpoint(makeRequest({ content: '   ' }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'content is required' });
    });

    it('returns 200 with message/input/sourceName/sourceType/contentLength for valid content', async () => {
      const { learningImportEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningImportEndpoint(
        makeRequest({ content: 'Some learning content here' }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.message).toBe('Import learning pipeline triggered');
      expect(body.sourceName).toBe('unknown');
      expect(body.sourceType).toBe('document');
      expect(body.contentLength).toBe('Some learning content here'.length);
      expect(body.input).toMatchObject({
        content: 'Some learning content here',
        metadata: { sourceType: 'document', sourceName: 'unknown' },
      });
    });

    it('defaults sourceType to document and sourceName to unknown when omitted', async () => {
      const { learningImportEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningImportEndpoint(
        makeRequest({ content: 'hello' }),
      );

      const body = response.body as Record<string, unknown>;
      expect(body.sourceType).toBe('document');
      expect(body.sourceName).toBe('unknown');
    });

    it('accepts custom sourceType and sourceName', async () => {
      const { learningImportEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningImportEndpoint(
        makeRequest({
          content: 'custom source',
          sourceType: 'web',
          sourceName: 'my-source',
        }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.sourceType).toBe('web');
      expect(body.sourceName).toBe('my-source');
      expect(body.input).toMatchObject({
        content: 'custom source',
        metadata: { sourceType: 'web', sourceName: 'my-source' },
      });
    });
  });

  // --- CAP-002: learningStyleFeedbackEndpoint ---

  describe('learningStyleFeedbackEndpoint', () => {
    it('returns 400 when dimension is missing', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(makeRequest({ action: 'accept' }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'dimension is required' });
    });

    it('returns 400 when dimension is empty string', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(
        makeRequest({ dimension: '', action: 'accept' }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'dimension is required' });
    });

    it('returns 400 when action is invalid', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(
        makeRequest({ dimension: 'tone', action: 'invalid' }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'action must be accept, reject, or modify' });
    });

    it('returns 200 with evidence object for accept action', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(
        makeRequest({ dimension: 'tone', action: 'accept', value: 0.8 }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.message).toBe('Feedback recorded');
      const evidence = body.evidence as Record<string, unknown>;
      expect(evidence.dimension).toBe('tone');
      expect(evidence.action).toBe('accept');
      expect(evidence.value).toBe(0.8);
      expect(evidence.source).toBe('manual');
      expect(typeof evidence.timestamp).toBe('string');
    });

    it('returns 200 with evidence object for reject action', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(
        makeRequest({ dimension: 'pacing', action: 'reject', value: 0.3 }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const evidence = body.evidence as Record<string, unknown>;
      expect(evidence.action).toBe('reject');
      expect(evidence.dimension).toBe('pacing');
    });

    it('returns 200 with evidence object for modify action', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(
        makeRequest({ dimension: 'vocabulary', action: 'modify', value: 0.6 }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const evidence = body.evidence as Record<string, unknown>;
      expect(evidence.action).toBe('modify');
      expect(evidence.dimension).toBe('vocabulary');
    });

    it('accepts custom source field', async () => {
      const { learningStyleFeedbackEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleFeedbackEndpoint(
        makeRequest({ dimension: 'tone', action: 'accept', source: 'auto-detector' }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const evidence = body.evidence as Record<string, unknown>;
      expect(evidence.source).toBe('auto-detector');
    });
  });

  // --- CAP-002: learningStyleDriftEndpoint ---

  describe('learningStyleDriftEndpoint', () => {
    it('returns 400 when dimensions is empty', async () => {
      const { learningStyleDriftEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleDriftEndpoint(makeRequest({ dimensions: {} }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'dimensions object is required' });
    });

    it('returns 400 when dimensions is not provided', async () => {
      const { learningStyleDriftEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleDriftEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'dimensions object is required' });
    });

    it('returns 200 with dimensionCount for valid dimensions', async () => {
      const { learningStyleDriftEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleDriftEndpoint(
        makeRequest({ dimensions: { tone: 0.7, pacing: 0.5, vocabulary: 0.8 } }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.message).toBe('Style drift detection triggered');
      expect(body.dimensionCount).toBe(3);
    });

    it('returns correct dimensionCount for single dimension', async () => {
      const { learningStyleDriftEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStyleDriftEndpoint(
        makeRequest({ dimensions: { tone: 0.9 } }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.dimensionCount).toBe(1);
    });
  });

  // --- CAP-002: learningRulesEndpoint ---

  describe('learningRulesEndpoint', () => {
    it('returns 200 with rules array', async () => {
      const { learningRulesEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningRulesEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.message).toBe('Active style rules');
      expect(Array.isArray(body.rules)).toBe(true);
    });

    it('returns empty rules array when no rules exist', async () => {
      const { learningRulesEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningRulesEndpoint(makeRequest({}));

      const body = response.body as Record<string, unknown>;
      expect(body.rules).toEqual([]);
    });
  });

  // --- CAP-003: learningReadingSessionEndpoint ---

  describe('learningReadingSessionEndpoint', () => {
    it('returns 400 when bookId is missing', async () => {
      const { learningReadingSessionEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingSessionEndpoint(
        makeRequest({ totalChapters: 10 }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'bookId is required' });
    });

    it('returns 400 when bookId is empty string', async () => {
      const { learningReadingSessionEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingSessionEndpoint(
        makeRequest({ bookId: '', totalChapters: 10 }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'bookId is required' });
    });

    it('returns 400 when totalChapters is 0', async () => {
      const { learningReadingSessionEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingSessionEndpoint(
        makeRequest({ bookId: 'book-1', totalChapters: 0 }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'totalChapters must be > 0' });
    });

    it('returns 400 when totalChapters is negative', async () => {
      const { learningReadingSessionEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingSessionEndpoint(
        makeRequest({ bookId: 'book-1', totalChapters: -5 }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'totalChapters must be > 0' });
    });

    it('returns 200 with session object for valid input', async () => {
      const { learningReadingSessionEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingSessionEndpoint(
        makeRequest({ bookId: 'my-book', currentChapter: 3, totalChapters: 20 }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.message).toBe('Reading session updated');
      const session = body.session as Record<string, unknown>;
      expect(session.bookId).toBe('my-book');
      expect(session.currentChapter).toBe(3);
      expect(session.totalChapters).toBe(20);
      expect(session.lastPosition).toBe('');
      expect(typeof session.startedAt).toBe('string');
      expect(typeof session.updatedAt).toBe('string');
    });
  });

  // --- CAP-003: learningReadingExtractEndpoint ---

  describe('learningReadingExtractEndpoint', () => {
    it('returns 400 when content is empty', async () => {
      const { learningReadingExtractEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingExtractEndpoint(
        makeRequest({ bookId: 'book-1', content: '' }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'content is required' });
    });

    it('returns 400 when content is whitespace only', async () => {
      const { learningReadingExtractEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingExtractEndpoint(
        makeRequest({ bookId: 'book-1', content: '  \t  ' }),
      );

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ error: 'content is required' });
    });

    it('returns 200 with input/bookId/contentLength for valid content', async () => {
      const { learningReadingExtractEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingExtractEndpoint(
        makeRequest({ content: 'Extract this text', bookId: 'my-book', currentChapter: 2, totalChapters: 10 }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.message).toBe('Reading extraction pipeline triggered');
      expect(body.bookId).toBe('my-book');
      expect(body.contentLength).toBe('Extract this text'.length);
      expect(body.input).toMatchObject({
        content: 'Extract this text',
      });
      const input = body.input as Record<string, unknown>;
      const metadata = input.metadata as Record<string, unknown>;
      expect(metadata.bookId).toBe('my-book');
      const session = metadata.session as Record<string, unknown>;
      expect(session.bookId).toBe('my-book');
      expect(session.currentChapter).toBe(2);
      expect(session.totalChapters).toBe(10);
    });

    it('defaults bookId to unknown when omitted', async () => {
      const { learningReadingExtractEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningReadingExtractEndpoint(
        makeRequest({ content: 'some content' }),
      );

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.bookId).toBe('unknown');
    });
  });

  // --- Pipeline Status: learningStatusEndpoint ---

  describe('learningStatusEndpoint', () => {
    it('returns 200 with capabilities array containing IMPORT, SELF_EVOLVING, READING', async () => {
      const { learningStatusEndpoint } = await import('../../mcp/endpoints/learning.js');

      const response = await learningStatusEndpoint(makeRequest({}));

      expect(response.statusCode).toBe(200);
      const body = response.body as Record<string, unknown>;
      const capabilities = body.capabilities as Array<Record<string, unknown>>;
      expect(capabilities).toHaveLength(3);
      const capabilityIds = capabilities.map((c) => c.id);
      expect(capabilityIds).toContain('import');
      expect(capabilityIds).toContain('self_evolving');
      expect(capabilityIds).toContain('reading');
      capabilities.forEach((c) => {
        expect(c.enabled).toBe(true);
      });
    });
  });
});
