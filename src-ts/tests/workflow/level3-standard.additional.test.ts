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

describe('workflow/level3-standard additional coverage', () => {
  it('approves when score reaches pass threshold even if critic still requests revision', () => {
    const architect = {
      run: vi.fn().mockReturnValue(createPlanResult()),
    };
    const writer = {
      run: vi.fn().mockReturnValue({ content: 'draft-at-threshold' }),
    };
    const critic = {
      run: vi.fn().mockReturnValue({
        score: 80,
        decision: 'REVISE',
        feedback: 'minor polish',
      }),
    };

    const standard = new Level3Standard({
      architect,
      writer,
      critic,
    });

    const result = standard.execute({
      user_request: 'execute standard mode',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.decision).toBe('APPROVED');
    expect(result.score).toBe(80);
    expect(result.revision_count).toBeUndefined();
  });

  it('requires human intervention after revisions are exhausted without approval', () => {
    const architect = {
      run: vi.fn().mockReturnValue(createPlanResult()),
    };
    const writer = {
      run: vi.fn().mockReturnValue({ content: 'still-not-good-enough' }),
    };
    const critic = {
      run: vi.fn().mockReturnValue({
        score: 40,
        decision: 'REVISE',
        feedback: 'needs more work',
      }),
    };

    const standard = new Level3Standard({
      architect,
      writer,
      critic,
      config: {
        max_revisions: 1,
      },
    });

    const result = standard.execute({
      user_request: 'execute standard mode',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    expect(result.revision_count).toBe(1);
    expect(result.requires_human_intervention).toBe(true);
  });

  it('records planning failures and falls back to default plan phases', () => {
    const standard = new Level3Standard({
      architect: {
        run: vi.fn().mockImplementation(() => {
          throw new Error('architect failed');
        }),
      },
    });

    const result = standard._planPhase({
      user_request: 'plan this change',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.errors).toContain('計劃失敗: architect failed');
    expect(result.plan_phases).toEqual(Level3Standard.PLAN_PHASES);
  });

  it('records execution failures without incrementing draft version', () => {
    const standard = new Level3Standard({
      writer: {
        run: vi.fn().mockImplementation(() => {
          throw new Error('writer failed');
        }),
      },
    });

    const result = standard._executePhase({
      implementation_plan: { steps: ['step-1'] },
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.errors).toContain('執行失敗: writer failed');
    expect(result.draft_version).toBeUndefined();
  });

  it('records critic failures and switches to human review', () => {
    const standard = new Level3Standard({
      critic: {
        run: vi.fn().mockImplementation(() => {
          throw new Error('critic failed');
        }),
      },
    });

    const result = standard._criticPhase({
      draft_content: 'draft',
      implementation_plan: { steps: ['step-1'] },
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.errors).toContain('評估失敗: critic failed');
    expect(result.decision).toBe('HUMAN_REVIEW');
  });

  it('treats non-array phases as valid, but rejects missing plan metadata', () => {
    const standard = new Level3Standard();

    expect(
      standard.planVerify({
        implementation_plan: { steps: [] },
        plan_phases: { output: null },
      } as never).valid,
    ).toBe(true);

    expect(
      standard.planVerify({
        implementation_plan: { steps: [] },
        plan_phases: ['phase-1', { output: 'done' }],
      } as never).valid,
    ).toBe(true);

    expect(
      standard.planVerify({
        plan_phases: [{ output: 'done' }],
      } as never).valid,
    ).toBe(false);

    expect(
      standard.planVerify({
        implementation_plan: { steps: [] },
      } as never).valid,
    ).toBe(false);
  });

  it('falls back to default plan payload when architect returns nullish fields', () => {
    const standard = new Level3Standard({
      architect: {
        run: vi.fn().mockReturnValue({
          phases: null,
          plan: null,
        }),
      },
    });

    const result = standard._planPhase({
      user_request: 'plan fallback',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.plan_phases).toEqual(Level3Standard.PLAN_PHASES);
    expect(result.implementation_plan).toEqual({});
  });

  it('uses default execution and critic fallbacks when agents omit fields', () => {
    const standard = new Level3Standard({
      writer: {
        run: vi.fn().mockReturnValue({}),
      },
      critic: {
        run: vi.fn().mockReturnValue({}),
      },
    });

    const executed = standard._executePhase({
      implementation_plan: { steps: ['step-1'] },
      draft_version: 4,
      errors: [],
    } as never) as Record<string, unknown>;

    expect(executed.draft_content).toBe('');
    expect(executed.draft_version).toBe(5);

    const critiqued = standard._criticPhase({
      ...executed,
      errors: [],
    } as never) as Record<string, unknown>;

    expect(critiqued.score).toBe(0);
    expect(critiqued.decision).toBe('REVISE');
    expect(critiqued.feedback_context).toBe('');
  });

  it('stringifies non-Error exceptions in all internal phases', () => {
    const standard = new Level3Standard({
      architect: {
        run: vi.fn().mockImplementation(() => {
          throw 'architect-string-failure';
        }),
      },
      writer: {
        run: vi.fn().mockImplementation(() => {
          throw 'writer-string-failure';
        }),
      },
      critic: {
        run: vi.fn().mockImplementation(() => {
          throw 'critic-string-failure';
        }),
      },
    });

    const planned = standard._planPhase({
      user_request: 'plan string failure',
      errors: [],
    } as never) as Record<string, unknown>;
    expect(planned.errors).toContain('計劃失敗: architect-string-failure');

    const executed = standard._executePhase({
      implementation_plan: { steps: ['step-1'] },
      errors: [],
    } as never) as Record<string, unknown>;
    expect(executed.errors).toContain('執行失敗: writer-string-failure');

    const critiqued = standard._criticPhase({
      draft_content: 'draft',
      implementation_plan: { steps: ['step-1'] },
      errors: [],
    } as never) as Record<string, unknown>;
    expect(critiqued.errors).toContain('評估失敗: critic-string-failure');
    expect(critiqued.decision).toBe('HUMAN_REVIEW');
  });
});
