import { afterEach, describe, expect, it } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import type { DualEngineResult } from '../../reader/DualEngine.js';
import {
  clearReaderStores,
  getAnalysisResultCache,
  getCustomPersonaStore,
  rsAnalyzeEndpoint,
  rsCreateCustomPersonaEndpoint,
  rsGetOverlayEndpoint,
  rsGetPersonasEndpoint,
} from '../../reader/mcp/reader-endpoints.js';

function mockRequest({
  method = 'POST',
  url = '/reader',
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

describe('reader/mcp/reader-endpoints', () => {
  it('validates analyze request payloads', async () => {
    const missingNovelId = await rsAnalyzeEndpoint(mockRequest({ body: {} }));
    expect(missingNovelId.statusCode).toBe(400);
    expect(getBody(missingNovelId).error).toBe('novelId is required and must be a string');

    const invalidPersonaIds = await rsAnalyzeEndpoint(
      mockRequest({ body: { novelId: 'novel-1', personaIds: 'bad' } as any }),
    );
    expect(invalidPersonaIds.statusCode).toBe(400);
    expect(getBody(invalidPersonaIds).error).toBe('personaIds must be an array of strings');

    const invalidPersonaIdEntry = await rsAnalyzeEndpoint(
      mockRequest({ body: { novelId: 'novel-1', personaIds: ['ok', 3] } as any }),
    );
    expect(invalidPersonaIdEntry.statusCode).toBe(400);
    expect(getBody(invalidPersonaIdEntry).error).toBe('Each personaId must be a string');
  });

  it('runs analysis with preset personas and caches the result for overlays', async () => {
    const response = await rsAnalyzeEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );

    expect(response.statusCode).toBe(200);
    const body = getBody(response);
    expect(body.novelId).toBe('novel-1');
    expect(body.readerReactions).toHaveLength(3);
    expect(body.dimensionScores).toHaveLength(3);
    expect(body.consensus).toEqual({
      status: 'pending',
      message: 'Consensus not yet generated',
    });
    expect(body.editorialAnalysis).toHaveProperty('recommendations');
    expect(getAnalysisResultCache().has('novel-1')).toBe(true);
  });

  it('supports custom personas in analysis requests', async () => {
    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        body: {
          name: 'Fast Reader',
          parameters: {
            plotWeight: 0.9,
            pacingWeight: 0.95,
            focusAreas: ['tempo'],
            biases: ['prefers momentum'],
          },
        },
      }),
    );
    expect(created.statusCode).toBe(201);
    const personaId = getBody(created).persona.id as string;

    const analyzed = await rsAnalyzeEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-custom',
          personaIds: [personaId],
        },
      }),
    );
    expect(analyzed.statusCode).toBe(200);
    expect(getBody(analyzed).readerReactions).toHaveLength(1);
    expect(getBody(analyzed).dimensionScores).toHaveLength(1);
    expect(getBody(analyzed).readerReactions[0].personaId).toBe(personaId);
  });

  it('returns server errors when a requested persona cannot be resolved', async () => {
    const response = await rsAnalyzeEndpoint(
      mockRequest({
        body: {
          novelId: 'novel-1',
          personaIds: ['missing-persona'],
        },
      }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response).error).toBe('Persona not found: missing-persona');
  });

  it('lists preset and custom personas together', async () => {
    const initial = await rsGetPersonasEndpoint(mockRequest({ method: 'GET' }));
    expect(initial.statusCode).toBe(200);
    expect(getBody(initial).totalPresetCount).toBe(3);
    expect(getBody(initial).totalCustomCount).toBe(0);

    await rsCreateCustomPersonaEndpoint(
      mockRequest({
        body: {
          name: 'Detail Reader',
          parameters: {
            styleWeight: 0.8,
            focusAreas: ['clarity'],
          },
        },
      }),
    );

    const listed = await rsGetPersonasEndpoint(mockRequest({ method: 'GET' }));
    expect(listed.statusCode).toBe(200);
    expect(getBody(listed).presets).toHaveLength(3);
    expect(getBody(listed).custom).toHaveLength(1);
    expect(getBody(listed).totalCustomCount).toBe(1);
    expect(getBody(listed).custom[0]).toMatchObject({
      name: 'Detail Reader',
      type: 'custom',
    });
  });

  it('validates and creates custom personas with defaults', async () => {
    const missingName = await rsCreateCustomPersonaEndpoint(
      mockRequest({ body: { parameters: {} } }),
    );
    expect(missingName.statusCode).toBe(400);
    expect(getBody(missingName).error).toBe('name is required and must be a string');

    const invalidParameters = await rsCreateCustomPersonaEndpoint(
      mockRequest({ body: { name: 'Bad', parameters: [] } as any }),
    );
    expect(invalidParameters.statusCode).toBe(400);
    expect(getBody(invalidParameters).error).toBe('parameters is required and must be an object');

    const invalidNumeric = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        body: {
          name: 'Bad Number',
          parameters: { plotWeight: 'high' },
        } as any,
      }),
    );
    expect(invalidNumeric.statusCode).toBe(400);
    expect(getBody(invalidNumeric).error).toBe('parameters.plotWeight must be a number');

    const invalidArray = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        body: {
          name: 'Bad Array',
          parameters: { focusAreas: 'clarity' },
        } as any,
      }),
    );
    expect(invalidArray.statusCode).toBe(400);
    expect(getBody(invalidArray).error).toBe('parameters.focusAreas must be an array');

    const created = await rsCreateCustomPersonaEndpoint(
      mockRequest({
        body: {
          name: 'Balanced Reader',
          parameters: {
            characterWeight: 0.9,
          },
        },
      }),
    );
    expect(created.statusCode).toBe(201);
    expect(getBody(created).persona).toMatchObject({
      id: expect.stringMatching(/^custom-/),
      name: 'Balanced Reader',
      type: 'custom',
      parameters: {
        plotWeight: 0.5,
        characterWeight: 0.9,
        styleWeight: 0.5,
        pacingWeight: 0.5,
        toleranceThreshold: 0.5,
        focusAreas: [],
        biases: [],
      },
    });
    expect(getCustomPersonaStore().size).toBe(1);
  });

  it('validates overlay requests and returns an empty response before analysis', async () => {
    const missingNovelId = await rsGetOverlayEndpoint(mockRequest({ body: {} }));
    expect(missingNovelId.statusCode).toBe(400);
    expect(getBody(missingNovelId).error).toBe('novelId is required and must be a string');

    const empty = await rsGetOverlayEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );
    expect(empty.statusCode).toBe(200);
    expect(getBody(empty)).toEqual({
      novelId: 'novel-1',
      markers: [],
      markerCount: 0,
      message: 'No analysis result found. Run /reader/analyze first.',
    });
  });

  it('builds overlay markers from cached reader reactions', async () => {
    const cached: DualEngineResult = {
      readerReactions: [
        {
          personaId: 'preset-general-reader',
          personaName: 'General Reader',
          dimensions: {},
          highlights: [
            {
              text: 'The hallway fell silent.',
              position: { chapter: 'chapter-1', paragraph: 2 },
              reaction: 'negative',
              comment: 'Needs stronger tension.',
              dimension: 'pacing-tension',
            },
            {
              text: 'She hesitated at the door.',
              position: { chapter: 'chapter-1', paragraph: 3 },
              reaction: 'neutral',
              comment: 'Character intent could be clearer.',
              dimension: 'character-consistency',
            },
          ],
          overallScore: 0.62,
        },
      ],
      editorialAnalysis: {
        structuralIssues: [],
        styleNotes: [],
        pacingAssessment: 'steady',
        recommendations: [],
      },
      timestamp: '2026-06-04T12:00:00.000Z',
    };
    getAnalysisResultCache().set('novel-1', cached);

    const response = await rsGetOverlayEndpoint(
      mockRequest({ body: { novelId: 'novel-1' } }),
    );
    expect(response.statusCode).toBe(200);
    expect(getBody(response)).toEqual({
      novelId: 'novel-1',
      markers: [
        {
          personaId: 'preset-general-reader',
          personaName: 'General Reader',
          position: { chapter: 'chapter-1', paragraph: 2 },
          reaction: 'negative',
          comment: 'Needs stronger tension.',
          dimension: 'pacing-tension',
          text: 'The hallway fell silent.',
        },
        {
          personaId: 'preset-general-reader',
          personaName: 'General Reader',
          position: { chapter: 'chapter-1', paragraph: 3 },
          reaction: 'neutral',
          comment: 'Character intent could be clearer.',
          dimension: 'character-consistency',
          text: 'She hesitated at the door.',
        },
      ],
      markerCount: 2,
      analysisTimestamp: '2026-06-04T12:00:00.000Z',
    });
  });

  it('clears custom persona and analysis caches', async () => {
    await rsCreateCustomPersonaEndpoint(
      mockRequest({
        body: {
          name: 'Resettable',
          parameters: {},
        },
      }),
    );
    getAnalysisResultCache().set('novel-1', {
      readerReactions: [],
      editorialAnalysis: {
        structuralIssues: [],
        styleNotes: [],
        pacingAssessment: 'steady',
        recommendations: [],
      },
      timestamp: '2026-06-04T12:00:00.000Z',
    });

    expect(getCustomPersonaStore().size).toBe(1);
    expect(getAnalysisResultCache().size).toBe(1);

    clearReaderStores();

    expect(getCustomPersonaStore().size).toBe(0);
    expect(getAnalysisResultCache().size).toBe(0);
  });
});
