import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const reviseMock = vi.hoisted(() => vi.fn());
const revisionCtorMock = vi.hoisted(() => vi.fn());
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
    RevisionServiceImpl: vi.fn().mockImplementation(function RevisionServiceImpl() {
      revisionCtorMock();
      return {
        revise: reviseMock,
      };
    }),
  }));

  vi.doMock('../../logger/index.js', () => ({
    createLogger: () => ({
      info: logInfoMock,
      error: logErrorMock,
    }),
  }));

  return import('../../mcp/endpoints/m10-revision.js');
}

describe('m10 revision endpoint', () => {
  beforeEach(() => {
    reviseMock.mockReset();
    revisionCtorMock.mockReset();
    logInfoMock.mockReset();
    logErrorMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('../../services/revision-service.js');
    vi.doUnmock('../../logger/index.js');
  });

  it('rejects empty text', async () => {
    const { reviseMultiPassEndpoint } = await loadRevisionModule();

    const response = await reviseMultiPassEndpoint(makeRequest({ text: '   ' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
    expect(reviseMock).not.toHaveBeenCalled();
  });

  it('uses default revision options and reuses the service singleton', async () => {
    reviseMock.mockResolvedValue({
      finalDecision: 'APPROVED',
      finalDraft: 'Revised draft',
      totalIterations: 2,
      iterations: [{ weakPoints: [{ baselineScore: 6.7 }] }],
      finalScore: 9.2,
      learningInsights: ['Keep the tension curve rising.'],
      comparison: { improved: true },
    });

    const { reviseMultiPassEndpoint } = await loadRevisionModule();

    const first = await reviseMultiPassEndpoint(makeRequest({ text: 'Original draft' }));
    const second = await reviseMultiPassEndpoint(makeRequest({ text: 'Second draft' }));

    expect(revisionCtorMock).toHaveBeenCalledTimes(1);
    expect(reviseMock).toHaveBeenNthCalledWith(
      1,
      'Original draft',
      { max_revisions: 5, pass_score: 8 },
      undefined,
    );
    expect(reviseMock).toHaveBeenNthCalledWith(
      2,
      'Second draft',
      { max_revisions: 5, pass_score: 8 },
      undefined,
    );
    expect(first.body).toMatchObject({
      completed: true,
      revisedContent: 'Revised draft',
      iterations: 2,
      initialScore: 6.7,
      finalScore: 9.2,
      finalDecision: 'APPROVED',
      reason: 'quality_threshold_met',
    });
    expect(second.statusCode).toBe(200);
  });

  it('returns human review state and forwards explicit chapter and thresholds', async () => {
    reviseMock.mockResolvedValueOnce({
      finalDecision: 'HUMAN_REVIEW',
      finalDraft: 'Needs editor input',
      totalIterations: 1,
      iterations: [{ weakPoints: [{ baselineScore: 4.5 }] }],
      finalScore: 7.4,
      learningInsights: [],
      comparison: { improved: false },
    });

    const { reviseMultiPassEndpoint } = await loadRevisionModule();
    const response = await reviseMultiPassEndpoint(makeRequest({
      text: 'Needs review',
      target_score: 9.5,
      max_iterations: 3,
      chapter_id: 'chapter-7',
    }));

    expect(reviseMock).toHaveBeenCalledWith(
      'Needs review',
      { max_revisions: 3, pass_score: 9.5 },
      'chapter-7',
    );
    expect(response.body).toMatchObject({
      completed: true,
      finalDecision: 'HUMAN_REVIEW',
      reason: 'human_review_required',
    });
  });

  it('falls back to zero initial score when iteration details are sparse', async () => {
    reviseMock.mockResolvedValueOnce({
      finalDecision: 'REWRITE',
      finalDraft: 'Retry from scratch',
      totalIterations: 0,
      iterations: [],
      finalScore: 5.1,
      learningInsights: [],
      comparison: { improved: false },
    });

    const { reviseMultiPassEndpoint } = await loadRevisionModule();
    const response = await reviseMultiPassEndpoint(makeRequest({ text: 'Sparse iteration data' }));

    expect(response.body).toMatchObject({
      completed: false,
      initialScore: 0,
      finalDecision: 'REWRITE',
      reason: 'max_iterations_reached',
    });
  });

  it('returns a structured 500 when revision fails', async () => {
    reviseMock.mockRejectedValueOnce('service offline');

    const { reviseMultiPassEndpoint } = await loadRevisionModule();
    const response = await reviseMultiPassEndpoint(makeRequest({ text: 'Trigger failure' }));

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: 'Revision failed: service offline' });
    expect(logErrorMock).toHaveBeenCalledWith('Multi-pass revision failed: service offline');
  });
});
