import { describe, expect, it } from 'vitest';

import { CodeAdapter } from '../../workflow/adapters/code-adapter';

describe('workflow/code-adapter', () => {
  it('creates initial state with merged metadata and resume decision', () => {
    const adapter = new CodeAdapter();

    const state = adapter.createInitialState('修复测试失败', {
      metadata: { source: 'unit-test' },
      resume_decision: { strategy: 'native' },
      custom_flag: true,
    }) as Record<string, unknown>;

    expect(state.user_request).toBe('修复测试失败');
    expect(state.domain).toBe('code');
    expect(state.custom_flag).toBe(true);
    expect(state.metadata).toMatchObject({
      source: 'unit-test',
      resume_decision: { strategy: 'native' },
    });
  });

  it('evaluates passing and blocking code quality gates deterministically', () => {
    const adapter = new CodeAdapter({
      pass_score: 80,
      code_coverage_threshold: 80,
      max_revisions: 2,
    });

    const approved = adapter.evaluate({
      tests_passed: true,
      lint_passed: true,
      build_passed: true,
      coverage: 85,
      revision_count: 0,
      errors: [],
    } as never);

    expect(approved.decision).toBe('APPROVED');
    expect(approved.total_score).toBeGreaterThanOrEqual(80);

    const revise = adapter.evaluate({
      tests_passed: false,
      lint_passed: true,
      build_passed: false,
      coverage: 50,
      revision_count: 1,
      errors: ['runtime error'],
    } as never);

    expect(revise.decision).toBe('REVISE');
    expect(revise.decision_reason).toContain('Blocking checks failed');
    expect(revise.revision_instructions.length).toBeGreaterThan(0);

    const humanReview = adapter.evaluate({
      tests_passed: false,
      lint_passed: false,
      build_passed: false,
      coverage: 30,
      revision_count: 2,
      errors: ['still broken'],
    } as never);

    expect(humanReview.decision).toBe('HUMAN_REVIEW');
  });

  it('creates an executable graph and exposes continue behavior through evaluated state', async () => {
    const adapter = new CodeAdapter();
    const graph = adapter.createGraph();
    const compiled = graph.compile();

    const result = await compiled.invoke(
      adapter.createInitialState('实现一个修复', {
        metadata: {
          quality_signals: {
            tests_passed: true,
            lint_passed: true,
            build_passed: true,
            coverage: 90,
          },
        },
      }) as never,
    );
    const resultAny = result as Record<string, unknown>;

    expect(resultAny.current_step).toBe('finalize');
    expect(resultAny.decision).toBe('APPROVED');
    expect(resultAny.final_output).toContain('Implement request');
    expect(resultAny.requires_human_intervention).toBe(false);
  });
});
