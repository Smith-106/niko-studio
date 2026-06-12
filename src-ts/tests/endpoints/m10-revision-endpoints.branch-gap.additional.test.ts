import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const reviseMock = vi.hoisted(() => vi.fn());
const logInfoMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/m10/revision',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

async function loadRevisionModule() {
  vi.resetModules();

  vi.doMock('../../services/revision-service.js', () => ({
    RevisionServiceImpl: vi.fn().mockImplementation(() => ({
      revise: reviseMock,
    })),
  }));

  vi.doMock('../../logger/index.js', () => ({
    createLogger: () => ({
      info: logInfoMock,
      error: logErrorMock,
    }),
  }));

  return import('../../mcp/endpoints/m10-revision.js');
}

describe('m10 revision endpoint branch-gap coverage', () => {
  beforeEach(() => {
    reviseMock.mockReset();
    logInfoMock.mockReset();
    logErrorMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../services/revision-service.js');
    vi.doUnmock('../../logger/index.js');
  });

  it('treats a missing text field the same as an empty request', async () => {
    const { reviseMultiPassEndpoint } = await loadRevisionModule();

    const response = await reviseMultiPassEndpoint(makeRequest({}));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
    expect(reviseMock).not.toHaveBeenCalled();
  });

  it('falls back to zero when the first weak point has no baseline score', async () => {
    reviseMock.mockResolvedValueOnce({
      finalDecision: 'REWRITE',
      finalDraft: 'Retry with stronger structure',
      totalIterations: 1,
      iterations: [{ weakPoints: [{}] }],
      finalScore: 6.2,
      learningInsights: [],
      comparison: { improved: false },
    });

    const { reviseMultiPassEndpoint } = await loadRevisionModule();
    const response = await reviseMultiPassEndpoint(makeRequest({ text: 'Needs another pass' }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      initialScore: 0,
      finalDecision: 'REWRITE',
      reason: 'max_iterations_reached',
    });
  });

  it('extracts the message from thrown Error instances', async () => {
    reviseMock.mockRejectedValueOnce(new Error('backend unavailable'));

    const { reviseMultiPassEndpoint } = await loadRevisionModule();
    const response = await reviseMultiPassEndpoint(makeRequest({ text: 'Trigger error path' }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Revision failed: backend unavailable' });
    expect(logErrorMock).toHaveBeenCalledWith('Multi-pass revision failed: backend unavailable');
  });
});
