import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest, HttpResponse } from '../../mcp/http-types.js';
import { createDefaultCreativityConfig } from '../../quality/types.js';

function mockRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/qc',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function getBody(response: HttpResponse) {
  return response.body as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock('../../logger');
});

describe('knowledge/mcp/qc-endpoints branch-gap coverage', () => {
  it('reuses cached validations for long texts that require hashed cache keys', async () => {
    const {
      clearValidationCache,
      qcValidateOutputEndpoint,
    } = await import('../../knowledge/mcp/qc-endpoints.js');

    clearValidationCache();
    const longText = `${'A'.repeat(140)}. ${'B'.repeat(40)}.`;

    const first = await qcValidateOutputEndpoint(
      mockRequest({ text: longText, mode: 'auto' }),
    );
    const second = await qcValidateOutputEndpoint(
      mockRequest({ text: longText, mode: 'auto' }),
    );

    expect(first.statusCode).toBe(200);
    expect(getBody(first).cached).toBeUndefined();
    expect(second.statusCode).toBe(200);
    expect(getBody(second).cached).toBe(true);
  });

  it('returns a default creativity config when preset is omitted', async () => {
    const { qcGetCreativityConfigEndpoint } = await import('../../knowledge/mcp/qc-endpoints.js');

    const response = await qcGetCreativityConfigEndpoint(
      mockRequest({ mode: 'guided' }),
    );

    expect(response.statusCode).toBe(200);
    expect(getBody(response).config).toEqual(
      createDefaultCreativityConfig('guided'),
    );
  });

  it('returns 500 when validation throws inside the endpoint try block', async () => {
    vi.doMock('../../logger', () => ({
      createLogger: () => ({
        info: vi.fn(() => {
          throw new Error('logger boom');
        }),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }));

    const { qcValidateOutputEndpoint } = await import('../../knowledge/mcp/qc-endpoints.js');

    const response = await qcValidateOutputEndpoint(
      mockRequest({ text: 'Valid short text.', mode: 'auto' }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response)).toEqual({ error: 'logger boom' });
  });

  it('stringifies non-Error failures thrown during validation logging', async () => {
    vi.doMock('../../logger', () => ({
      createLogger: () => ({
        info: vi.fn(() => {
          throw 'logger string boom';
        }),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }));

    const { qcValidateOutputEndpoint } = await import('../../knowledge/mcp/qc-endpoints.js');

    const response = await qcValidateOutputEndpoint(
      mockRequest({ text: 'Valid short text.', mode: 'auto' }),
    );

    expect(response.statusCode).toBe(500);
    expect(getBody(response)).toEqual({ error: 'logger string boom' });
  });
});
