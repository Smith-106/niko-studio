import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_NOVEL_CONFIG,
  NOVEL_HUMAN_REVIEW_SCORE,
  NOVEL_MIN_C_SCORE,
  NOVEL_PASS_SCORE,
  NOVEL_QUALITY_THRESHOLDS,
  NOVEL_QUALITY_WEIGHTS,
  createInitialState,
} from '../../workflow/novel-state';

describe('workflow/novel-state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:45:00.000Z'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('session-test-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('exposes the expected novel scoring constants, weights, and default config', () => {
    expect(NOVEL_PASS_SCORE).toBe(99);
    expect(NOVEL_MIN_C_SCORE).toBe(7);
    expect(NOVEL_HUMAN_REVIEW_SCORE).toBe(95);
    expect(NOVEL_QUALITY_WEIGHTS).toEqual({
      repetition: 0.2,
      tone: 0.13,
      clarity: 0.17,
      causality: 0.2,
      detail: 0.2,
      factuality: 0.1,
    });
    expect(NOVEL_QUALITY_THRESHOLDS).toMatchObject({
      pass: NOVEL_PASS_SCORE,
      block: 50,
      block_template_ratio: 0.8,
      repetition_issue: 0.45,
      low_quality: 55,
      low_clarity: 45,
    });
    expect(DEFAULT_NOVEL_CONFIG).toEqual({
      quality_mode: 'auto',
      quality_level: 'high',
      degrade_on_timeout: true,
      degrade_on_error: true,
      critical_gate_always_on: true,
      quality_phase_timeout_seconds: 30,
      pass_score: NOVEL_PASS_SCORE,
      min_c_score: NOVEL_MIN_C_SCORE,
      max_revisions: 3,
      human_review_score: NOVEL_HUMAN_REVIEW_SCORE,
      auto_approve_timeout: 300,
      retrieval_profile: 'standard_balanced',
      enable_self_learning_loop: false,
      self_learning_max_rules: 20,
      self_learning_curate_every_n_revisions: 2,
      enable_context_governance: false,
      min_retrieval_hit_rate: 0.7,
      min_context_budget_utilization: 0.6,
      verbose: true,
      save_intermediate: true,
    });
  });

  it('creates a deterministic initial state with default novel values', () => {
    const state = createInitialState('写一个关于废弃剧院的悬疑故事');

    expect(state).toMatchObject({
      user_idea: '写一个关于废弃剧院的悬疑故事',
      genre: '悬疑',
      target_chapters: 30,
      target_wordcount: 600000,
      session_id: 'session-test-id',
      created_at: '2026-04-04T12:45:00.000Z',
      current_chapter: 1,
      current_scene_index: 0,
      story_blueprint: {},
      lock_analysis: {},
      scene_cards: [],
      current_scene: {},
      draft_content: '',
      draft_version: 0,
      critique_result: {},
      revision_count: 0,
      checkpoint_trace: [],
      quality_mode: 'auto',
      requested_quality_level: 'high',
      effective_quality_level: 'high',
      final_content: '',
      final_score: 0,
      errors: [],
      requires_human_intervention: false,
      metadata: {},
    });
    expect(state.self_learning).toEqual({
      reflector: {},
      curator: {},
      playbook: { rules: [] },
    });
  });

  it('honors explicit overrides and preserves metadata payloads', () => {
    const state = createInitialState('写一个太空歌剧', {
      genre: '科幻',
      targetChapters: 12,
      targetWordcount: 180000,
      metadata: {
        source: 'queue-test',
        resume_decision: { plan_id: 'plan-11' },
      },
    });

    expect(state.genre).toBe('科幻');
    expect(state.target_chapters).toBe(12);
    expect(state.target_wordcount).toBe(180000);
    expect(state.metadata).toEqual({
      source: 'queue-test',
      resume_decision: { plan_id: 'plan-11' },
    });
    expect(state.revision_history).toEqual([]);
    expect(state.revision_instructions).toEqual([]);
    expect(state.feedback_artifacts).toEqual([]);
    expect(state.character_profiles).toEqual([]);
  });
});
