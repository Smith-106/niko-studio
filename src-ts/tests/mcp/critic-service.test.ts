import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mcp critic service', () => {
  afterEach(() => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    vi.resetModules();
    vi.doUnmock('../../narrative/evaluators/critic-engine.js');
  });

  it('evaluates content through the real narrative critic engine bridge', async () => {
    const { evaluateContent } = await import('../../mcp/services/critic.js');

    const result = await evaluateContent(
      '林岚擅长追踪细节，却又害怕再次判断失误。因为她执意追查，所以真相反而更靠近；讽刺的是，她最信任的人偏偏在误导她。',
      { scene_id: 'SC-1' },
      ['logic'],
      { coherence: 80 },
    );

    expect(result.total_score).toBeGreaterThan(0);
    expect(['APPROVED', 'REVISE', 'REWRITE']).toContain(result.decision);
    expect(result.actionable_feedback.length).toBeGreaterThan(0);
  });

  it('returns structured suggestions and version comparison', async () => {
    const { getImprovementSuggestions, compareVersions } = await import('../../mcp/services/critic.js');

    const suggestions = await getImprovementSuggestions(
      '她突然站起。突然回头。突然又沉默。',
      ['空泛'],
      3,
    );
    const comparison = await compareVersions(
      '她突然站起。突然回头。突然又沉默。',
      '林岚擅长追踪细节，因为她知道每个脚步声都可能暴露真相。',
    );

    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(comparison).toHaveProperty('score_delta');
    expect(comparison).toHaveProperty('improved');
  });

  it('gracefully normalizes sparse critic reports from the narrative engine', async () => {
    vi.doMock('../../narrative/evaluators/critic-engine.js', () => ({
      CriticEngine: class {
        async evaluate() {
          return {
            total_score: 72.44,
            overallScore: 72.44,
            summary: 'keep pacing',
            recommendedSkills: 'not-an-array',
            criticalIssues: null,
            allIssues: ['loose thread'],
          };
        }

        async quickScan() {
          throw new Error('quickScan not used in this test');
        }
      },
    }));

    const { evaluateContent } = await import('../../mcp/services/critic.js');
    const result = await evaluateContent('legacy payload');

    expect(result).toEqual({
      decision: 'REVISE',
      total_score: 72.4,
      lock_score: 0,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'keep pacing',
      suggestions: [],
    });
  });
});
