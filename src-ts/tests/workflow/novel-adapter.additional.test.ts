import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdapterRegistry } from '../../workflow/adapters/base-adapter.js';
import { NovelAdapter } from '../../workflow/adapters/novel-adapter.js';
import * as novelQuality from '../../workflow/novel-quality.js';
import { SessionManager } from '../../workflow/session/session-manager.js';
import type { CritiqueResult, WritingState } from '../../workflow/novel-state.js';

function createState(
  adapter: NovelAdapter,
  overrides: Partial<WritingState> = {},
): WritingState {
  return {
    ...(adapter.createInitialState('关于林岚在废弃剧院追查失踪案的悬疑故事') as WritingState),
    ...overrides,
  };
}

function createCritique(
  overrides: Partial<CritiqueResult> = {},
): CritiqueResult {
  return {
    decision: 'REVISE',
    decision_reason: 'needs work',
    total_score: 72,
    actionable_feedback: 'tighten the scene conflict',
    revision_instructions: [],
    lock_analysis: {
      L: { score: 8 },
      O: { score: 8 },
      C: { score: 6 },
      K: { score: 7 },
    },
    ...overrides,
  };
}

function unsetConfig(adapter: NovelAdapter): void {
  (adapter as unknown as { config?: unknown }).config = undefined;
}

