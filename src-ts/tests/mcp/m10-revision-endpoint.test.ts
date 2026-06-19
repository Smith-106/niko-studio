import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HttpRequest } from '../../mcp/http-types.js';

const mockRevise = vi.fn();

vi.mock('../../services/revision-service.js', () => {
  return {
    RevisionServiceImpl: vi.fn().mockImplementation(() => ({
      revise: mockRevise,
    })),
  };
});

function makeRequest(body: Record<string, unknown>): HttpRequest {
  return {
    method: 'POST',
    url: '/m10/revision/multi-pass',
    headers: {},
    body,
    query: {},
    params: {},
  };
}

function makeRevisionCycleResult(overrides: Partial<{
  finalDecision: string;
  finalScore: number;
  totalIterations: number;
  finalDraft: string;
  learningInsights: unknown[];
  comparison: unknown;
  baselineScore: number;
}> = {}) {
  return {
    sessionId: 'test-session',
    finalDraft: overrides.finalDraft ?? 'revised text',
    finalDecision: overrides.finalDecision ?? 'APPROVED',
    finalScore: overrides.finalScore ?? 8.5,
    totalIterations: overrides.totalIterations ?? 2,
    iterations: [
      {
        iterationNumber: 1,
        analyzedAt: '2026-01-01T00:00:00Z',
        weakPoints: [
          { baselineScore: overrides.baselineScore ?? 5.0 },
        ],
        suggestions: [],
      },
    ],
    learningInsights: overrides.learningInsights ?? [],
    comparison: overrides.comparison ?? undefined,
  };
}

describe('m10-revision endpoint', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 400 when text is empty', async () => {
    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(makeRequest({ text: '' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('returns 400 when text is only whitespace', async () => {
    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(makeRequest({ text: '   ' }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'text is required' });
  });

  it('returns completed=true and reason=quality_threshold_met when APPROVED', async () => {
    mockRevise.mockResolvedValueOnce(makeRevisionCycleResult({
      finalDecision: 'APPROVED',
      finalScore: 8.5,
      totalIterations: 2,
    }));

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Some text to revise', target_score: 8.0 }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.completed).toBe(true);
    expect(body.reason).toBe('quality_threshold_met');
    expect(body.finalDecision).toBe('APPROVED');
    expect(body.revisedContent).toBe('revised text');
    expect(body.iterations).toBe(2);
    expect(body.finalScore).toBe(8.5);
    expect(body.initialScore).toBe(5.0);
  });

  it('returns completed=true and reason=human_review_required when HUMAN_REVIEW', async () => {
    mockRevise.mockResolvedValueOnce(makeRevisionCycleResult({
      finalDecision: 'HUMAN_REVIEW',
      finalScore: 6.0,
      totalIterations: 3,
    }));

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Text needing human review', max_iterations: 3 }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.completed).toBe(true);
    expect(body.reason).toBe('human_review_required');
    expect(body.finalDecision).toBe('HUMAN_REVIEW');
  });

  it('returns completed=false when max_iterations_reached (REVISE decision)', async () => {
    mockRevise.mockResolvedValueOnce(makeRevisionCycleResult({
      finalDecision: 'REVISE',
      finalScore: 5.5,
      totalIterations: 5,
    }));

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Stubborn text', max_iterations: 5 }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.completed).toBe(false);
    expect(body.reason).toBe('max_iterations_reached');
  });

  it('returns completed=false when REWRITE decision (max_iterations_reached)', async () => {
    mockRevise.mockResolvedValueOnce(makeRevisionCycleResult({
      finalDecision: 'REWRITE',
      finalScore: 3.0,
      totalIterations: 5,
    }));

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Bad text' }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.completed).toBe(false);
    expect(body.reason).toBe('max_iterations_reached');
  });

  it('returns 500 when service.revise throws', async () => {
    mockRevise.mockRejectedValueOnce(new Error('LLM service unavailable'));

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Some text' }),
    );

    expect(response.statusCode).toBe(500);
    const body = response.body as Record<string, unknown>;
    expect(body.error).toContain('Revision failed');
    expect(body.error).toContain('LLM service unavailable');
  });

  it('passes chapter_id and config options to service.revise', async () => {
    mockRevise.mockResolvedValueOnce(makeRevisionCycleResult());

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    await reviseMultiPassEndpoint(
      makeRequest({
        text: 'Chapter text',
        target_score: 9.0,
        max_iterations: 3,
        chapter_id: 'ch-001',
      }),
    );

    expect(mockRevise).toHaveBeenCalledWith(
      'Chapter text',
      { max_revisions: 3, pass_score: 9.0 },
      'ch-001',
    );
  });

  it('returns 0 initialScore when iterations array is empty', async () => {
    mockRevise.mockResolvedValueOnce({
      sessionId: 'test-session',
      finalDraft: 'revised text',
      finalDecision: 'APPROVED',
      finalScore: 9.0,
      totalIterations: 0,
      iterations: [],
      learningInsights: [],
    });

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Perfect text' }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.initialScore).toBe(0);
  });

  it('includes learningInsights and comparison in response when present', async () => {
    const learningInsights = [{ dimensionId: 'coherence', averageDelta: 1.2 }];
    const comparison = { overallDelta: 2.5 };

    mockRevise.mockResolvedValueOnce(makeRevisionCycleResult({
      finalDecision: 'APPROVED',
      learningInsights,
      comparison,
    }));

    const { reviseMultiPassEndpoint } = await import('../../mcp/endpoints/m10-revision.js');

    const response = await reviseMultiPassEndpoint(
      makeRequest({ text: 'Detailed text' }),
    );

    expect(response.statusCode).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(body.learningInsights).toEqual(learningInsights);
    expect(body.comparison).toEqual(comparison);
  });
});
