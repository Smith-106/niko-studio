import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/reader',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

describe('reader/mcp/reader-endpoints branch-gap additional coverage', () => {
  afterEach(async () => {
    const module = await import('../../reader/mcp/reader-endpoints.js');
    module.clearReaderStores();

    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../reader/DualEngine');
    vi.doUnmock('../../reader/PersonaDefinition');
    vi.doUnmock('../../reader/ConsensusEngine');
    vi.doUnmock('../../services/revision-service');
  });

  it('rsCompareEndpoint serializes non-Error exceptions through catch path (line 982)', async () => {
    // Mock DualEngine to reject with a non-Error value
    vi.doMock('../../reader/DualEngine', () => ({
      DualEngine: class {
        analyze() {
          return Promise.reject('compare-engine-failure'); // non-Error
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsCompareEndpoint(makeRequest({
      novelId: 'novel-compare-fail',
      versionA: { text: 'Some version A text.' },
      versionB: { text: 'Some version B text.' },
    }));

    expect(response.statusCode).toBe(500);
    const body = response.body as any;
    // The non-Error value should be stringified: String('compare-engine-failure') === 'compare-engine-failure'
    expect(body.error).toBe('compare-engine-failure');
  });

  it('rsDeAIEndpoint serializes non-Error exceptions through catch path (line 1083)', async () => {
    // Mock RevisionService to reject with a non-Error value
    vi.doMock('../../services/revision-service', () => ({
      RevisionServiceImpl: class {
        initialize() { return Promise.resolve(); }
        revise() {
          return Promise.reject('deai-failure-string'); // non-Error
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsDeAIEndpoint(makeRequest({
      novelId: 'novel-deai-nonerror',
      text: 'Some text that should trigger the de-AI revision path.',
    }));

    expect(response.statusCode).toBe(500);
    const body = response.body as any;
    expect(body.error).toBe('deai-failure-string');
  });

  it('rsAnalyzeEndpoint serializes non-Error exceptions with text provided (full DualEngine path)', async () => {
    vi.doMock('../../reader/DualEngine', () => ({
      DualEngine: class {
        analyze() {
          return Promise.reject('analyze-failure-string'); // non-Error
        }
      },
    }));

    const module = await import('../../reader/mcp/reader-endpoints.js');
    const response = await module.rsAnalyzeEndpoint(makeRequest({
      novelId: 'novel-analyze-nonerror',
      text: 'Non-empty text to trigger the DualEngine path.',
    }));

    expect(response.statusCode).toBe(500);
    const body = response.body as any;
    expect(body.error).toBe('analyze-failure-string');
  });
});
