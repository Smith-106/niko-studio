import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(
  body: Record<string, unknown>,
  params: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    url: '/m10-style',
    headers: {},
    body,
    query: {},
    params,
  };
}

describe('m10 style endpoints additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-09T06:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults missing text fields to an empty string before validation', async () => {
    const {
      styleExtractEndpoint,
      styleApplyEndpoint,
    } = await import('../../mcp/endpoints/m10-style.js');

    const extractResponse = await styleExtractEndpoint(makeRequest({}));
    expect(extractResponse.statusCode).toBe(400);
    expect(extractResponse.body).toEqual({ error: 'text is required' });

    const applyResponse = await styleApplyEndpoint(makeRequest({
      style_profile: {
        avgSentenceLength: 9,
      },
    }));
    expect(applyResponse.statusCode).toBe(400);
    expect(applyResponse.body).toEqual({ error: 'text is required' });
  });

  it('counts Han characters toward vocabulary-rich style extraction', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({
      text: [
        '林风走进古城。',
        '',
        '苏雨说，星门今晚会开启。',
      ].join('\n'),
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      dominantPOV: 'mixed',
      tensePreference: 'mixed',
      extractedAt: '2026-06-09T06:30:00.000Z',
    });

    const body = response.body as Record<string, unknown>;
    expect(body.avgSentenceLength).toBeGreaterThan(0);
    expect(body.avgParagraphLength).toBeGreaterThan(0);
    expect(body.vocabRichness).toBeGreaterThan(0);
    expect((body.sentenceLengthDistribution as number[]).reduce((sum, value) => sum + value, 0)).toBe(2);
  });
});
