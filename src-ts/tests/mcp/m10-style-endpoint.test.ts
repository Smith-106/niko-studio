import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/m10/style',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function makeGetRequest(params: Record<string, string>): HttpRequest {
  return {
    method: 'GET',
    url: '/m10/style/profile',
    headers: {},
    body: {},
    query: {},
    params,
  };
}

describe('m10-style endpoint', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // --- styleExtractEndpoint ---

  it('styleExtractEndpoint returns 400 when text is empty', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({ text: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('styleExtractEndpoint returns 400 when text is only whitespace', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleExtractEndpoint(makeRequest({ text: '   ' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('styleExtractEndpoint returns 200 with style profile for English prose', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const englishText = [
      'The wizard stood at the edge of the cliff. He looked down at the vast ocean below.',
      'Waves crashed against the rocks. He could feel the cold wind on his face.',
      '"We must leave now," he said. The dragon was approaching from the north.',
    ].join('\n\n');

    const response = await styleExtractEndpoint(makeRequest({ text: englishText }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;

    // Verify profile fields
    expect(typeof body.avgSentenceLength).toBe('number');
    expect(body.avgSentenceLength).toBeGreaterThan(0);

    expect(typeof body.vocabRichness).toBe('number');
    expect(body.vocabRichness).toBeGreaterThanOrEqual(0);
    expect(body.vocabRichness).toBeLessThanOrEqual(1);

    expect(typeof body.dialogueRatio).toBe('number');
    expect(body.dialogueRatio).toBeGreaterThanOrEqual(0);
    expect(body.dialogueRatio).toBeLessThanOrEqual(1);

    expect(['past', 'present', 'mixed']).toContain(body.tensePreference);

    expect(typeof body.avgParagraphLength).toBe('number');

    expect(Array.isArray(body.sentenceLengthDistribution)).toBe(true);

    expect(['first', 'third', 'mixed']).toContain(body.dominantPOV);

    expect(typeof body.sampleHash).toBe('string');
    expect(body.sampleHash.length).toBeGreaterThan(0);

    expect(typeof body.extractedAt).toBe('string');
  });

  it('styleExtractEndpoint handles Chinese text with CJK character counting', async () => {
    const { styleExtractEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const chineseText = [
      '法术在空中绽放，灵力涌动。他站在结界之前，注视着远方的城池。',
      '"你必须通过考验，"长老说道。阵法的力量令人敬畏。',
    ].join('\n\n');

    const response = await styleExtractEndpoint(makeRequest({ text: chineseText }));

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;

    expect(typeof body.avgSentenceLength).toBe('number');
    expect(body.avgSentenceLength).toBeGreaterThan(0);

    expect(typeof body.vocabRichness).toBe('number');
    expect(body.vocabRichness).toBeGreaterThanOrEqual(0);

    // Chinese text should produce a valid style profile
    expect(typeof body.sampleHash).toBe('string');
    expect(typeof body.extractedAt).toBe('string');
  });

  // --- styleProfileEndpoint ---

  it('styleProfileEndpoint returns 400 when projectId is missing', async () => {
    const { styleProfileEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleProfileEndpoint(makeGetRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'projectId is required' });
  });

  it('styleProfileEndpoint returns 400 when projectId is empty string', async () => {
    const { styleProfileEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleProfileEndpoint(makeGetRequest({ projectId: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'projectId is required' });
  });

  it('styleProfileEndpoint returns 200 for valid projectId', async () => {
    const { styleProfileEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleProfileEndpoint(
      makeGetRequest({ projectId: 'proj-style-001' }),
    );

    expect(response.statusCode).toBe(200);
  });

  // --- styleApplyEndpoint ---

  it('styleApplyEndpoint returns 400 when text is empty', async () => {
    const { styleApplyEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleApplyEndpoint(makeRequest({ text: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('styleApplyEndpoint returns 400 when text is only whitespace', async () => {
    const { styleApplyEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleApplyEndpoint(makeRequest({ text: '  \t  ' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('styleApplyEndpoint returns 200 with context string containing style parameters', async () => {
    const { styleApplyEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const styleProfile = {
      avgSentenceLength: 15,
      vocabRichness: 0.6,
      dialogueRatio: 0.3,
      tensePreference: 'past',
      dominantPOV: 'third',
    };

    const response = await styleApplyEndpoint(
      makeRequest({ text: 'Apply style to this text.', style_profile: styleProfile }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;

    expect(typeof body.context).toBe('string');
    expect(body.context).toContain('Target style parameters');
    expect(body.context).toContain('15');
    expect(body.context).toContain('60.0%');
    expect(body.context).toContain('30.0%');
    expect(body.context).toContain('past');
    expect(body.context).toContain('third');
  });

  it('styleApplyEndpoint handles missing style_profile gracefully', async () => {
    const { styleApplyEndpoint } = await import('../../mcp/endpoints/m10-style.js');

    const response = await styleApplyEndpoint(
      makeRequest({ text: 'Text without style profile' }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(typeof body.context).toBe('string');
    expect(body.context).toContain('Target style parameters');
    // Should use defaults (N/A, 0.0%, mixed)
    expect(body.context).toContain('N/A');
    expect(body.context).toContain('mixed');
  });
});
