import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import {
  clearReaderStores,
  rsCompareEndpoint,
} from '../../reader/mcp/reader-endpoints.js';

function mockRequest({
  method = 'POST',
  url = '/reader/compare',
  body = {},
  query = {},
  params = {},
}: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method,
    url,
    headers: {},
    body,
    query,
    params,
  };
}

function getBody(response: HttpResponse) {
  return response.body as any;
}

afterEach(() => {
  clearReaderStores();
});

describe('reader/mcp/reader-endpoints — compare', () => {
  it('validates compare request payloads', async () => {
    const missingNovelId = await rsCompareEndpoint(mockRequest({ body: {} }));
    expect(missingNovelId.statusCode).toBe(400);
    expect(getBody(missingNovelId).error).toBe('novelId is required and must be a string');

    const missingVersionA = await rsCompareEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );
    expect(missingVersionA.statusCode).toBe(400);
    expect(getBody(missingVersionA).error).toBe(
      'versionA is required and must be an object with a text field',
    );

    const missingVersionB = await rsCompareEndpoint(
      mockRequest({ body: { novelId: 'novel-1', versionA: { text: 'hello' } } }),
    );
    expect(missingVersionB.statusCode).toBe(400);
    expect(getBody(missingVersionB).error).toBe(
      'versionB is required and must be an object with a text field',
    );

    const missingTextA = await rsCompareEndpoint(
      mockRequest({
        body: { novelId: 'novel-1', versionA: {}, versionB: { text: 'world' } },
      }),
    );
    expect(missingTextA.statusCode).toBe(400);
    expect(getBody(missingTextA).error).toBe(
      'versionA.text is required and must be a string',
    );

    const missingTextB = await rsCompareEndpoint(
      mockRequest({
        body: { novelId: 'novel-1', versionA: { text: 'hello' }, versionB: {} },
      }),
    );
    expect(missingTextB.statusCode).toBe(400);
    expect(getBody(missingTextB).error).toBe(
      'versionB.text is required and must be a string',
    );
  });

  it('validates personaIds if provided', async () => {
    const invalidPersonaIds = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          versionA: { text: 'hello' },
          versionB: { text: 'world' },
          personaIds: 'bad',
        } as any,
      }),
    );
    expect(invalidPersonaIds.statusCode).toBe(400);
    expect(getBody(invalidPersonaIds).error).toBe('personaIds must be an array of strings');

    const invalidPersonaIdEntry = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          versionA: { text: 'hello' },
          versionB: { text: 'world' },
          personaIds: ['ok', 3],
        } as any,
      }),
    );
    expect(invalidPersonaIdEntry.statusCode).toBe(400);
    expect(getBody(invalidPersonaIdEntry).error).toBe('Each personaId must be a string');
  });

  it('returns comparison for two versions with all preset personas', async () => {
    const response = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-ab',
          versionA: { text: 'Short text A.', label: 'Original' },
          versionB: { text: 'A slightly longer piece of text for version B.', label: 'Revised' },
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);

    expect(body.novelId).toBe('novel-ab');
    expect(body.versionAConsensus).toBeDefined();
    expect(body.versionBConsensus).toBeDefined();
    expect(body.comparison).toBeDefined();
    expect(Array.isArray(body.comparison)).toBe(true);
    expect(body.overallWinner).toMatch(/^[AB]|tie$/);
    expect(body.versionALabel).toBe('Original');
    expect(body.versionBLabel).toBe('Revised');
  });

  it('returns comparison with correct dimension structure', async () => {
    const response = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-ab-2',
          versionA: { text: 'Version A text here.' },
          versionB: { text: 'Version B text here, longer and more detailed.' },
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);

    // Each comparison item must have the required fields
    for (const item of body.comparison) {
      expect(item).toHaveProperty('dimension');
      expect(typeof item.dimension).toBe('string');
      expect(item).toHaveProperty('versionAScore');
      expect(typeof item.versionAScore).toBe('number');
      expect(item).toHaveProperty('versionBScore');
      expect(typeof item.versionBScore).toBe('number');
      expect(item).toHaveProperty('delta');
      expect(typeof item.delta).toBe('number');
      expect(item).toHaveProperty('winner');
      expect(['A', 'B', 'tie']).toContain(item.winner);
      expect(item).toHaveProperty('notes');
      expect(typeof item.notes).toBe('string');
    }
  });

  it('returns correct winner based on dimension scores', async () => {
    const response = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-ab-3',
          versionA: { text: 'A' },
          versionB: { text: 'B' },
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);

    // For identical short texts, the consensus should be similar
    // The winner should be determinable
    expect(body.overallWinner).toMatch(/^[AB]|tie$/);

    // Check that versionAConsensus and versionBConsensus have the expected shape
    expect(body.versionAConsensus).toHaveProperty('items');
    expect(body.versionAConsensus).toHaveProperty('overallAssessment');
    expect(body.versionAConsensus).toHaveProperty('criticalIssues');
    expect(body.versionAConsensus).toHaveProperty('dissentItems');
    expect(body.versionAConsensus).toHaveProperty('dimensionSummaries');

    expect(body.versionBConsensus).toHaveProperty('items');
    expect(body.versionBConsensus).toHaveProperty('overallAssessment');
    expect(body.versionBConsensus).toHaveProperty('criticalIssues');
    expect(body.versionBConsensus).toHaveProperty('dissentItems');
    expect(body.versionBConsensus).toHaveProperty('dimensionSummaries');
  });

  it('supports custom personas in compare', async () => {
    // First create a custom persona
    const { rsCreateCustomPersonaEndpoint } = await import(
      '../../reader/mcp/reader-endpoints.js'
    );
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        url: '/reader/personas/custom',
        body: {
          name: 'Compare Tester',
          parameters: { plotWeight: 0.9 },
        },
      }),
    );
    expect(created.statusCode).toBe(201);
    const personaId = getBody(created).persona.id as string;

    const response = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-ab-custom',
          versionA: { text: 'Text with custom persona A.' },
          versionB: { text: 'Text with custom persona B.' },
          personaIds: [personaId],
        },
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.comparison).toBeDefined();
    expect(body.overallWinner).toMatch(/^[AB]|tie$/);
  });

  it('returns server error when a requested persona cannot be resolved', async () => {
    const response = await rsCompareEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          versionA: { text: 'hello' },
          versionB: { text: 'world' },
          personaIds: ['missing-persona'],
        },
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response).error).toBe('Persona not found: missing-persona');
  });
});
