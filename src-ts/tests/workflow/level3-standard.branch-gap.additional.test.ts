import { describe, expect, it, vi } from 'vitest';

import { Level3Standard } from '../../workflow/levels/level3-standard.js';

function createPlanResult() {
  return {
    phases: Array.from({ length: 5 }, (_, index) => ({
      phase: index + 1,
      output: `phase-${index + 1}`,
    })),
    plan: {
      steps: ['step-1'],
    },
  };
}

describe('workflow/level3-standard branch-gap coverage', () => {
  it('uses default revision and score thresholds when config overrides are undefined', () => {
    const standard = new Level3Standard({
      architect: {
        run: vi.fn().mockReturnValue(createPlanResult()),
      },
      writer: {
        run: vi.fn().mockReturnValue({ content: 'draft-with-defaults' }),
      },
      critic: {
        run: vi.fn().mockReturnValue({ feedback: 'needs explicit decision' }),
      },
      config: {
        max_revisions: undefined,
        pass_score: undefined,
      },
    });

    const result = standard.execute({
      user_request: 'execute fallback defaults',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    expect(result.revision_count).toBe(3);
    expect(result.requires_human_intervention).toBe(true);
  });

  it('adds a human-review error when execute sees invalid default plan metadata and no prior errors', () => {
    const standard = new Level3Standard({
      architect: {
        run: vi.fn().mockReturnValue({
          phases: null,
          plan: null,
        }),
      },
    });

    const result = standard.execute({
      user_request: 'invalid planning metadata',
    } as never) as Record<string, unknown>;

    expect(result.errors).toContain('計劃驗證失敗');
    expect(result.decision).toBe('HUMAN_REVIEW');
  });

  it('falls back to default plan phases and empty request/context in plan()', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: undefined,
        plan: { steps: [] },
      }),
    };
    const standard = new Level3Standard({ architect });

    const phases = standard.plan({} as never);

    expect(phases).toEqual(Level3Standard.PLAN_PHASES);
    expect(architect.run).toHaveBeenCalledWith({
      user_request: '',
      context: '',
      mode: 'planning',
    });
  });

  it('falls back to static plan phases when the internal plan phase leaves them unset', () => {
    const standard = new Level3Standard();
    const planPhaseSpy = vi.spyOn(standard, '_planPhase').mockImplementation((state) => state);

    const phases = standard.plan({
      user_request: 'missing plan phases',
    } as never);

    expect(phases).toEqual(Level3Standard.PLAN_PHASES);
    expect(planPhaseSpy).toHaveBeenCalled();
  });

  it('uses empty execution defaults and stringifies non-Error writer failures', () => {
    const writer = {
      run: vi.fn().mockImplementation(() => {
        throw 'writer string failure';
      }),
    };
    const standard = new Level3Standard({ writer });

    const result = standard._executePhase({} as never) as Record<string, unknown>;

    expect(writer.run).toHaveBeenCalledWith({
      plan: {},
      context: '',
      feedback: '',
      mode: 'execute',
    });
    expect(result.errors).toContain('執行失敗: writer string failure');
  });

  it('uses empty critic defaults and stringifies non-Error critic failures', () => {
    const critic = {
      run: vi.fn().mockImplementation(() => {
        throw 'critic string failure';
      }),
    };
    const standard = new Level3Standard({ critic });

    const result = standard._criticPhase({} as never) as Record<string, unknown>;

    expect(critic.run).toHaveBeenCalledWith({
      content: '',
      plan: {},
      mode: 'evaluate',
    });
    expect(result.errors).toContain('評估失敗: critic string failure');
    expect(result.decision).toBe('HUMAN_REVIEW');
  });

  it('uses execute-time score and decision fallbacks when the critic phase leaves them unset', () => {
    const standard = new Level3Standard({
      config: {
        max_revisions: 1,
      },
    });

    vi.spyOn(standard, '_planPhase').mockImplementation((state) => ({
      ...(state as Record<string, unknown>),
      implementation_plan: { steps: ['step-1'] },
      plan_phases: createPlanResult().phases,
    }) as never);
    vi.spyOn(standard, '_executePhase').mockImplementation((state) => state);
    vi.spyOn(standard, '_criticPhase').mockImplementation((state) => state);

    const result = standard.execute({
      user_request: 'critic leaves decision unset',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.revision_count).toBe(1);
    expect(result.decision).toBe('HUMAN_REVIEW');
    expect(result.requires_human_intervention).toBe(true);
  });
});
