import { afterEach, describe, expect, it, vi } from 'vitest';

import { NovelAdapter } from '../../workflow/adapters/novel-adapter.js';
import type { WritingState } from '../../workflow/novel-state.js';

function createState(
  adapter: NovelAdapter,
  overrides: Partial<WritingState> = {},
): WritingState {
  return {
    ...(adapter.createInitialState('关于林岚在废弃剧院追查失踪案的悬疑故事') as WritingState),
    ...overrides,
  };
}

describe('NovelAdapter branch gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects a human-review critique when the safety stop fires without prior critique payload', async () => {
    const adapter = new NovelAdapter({
      max_revisions: 0,
      enable_distillation: false,
    });

    vi.spyOn(adapter, 'writerNode').mockResolvedValue({
      draft_content: 'looping draft',
      draft_version: 1,
    });
    vi.spyOn(adapter, 'criticNode').mockResolvedValue({
      revision_count: 1,
    });
    vi.spyOn(adapter, 'routeAfterCritic').mockReturnValue('writer');

    const result = await adapter.executePipeline(createState(adapter, {
      critique_result: undefined,
    }));

    expect(result.critique_result).toMatchObject({
      decision: 'HUMAN_REVIEW',
      decision_reason: 'Revision loop safety stop triggered',
    });
    expect(result.requires_human_intervention).toBe(true);
  });

  it('treats high-scoring revise results as a finalize path when score and conflict both clear the gate', () => {
    const adapter = new NovelAdapter({
      enable_context_governance: false,
      pass_score: 90,
      min_c_score: 7,
    });

    const route = adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: {
        decision: 'REVISE',
        total_score: 95,
        lock_analysis: {
          C: { score: 8 },
        },
      },
    }));

    expect(route).toBe('finalize');
  });

  it('falls back when reflection input lacks a confrontation score field', () => {
    const adapter = new NovelAdapter({
      enable_self_learning_loop: true,
      min_c_score: 7,
    });

    const reflection = (adapter as unknown as {
      buildReflectionFromCritic: (
        critiqueResult: Record<string, unknown>,
        revisionCount: number,
        revisionHistory: unknown,
      ) => Record<string, unknown>;
    }).buildReflectionFromCritic(
      {
        decision: 'REVISE',
        total_score: 72,
        actionable_feedback: 'tighten confrontation',
        lock_analysis: {
          L: { score: 6 },
          C: {},
        },
      },
      2,
      [],
    );

    expect(reflection).toMatchObject({
      failure_type: 'revision_required',
      history_size: 0,
    });
    expect(reflection['avoid_next_round']).toContain('Do not weaken confrontation (C) in key beats');
  });

  it('normalizes a non-array playbook rule set before curating new rules', () => {
    const adapter = new NovelAdapter({
      enable_self_learning_loop: true,
      self_learning_max_rules: 2,
    });

    vi.spyOn(adapter as never, 'getSelfLearningState' as never).mockReturnValue({
      reflector: {},
      curator: {},
      playbook: {
        rules: 'bad-rules-shape',
      },
    });

    const curated = (adapter as unknown as {
      curatePlaybookCandidates: (
        state: WritingState,
        critiqueResult: Record<string, unknown>,
        reflection: Record<string, unknown>,
      ) => { curator?: Record<string, unknown>; playbook?: Record<string, unknown> };
    }).curatePlaybookCandidates(
      createState(adapter),
      {
        actionable_feedback: '',
      },
      {
        avoid_next_round: ['Keep clues grounded'],
      },
    );

    expect(curated.curator).toMatchObject({
      applied: true,
      rule_count: 1,
      added: 1,
    });
    expect(curated.playbook).toMatchObject({
      rules: ['Keep clues grounded'],
    });
  });

  it('passes context governance when governance checks are enabled but no governance payload exists', () => {
    const adapter = new NovelAdapter({
      enable_context_governance: true,
      min_retrieval_hit_rate: 0.7,
      min_context_budget_utilization: 0.6,
    });

    const passed = (adapter as unknown as {
      contextGovernancePassed: (state: WritingState) => boolean;
    }).contextGovernancePassed(createState(adapter, {
      context_governance: undefined,
    }));

    expect(passed).toBe(true);
  });
});
