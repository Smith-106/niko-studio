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

describe('m10 style endpoints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T10:20:30.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects empty text payloads and missing project ids', async () => {
    const {
      styleExtractEndpoint,
      styleProfileEndpoint,
      styleApplyEndpoint,
    } = await import('../../mcp/endpoints/m10-style.js');

    const extractResponse = await styleExtractEndpoint(makeRequest({ text: '   ' }));
    expect(extractResponse.statusCode).toBe(400);
    expect(extractResponse.body).toEqual({ error: 'text is required' });

    const profileResponse = await styleProfileEndpoint(makeRequest({}, {}));
    expect(profileResponse.statusCode).toBe(400);
    expect(profileResponse.body).toEqual({ error: 'projectId is required' });

    const applyResponse = await styleApplyEndpoint(makeRequest({ text: '' }));
    expect(applyResponse.statusCode).toBe(400);
    expect(applyResponse.body).toEqual({ error: 'text is required' });
  });

  it('extracts a past-tense first-person style profile', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({
      text: [
        'I was late.',
        '"I felt the rain," I said.',
        '',
        'My hands shook.',
      ].join('\n'),
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      tensePreference: 'past',
      dominantPOV: 'first',
      extractedAt: '2026-06-04T10:20:30.000Z',
    });

    const body = response.body as Record<string, unknown>;
    expect(body.avgSentenceLength).toBeGreaterThan(0);
    expect(body.avgParagraphLength).toBeGreaterThan(0);
    expect(body.vocabRichness).toBeGreaterThan(0);
    expect(body.dialogueRatio).toBeGreaterThan(0);
    expect(body.sentenceLengthDistribution).toHaveLength(5);
    expect((body.sentenceLengthDistribution as number[]).reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(body.sampleHash).toMatch(/^[0-9a-f]+$/);
  });

  it('extracts a present-tense third-person style profile', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({
      text: 'He is calm. She says it works. They are ready.',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      tensePreference: 'present',
      dominantPOV: 'third',
      dialogueRatio: 0,
    });
  });

  it('falls back to mixed tense and mixed POV when the signals are balanced', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({
      text: 'I was ready. He is certain.',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      tensePreference: 'mixed',
      dominantPOV: 'mixed',
    });
  });

  it('returns zero sentence averages when punctuation yields no parsed sentences', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({
      text: '!!!',
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      avgSentenceLength: 0,
      dialogueRatio: 0,
    });
  });

  it('returns a placeholder profile response for a known project id', async () => {
    const { styleProfileEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleProfileEndpoint(makeRequest({}, { projectId: 'project-42' }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeNull();
  });

  it('builds style guidance from an explicit profile', async () => {
    const { styleApplyEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleApplyEndpoint(makeRequest({
      text: 'Rewrite this scene.',
      style_profile: {
        avgSentenceLength: 12.5,
        vocabRichness: 0.456,
        dialogueRatio: 0.25,
        tensePreference: 'past',
        dominantPOV: 'first',
      },
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      context: [
        'Target style parameters:',
        '- Average sentence length: 12.5 words',
        '- Vocabulary richness: 45.6%',
        '- Dialogue ratio: 25.0%',
        '- Tense: past',
        '- POV: first',
        '',
        'Match these parameters when generating or revising text.',
      ].join('\n'),
    });
  });

  it('fills missing style profile fields with safe defaults', async () => {
    const { styleApplyEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleApplyEndpoint(makeRequest({
      text: 'Keep the same voice.',
      style_profile: {},
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      context: [
        'Target style parameters:',
        '- Average sentence length: N/A words',
        '- Vocabulary richness: 0.0%',
        '- Dialogue ratio: 0.0%',
        '- Tense: mixed',
        '- POV: mixed',
        '',
        'Match these parameters when generating or revising text.',
      ].join('\n'),
    });
  });
});