describe('NovelAdapter additional coverage', () => {
  beforeEach(() => {
    vi.spyOn(SessionManager.prototype, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes domain metadata, registry capabilities, and base evaluation helpers', async () => {
    const adapter = new NovelAdapter({});
    const StateClass = adapter.getStateClass();
    const graph = adapter.createGraph();
    const evaluated = adapter.evaluate({
      critique_result: {
        decision: 'APPROVED',
        decision_reason: 'ready',
        total_score: 88,
        actionable_feedback: 'ship it',
        revision_instructions: [{ id: 'r1', type: 'tone' }],
        lock_analysis: {
          scores: {
            tone: 9,
            causality: 8,
          },
        },
      },
    } as unknown as WritingState);

    expect(adapter.getDomainType()).toBe('novel');
    expect(typeof StateClass).toBe('function');
    expect(new StateClass()).toBeInstanceOf(StateClass);

    graph.addNode('writer', async (state) => state);
    graph.addEdge('writer', 'critic');
    graph.addConditionalEdge('critic', () => 'finalize', { finalize: 'finalize' });
    await expect(
      graph.compile().invoke(createState(adapter) as Record<string, unknown>),
    ).resolves.toMatchObject({
      user_idea: '关于林岚在废弃剧院追查失踪案的悬疑故事',
    });

    expect(evaluated).toEqual({
      decision: 'APPROVED',
      decision_reason: 'ready',
      total_score: 88,
      dimension_scores: {
        tone: 9,
        causality: 8,
      },
      feedback: 'ship it',
      revision_instructions: [{ id: 'r1', type: 'tone' }],
    });
    expect(AdapterRegistry.get('novel')).toBe(NovelAdapter);
    expect(AdapterRegistry.getCapabilities('novel')).toEqual([
      'cli-exposed',
      'memory-aware',
      'strict-governance',
    ]);
  });

  it('falls back to default values when state and workflow configuration are sparse', async () => {
    const adapter = new NovelAdapter({});
    const created = adapter.createInitialState('fallback request', {
      workflow_level: Number.NaN,
    }) as WritingState & { workflow_level?: number };
    const evaluated = adapter.evaluate({} as WritingState);
    const routed = await adapter.commanderNode({} as WritingState);

    expect(created.workflow_level).toBe(3);
    expect(evaluated).toEqual({
      decision: 'REVISE',
      decision_reason: '',
      total_score: 0,
      dimension_scores: {},
      feedback: '',
      revision_instructions: [],
    });
    expect(routed).toMatchObject({
      workflow_level: 3,
      metadata: {
        workflow_level: 'standard',
      },
    });
  });

  it('forces human review when the revision loop safety stop is triggered', async () => {
    const adapter = new NovelAdapter({
      max_revisions: 0,
      enable_distillation: false,
    });
    vi.spyOn(adapter, 'writerNode').mockResolvedValue({
      draft_content: 'looping draft',
      draft_version: 1,
    });
    vi.spyOn(adapter, 'criticNode').mockResolvedValue({
      critique_result: createCritique({
        decision: 'REVISE',
        total_score: 10,
      }),
      revision_count: 1,
    });
    vi.spyOn(adapter, 'routeAfterCritic').mockReturnValue('writer');

    const result = await adapter.executePipeline(createState(adapter));

    expect(result.critique_result?.decision).toBe('HUMAN_REVIEW');
    expect(result.critique_result?.decision_reason).toBe(
      'Revision loop safety stop triggered',
    );
    expect(result.requires_human_intervention).toBe(true);
    expect(result.final_content).toBe('looping draft');
  });

  it('enriches critic output with self-learning state and checkpoint persistence', async () => {
    const adapter = new NovelAdapter({
      enable_self_learning_loop: true,
      self_learning_curate_every_n_revisions: 1,
      self_learning_max_rules: 2,
    });
    const state = createState(adapter, {
      session_id: 'session-1',
      revision_count: 1,
      draft_version: 1,
      draft_content: 'Suddenly. Suddenly. Suddenly. The scene repeats with no grounding.',
      current_scene: {
        scene_id: 'CH01-SC01',
        objective: 'find the missing clue',
        conflict: 'the evidence points at the wrong suspect',
      },
      self_learning: {
        playbook: {
          rules: ['Keep sensory detail anchored'],
        },
      },
    });

    const result = await adapter.criticNode(state);
    const selfLearning = (result as Record<string, unknown>).self_learning as Record<string, unknown>;
    const playbook = selfLearning.playbook as Record<string, unknown>;
    const curator = selfLearning.curator as Record<string, unknown>;
    const reflector = selfLearning.reflector as Record<string, unknown>;

    expect(SessionManager.prototype.write).toHaveBeenCalledTimes(1);
    expect(reflector.triggered).toBe(true);
    expect(curator.applied).toBe(true);
    expect(Array.isArray(playbook.rules)).toBe(true);
    expect((playbook.rules as unknown[]).length).toBeLessThanOrEqual(2);
    expect(result.feedback_artifacts?.length).toBeGreaterThan(0);
    expect(result.last_checkpoint_id).toContain('revision-round-');
  });

  it('swallows self-learning and checkpoint persistence failures in criticNode', async () => {
    const adapter = new NovelAdapter({
      enable_self_learning_loop: true,
    });
    vi.spyOn(adapter as never, 'getSelfLearningState' as never).mockImplementation(() => {
      throw new Error('self-learning exploded');
    });
    vi.spyOn(SessionManager.prototype, 'write').mockImplementation(() => {
      throw new Error('checkpoint exploded');
    });

    const result = await adapter.criticNode(createState(adapter, {
      session_id: 'session-2',
      draft_version: 1,
      draft_content: 'A brittle draft still needs to return critique output.',
      current_scene: {
        scene_id: 'CH01-SC02',
        objective: 'escape the trap',
      },
    }));

    expect(result.critique_result?.decision).toBeTruthy();
    expect((result as Record<string, unknown>).self_learning).toBeUndefined();
  });

  it('uses writer, architect, distillation, human review, and finalize fallbacks for sparse state', async () => {
    const adapter = new NovelAdapter({});
    vi.spyOn(adapter as never, 'buildSceneCards' as never).mockReturnValueOnce([]);

    const architect = await adapter.architectNode({} as WritingState);
    const writer = await adapter.writerNode({} as WritingState);
    const distillation = await adapter.distillationNode({} as WritingState);
    const humanReview = adapter.humanReviewNode({} as WritingState);
    const finalized = adapter.finalizeNode({} as WritingState);

    expect(architect).toMatchObject({
      story_blueprint: {
        central_conflict: '',
        target_chapters: 30,
      },
      scene_cards: [],
      current_scene: {},
      revision_count: 0,
      draft_version: 0,
    });
    expect(writer.draft_version).toBe(1);
    expect(writer.draft_wordcount).toBeGreaterThan(0);
    expect(writer.draft_content).toContain('[Draft v1]');

    const distillationResult = distillation.distillation_result as Record<string, unknown>;
    const canonicalEntities = distillationResult.canonical_entities as Array<Record<string, unknown>>;
    const canonicalRelations = distillationResult.canonical_relations as Array<Record<string, unknown>>;
    expect(distillationResult.scene_id).toBe('CH01-SC01');
    expect(distillationResult.summary).toBe('');
    expect(canonicalEntities[0]).toMatchObject({
      entity_id: 'scene:CH01-SC01:protagonist',
    });
    expect(canonicalEntities[1]).toMatchObject({
      attributes: {
        plot_beat: '',
      },
    });
    expect(canonicalRelations[0]).toMatchObject({
      attributes: {
        conflict: '',
      },
    });

    expect(humanReview).toEqual({
      requires_human_intervention: true,
      metadata: {
        human_review_status: 'review_required',
        human_review_notes: '',
      },
      final_content: '',
      final_score: 0,
    });
    expect(finalized).toEqual({
      final_content: '',
      final_score: 0,
    });
  });

  it('falls back through critic defaults when quality output is sparse', async () => {
    const adapter = new NovelAdapter({});
    vi.spyOn(novelQuality, 'evaluateNovelQuality').mockReturnValue({
      quality_score: 88,
      publish_recommendation: 'pass',
      metrics: {},
      issues: [{}],
    } as never);

    const result = await adapter.criticNode({} as WritingState);

    expect(result.critique_result).toMatchObject({
      decision: 'APPROVED',
      decision_reason: 'quality=88; recommendation=pass',
      total_score: 88,
      lock_score: 28,
      style_score: 0,
      logic_score: 0,
      actionable_feedback: 'revise content',
      revision_instructions: [
        {
          id: 'issue-1',
          type: 'quality',
          suggestion: 'revise content',
          severity: 'medium',
        },
      ],
    });
    expect(result.revision_count).toBe(1);
    expect(result.revision_history).toEqual([
      {
        version: 1,
        score: 88,
        decision: 'APPROVED',
        feedback: 'revise content',
      },
    ]);
    expect(result.checkpoint_trace).toEqual([
      {
        checkpoint_id: 'revision-round-1',
        round_identifier: 'round-1',
        step_id: 'round-1',
        stage: 'critic',
      },
    ]);
    expect(result.last_checkpoint_id).toBe('revision-round-1');
  });

  it('routes writer and critic transitions across governance, review, and retry branches', () => {
    const adapter = new NovelAdapter({
      enable_distillation: true,
      enable_context_governance: true,
      pass_score: 90,
      min_c_score: 7,
      human_review_score: 80,
      max_revisions: 2,
      min_retrieval_hit_rate: 0.7,
      min_context_budget_utilization: 0.5,
    });

    expect(adapter.routeAfterWriter(createState(adapter, {
      draft_content: 'draft ready',
    }))).toBe('distillation');
    expect(adapter.routeAfterWriter(createState(adapter, {
      draft_content: 'draft ready',
      distillation_result: { template: 'full' },
    }))).toBe('critic');
    expect(adapter.routeAfterWriter(createState(adapter))).toBe('critic');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: createCritique({
        decision: 'APPROVED',
        total_score: 95,
        lock_analysis: { C: { score: 8 } },
      }),
      context_governance: {
        passed: true,
      },
    }))).toBe('finalize');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: createCritique({
        decision: 'APPROVED',
        total_score: 95,
        lock_analysis: { C: { score: 8 } },
      }),
      context_governance: {
        retrieval_hit_rate: 0.4,
        context_budget_utilization: 0.8,
      },
    }))).toBe('writer');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 2,
      critique_result: createCritique({
        decision: 'APPROVED',
        total_score: 95,
        lock_analysis: { C: { score: 8 } },
      }),
      context_governance: {
        retrieval_hit_rate: 0.4,
        context_budget_utilization: 0.8,
      },
    }))).toBe('human_reviewer');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 2,
      critique_result: createCritique(),
    }))).toBe('human_reviewer');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: createCritique({
        decision: 'REWRITE',
        total_score: 45,
      }),
    }))).toBe('human_reviewer');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: createCritique({
        decision: 'HUMAN_REVIEW',
        total_score: 79,
      }),
    }))).toBe('human_reviewer');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: createCritique({
        decision: 'REVISE',
        total_score: 82,
      }),
    }))).toBe('human_reviewer');

    expect(adapter.routeAfterCritic(createState(adapter, {
      revision_count: 1,
      critique_result: createCritique({
        decision: 'REVISE',
        total_score: 72,
      }),
    }))).toBe('writer');
  });

  it('normalizes self-learning state and reflection payloads', () => {
    const adapter = new NovelAdapter({
      min_c_score: 7,
      self_learning_curate_every_n_revisions: 2,
      self_learning_max_rules: 2,
    });

    const normalized = (adapter as any).getSelfLearningState({
      self_learning: {
        reflector: 'bad',
        curator: null,
        playbook: {
          rules: ['Keep the clue visible'],
        },
      },
    });
    const reflection = (adapter as any).buildReflectionFromCritic(
      {
        decision: 'REWRITE',
        total_score: 61,
        actionable_feedback: 'sharpen the reveal',
        lock_analysis: {
          L: { score: 6 },
          O: { score: 8 },
          C: { score: 5 },
          K: { score: 6 },
        },
      },
      3,
      [{ version: 1 }],
    );

    expect(normalized).toEqual({
      reflector: {},
      curator: {},
      playbook: {
        rules: ['Keep the clue visible'],
      },
    });
    expect(reflection).toMatchObject({
      triggered: true,
      revision_count: 3,
      failure_type: 'rewrite',
      decision: 'REWRITE',
      total_score: 61,
      history_size: 1,
    });
    expect(reflection.root_causes).toContain('low_lock_dimensions=L,C,K');
    expect(reflection.root_causes).toContain('sharpen the reveal');
    expect(reflection.avoid_next_round).toContain('Do not weaken confrontation (C) in key beats');

    expect((adapter as any).shouldCuratePlaybook(
      { revision_count: 2 },
      { decision: 'APPROVED' },
    )).toBe(true);
    expect((adapter as any).shouldCuratePlaybook(
      { revision_count: 1 },
      { decision: 'APPROVED' },
    )).toBe(false);
    expect((adapter as any).shouldCuratePlaybook(
      { revision_count: 0 },
      { decision: 'REWRITE' },
    )).toBe(true);
  });

  it('uses default routing and self-learning fallbacks when optional fields are absent', () => {
    const adapter = new NovelAdapter({});
    unsetConfig(adapter);

    expect(adapter.routeAfterWriter({
      draft_content: 'draft ready',
    } as WritingState)).toBe('distillation');
    expect(adapter.routeAfterCritic({} as WritingState)).toBe('writer');
    expect((adapter as any).isSelfLearningEnabled()).toBe(false);

    const normalized = (adapter as any).getSelfLearningState({});
    const reflection = (adapter as any).buildReflectionFromCritic({}, 1, 'bad-history');

    expect(normalized).toEqual({
      reflector: {},
      curator: {},
      playbook: {
        rules: [],
      },
    });
    expect(reflection).toEqual({
      triggered: true,
      revision_count: 1,
      failure_type: 'revision_required',
      root_causes: [],
      avoid_next_round: ['Do not weaken confrontation (C) in key beats'],
      decision: 'REVISE',
      total_score: 0,
      history_size: 0,
    });
    expect((adapter as any).shouldCuratePlaybook({}, {})).toBe(true);
  });

  it('curates playbook rules, injects the recent rules, and handles no-candidate cases', () => {
    const adapter = new NovelAdapter({
      enable_self_learning_loop: true,
      self_learning_max_rules: 2,
    });
    const state = createState(adapter, {
      self_learning: {
        playbook: {
          rules: ['Keep conflict visible', 'Anchor the setting'],
        },
      },
    });
    const curated = (adapter as any).curatePlaybookCandidates(
      state,
      {
        actionable_feedback: 'add sharper physical reactions',
      },
      {
        avoid_next_round: [
          'Keep conflict visible',
          'Do not hide the clue too early',
        ],
      },
    );
    const emptyCurated = (adapter as any).curatePlaybookCandidates(
      createState(adapter),
      {},
      {},
    );
    (adapter as any).injectPlaybookIntoWriterInput({
      self_learning: curated.playbook ? { playbook: curated.playbook } : {},
    });

    expect(curated.curator).toMatchObject({
      applied: true,
      rule_count: 2,
    });
    expect(curated.playbook).toEqual({
      rules: [
        'Do not hide the clue too early',
        'Apply feedback focus: add sharper physical reactions',
      ],
    });
    expect(emptyCurated).toEqual({
      curator: { applied: false, reason: 'no_candidates' },
      playbook: {
        rules: [],
      },
    });
  });

  it('falls back in playbook curation and injection when rules are absent or invalid', () => {
    const adapter = new NovelAdapter({
      enable_self_learning_loop: true,
    });
    const curated = (adapter as any).curatePlaybookCandidates(
      {
        self_learning: {
          playbook: {
            rules: 'bad-rules',
          },
        },
      },
      {
        actionable_feedback: 'keep cause and effect visible',
      },
      {
        avoid_next_round: ['Keep scene logic tight'],
      },
    );

    expect(curated.curator).toMatchObject({
      applied: true,
      rule_count: 2,
      added: 2,
    });
    expect(curated.playbook).toEqual({
      rules: [
        'Keep scene logic tight',
        'Apply feedback focus: keep cause and effect visible',
      ],
    });

    expect(() => (adapter as any).injectPlaybookIntoWriterInput({
      self_learning: {
        playbook: {},
      },
    })).not.toThrow();
    expect(() => (adapter as any).injectPlaybookIntoWriterInput({
      self_learning: {
        playbook: {
          rules: ['   ', 42],
        },
      },
    })).not.toThrow();
  });

  it('evaluates governance, distillation presence, scene cards, drafts, and lock analysis helpers', () => {
    const adapter = new NovelAdapter({
      enable_context_governance: true,
      min_retrieval_hit_rate: 0.7,
      min_context_budget_utilization: 0.5,
    });
    const governedState = createState(adapter, {
      user_idea: '关于林岚的悬疑故事，她在旧剧院里寻找真相并面对内鬼。',
      genre: '悬疑',
      target_chapters: 9,
    });
    const sceneCards = (adapter as any).buildSceneCards(governedState);
    const draft = (adapter as any).composeDraft({
      ...governedState,
      feedback_context: 'keep the pressure on the suspect',
      current_scene: {
        ...sceneCards[0],
        sensory_guidance: {
          visual: 'cold lights',
          sound: 'distant footsteps',
        },
      },
    }, 3);
    const lockAnalysis = (adapter as any).buildLockAnalysis(
      { objective: '' },
      {
        metrics: {
          dimension_scores: {
            clarity: 40,
            causality: 40,
            detail: 40,
          },
        },
      },
    );

    expect((adapter as any).contextGovernancePassed(createState(adapter))).toBe(true);
    expect((adapter as any).contextGovernancePassed(createState(adapter, {
      context_governance: { passed: false },
    }))).toBe(false);
    expect((adapter as any).contextGovernancePassed(createState(adapter, {
      context_governance: {
        retrieval_hit_rate: 0.8,
        context_budget_utilization: 0.6,
      },
    }))).toBe(true);
    expect((adapter as any).contextGovernancePassed(createState(adapter, {
      context_governance: {
        retrieval_hit_rate: 0.6,
        context_budget_utilization: 0.6,
      },
    }))).toBe(false);

    expect((adapter as any).hasDistillationResult(undefined)).toBe(false);
    expect((adapter as any).hasDistillationResult({})).toBe(false);
    expect((adapter as any).hasDistillationResult({ template: 'full' })).toBe(true);

    expect(sceneCards).toHaveLength(3);
    expect(sceneCards[0].pov_character).toBe('林岚');
    expect(sceneCards[0].foreshadows_to_plant?.length).toBeGreaterThan(0);
    expect(sceneCards[2].foreshadows_to_harvest?.length).toBeGreaterThan(0);

    expect(draft).toContain('[Draft v3]');
    expect(draft).toContain('keep the pressure on the suspect');
    expect(lockAnalysis).toMatchObject({
      L: { score: 6 },
      O: { score: 6 },
      C: { score: 5 },
      K: { score: 5 },
      total_score: 22,
    });

    expect((adapter as any).detectPovCharacter('关于苏离的冒险故事')).toBe('苏离');
    expect((adapter as any).extractPremise('')).toBeTruthy();
  });
  it('uses default governance thresholds and helper defaults when no optional values are supplied', () => {
    const adapter = new NovelAdapter({
      enable_context_governance: true,
    });
    const defaultSceneCards = (adapter as any).buildSceneCards({});
    const nonSuspenseSceneCards = (adapter as any).buildSceneCards({
      user_idea: 'A bright adventure',
      genre: 'fantasy',
      target_chapters: 1,
    });
    const fallbackDraft = (adapter as any).composeDraft({}, 2);

    expect((adapter as any).contextGovernancePassed({
      context_governance: {
        retrieval_hit_rate: 0.69,
        context_budget_utilization: 0.59,
      },
    })).toBe(false);
    expect((adapter as any).contextGovernancePassed({
      context_governance: {
        retrieval_hit_rate: 0.71,
        context_budget_utilization: 0.61,
      },
    })).toBe(true);

    expect(defaultSceneCards).toHaveLength(3);
    expect(nonSuspenseSceneCards).toHaveLength(1);
    expect(nonSuspenseSceneCards[0].sensory_guidance?.visual).toBeTruthy();
    expect(fallbackDraft).toContain('[Draft v2]');
    expect((adapter as any).detectPovCharacter()).toBeTruthy();
    expect((adapter as any).extractPremise()).toBeTruthy();
  });
});
