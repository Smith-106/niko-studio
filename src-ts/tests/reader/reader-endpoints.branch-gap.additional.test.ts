import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(
  body: Record<string, unknown>,
  params: Record<string, string> = {},
): HttpRequest {
  return {
    method: 'POST',
    url: '/reader',
    headers: {},
    body,
    query: {},
    params,
  };
}

describe('reader/mcp/reader-endpoints branch-gap coverage', () => {
  afterEach(async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    module.clearReaderStores();

    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../reader/DualEngine');
    vi.doUnmock('../../reader/PersonaDefinition');
  });

  it('resolves preset persona ids explicitly when analyze requests include them', async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAnalyzeEndpoint(makeRequest({
      novelId: 'novel-preset',
      personaIds: ['general-reader'],
    }));

    expect(response.statusCode).toBe(200);
    const body = response.body as any;
    expect(body.readerReactions).toHaveLength(1);
    expect(body.readerReactions[0].personaId).toBe('preset-general-reader');
    expect(body.dimensionScores).toHaveLength(1);
  });

  it('serializes non-Error analyze failures through the 500 response path', async () => {
    vi.doMock('../../reader/DualEngine', () => ({
      DualEngine: class {
        analyze() {
          return Promise.reject('plain analyze failure');
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAnalyzeEndpoint(makeRequest({
      novelId: 'novel-failure',
      personaIds: ['general-reader'],
    }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'plain analyze failure' });
  });

  it('serializes create persona failures when the persona factory throws a non-Error value', async () => {
    vi.doMock('../../reader/PersonaDefinition', async () => {
      const actual = await vi.importActual<typeof import('../../reader/PersonaDefinition')>(
        '../../reader/PersonaDefinition',
      );
      return {
        ...actual,
        createCustomPersona: () => {
          throw 'persona factory failed';
        },
      };
    });

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCreateCustomPersonaEndpoint(makeRequest({
      name: 'Broken Persona',
      parameters: {
        plotWeight: 0.5,
        characterWeight: 0.5,
        styleWeight: 0.5,
        pacingWeight: 0.5,
        toleranceThreshold: 0.5,
      },
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'persona factory failed' });
  });

  it('serializes create persona failures when the persona factory throws an Error instance', async () => {
    vi.doMock('../../reader/PersonaDefinition', async () => {
      const actual = await vi.importActual<typeof import('../../reader/PersonaDefinition')>(
        '../../reader/PersonaDefinition',
      );
      return {
        ...actual,
        createCustomPersona: () => {
          throw new Error('persona error object');
        },
      };
    });

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCreateCustomPersonaEndpoint(makeRequest({
      name: 'Broken Persona Error',
      parameters: {
        plotWeight: 0.5,
        characterWeight: 0.5,
        styleWeight: 0.5,
        pacingWeight: 0.5,
        toleranceThreshold: 0.5,
      },
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'persona error object' });
  });
});
