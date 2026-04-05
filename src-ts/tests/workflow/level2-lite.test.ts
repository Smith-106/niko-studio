import { describe, expect, it, vi } from 'vitest';

import { Level2Lite } from '../../workflow/levels/level2-lite';

describe('workflow/level2-lite', () => {
  it('builds lightweight plan results and can extract plan objects from state', () => {
    const lite = new Level2Lite();

    const plan = lite.litePlan('写一个悬疑片段，并突出旧怀表与紧张氛围');
    const extracted = lite.planLiteFromState({
      lite_plan: {
        objective: '写一个悬疑片段',
        key_points: ['旧怀表', '紧张氛围'],
        tone: 'suspense',
        word_count_target: 1200,
      },
    } as never);

    expect(plan.planId).toContain('lite-');
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(plan.confidence).toBeGreaterThan(0);
    expect(extracted).toEqual({
      objective: '写一个悬疑片段',
      keyPoints: ['旧怀表', '紧张氛围'],
      tone: 'suspense',
      wordCountTarget: 1200,
    });
  });

  it('diagnoses lite-fix severity and affected areas deterministically', () => {
    const lite = new Level2Lite();

    const fix = lite.liteFix('crash bug: dialogue logic mismatch and missing state refresh');

    expect(fix.severity).toBe('critical');
    expect(fix.diagnosis.length).toBeGreaterThan(0);
    expect(fix.fixSuggestions.length).toBeGreaterThan(0);
    expect(Array.isArray(fix.affectedAreas)).toBe(true);
  });

  it('executes lite mode with writer and critic seams and auto-approves when verification fails', () => {
    const writer = {
      run: vi.fn().mockReturnValue({
        content: '轻量模式输出',
      }),
    };
    const critic = {
      run: vi.fn().mockReturnValue({
        score: 65,
        decision: 'REVISE',
        feedback: '补强冲突',
      }),
    };
    const container = {
      getAgent: vi
        .fn()
        .mockReturnValueOnce(writer)
        .mockReturnValueOnce(critic),
    };
    const lite = new Level2Lite({}, container as never);

    const executed = lite.execute({
      user_request: '写一个短场景，突出冲突',
      context: '当前在雨夜旧城',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(executed.draft_content).toBe('轻量模式输出');
    expect(executed.decision).toBe('APPROVED');
    expect(executed.revision_count).toBe(1);

    const brokenLite = new Level2Lite({}, {
      getAgent: vi
        .fn()
        .mockReturnValueOnce(writer)
        .mockImplementationOnce(() => {
          throw new Error('critic offline');
        }),
    } as never);

    const fallback = brokenLite.execute({
      user_request: '写一个短场景，突出冲突',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(fallback.decision).toBe('APPROVED');
    expect(fallback.score).toBe(70);
    expect((fallback.errors as string[])[0]).toContain('验证失败');
  });

  it('exposes required agents and default config helpers', () => {
    const lite = new Level2Lite();

    expect(lite.getRequiredAgents()).toEqual(['writer', 'critic']);
    expect(lite.getDefaultConfig()).toMatchObject({
      max_revisions: 1,
      pass_score: 70,
      retrieval_profile: 'lite_low_cost',
    });
  });
});
