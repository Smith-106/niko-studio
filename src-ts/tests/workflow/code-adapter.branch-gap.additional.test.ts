import { describe, expect, it } from 'vitest';

import { CodeAdapter } from '../../workflow/adapters/code-adapter';

type CodeAdapterWhiteBox = CodeAdapter & {
  _plannerNode(state: Record<string, unknown>): Promise<Record<string, unknown>>;
  _coderNode(state: Record<string, unknown>): Promise<Record<string, unknown>>;
  _evaluatorNode(state: Record<string, unknown>): Promise<Record<string, unknown>>;
  _finalizeNode(state: Record<string, unknown>): Promise<Record<string, unknown>>;
};

describe('workflow/code-adapter branch-gap coverage', () => {
  it('falls back to empty metadata when creating initial state without metadata', () => {
    const adapter = new CodeAdapter();

    const state = adapter.createInitialState('fill metadata fallback', {
      metadata: null as never,
      custom_flag: 'kept',
    }) as Record<string, unknown>;

    expect(state.metadata).toEqual({});
    expect(state.custom_flag).toBe('kept');
  });

  it('treats missing errors and revision count as defaults and ignores invalid coverage strings', () => {
    const adapter = new CodeAdapter({
      pass_score: 80,
      code_coverage_threshold: 80,
      max_revisions: 2,
    });

    const result = adapter.evaluate({
      metadata: {
        coverage: 'not-a-number',
      },
    } as never);

    expect(result.decision).toBe('REVISE');
    expect(result.decision_reason).toContain('below pass score');
    expect(result.feedback).toContain('coverage=null');
  });

  it('uses planner and coder fallbacks when request, metadata, and iteration count are missing', async () => {
    const adapter = new CodeAdapter() as CodeAdapterWhiteBox;

    const planned = await adapter._plannerNode({});
    expect(planned.current_step).toBe('planner');
    expect(planned.context).toBe('Code task: ');
    expect(planned.implementation_plan).toHaveLength(4);

    const coded = await adapter._coderNode({});
    expect(coded.current_step).toBe('coder');
    expect(coded.draft_content).toBe('Implement request: ');
    expect(coded.iteration_count).toBe(1);
  });

  it('adds quality assessment metadata even when evaluator state metadata is missing', async () => {
    const adapter = new CodeAdapter() as CodeAdapterWhiteBox;

    const evaluated = await adapter._evaluatorNode({});

    expect(evaluated.current_step).toBe('evaluator');
    expect((evaluated.metadata as Record<string, unknown>).quality_assessment).toMatchObject({
      total_score: evaluated.score,
    });
  });

  it('falls back to revise output defaults when finalize receives no decision or final output', async () => {
    const adapter = new CodeAdapter() as CodeAdapterWhiteBox;

    const finalized = await adapter._finalizeNode({});

    expect(finalized.current_step).toBe('finalize');
    expect(finalized.requires_human_intervention).toBe(false);
    expect(finalized.final_output).toBe('');
  });

  it('falls back to empty approved output when finalize has no draft content', async () => {
    const adapter = new CodeAdapter() as CodeAdapterWhiteBox;

    const finalized = await adapter._finalizeNode({
      decision: 'APPROVED',
    });

    expect(finalized.current_step).toBe('finalize');
    expect(finalized.final_output).toBe('');
  });
});
