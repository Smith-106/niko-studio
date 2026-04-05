import { describe, expect, it } from 'vitest';

import {
  createBaseState,
  DecisionType,
  DEFAULT_BASE_CONFIG,
  DomainType,
} from '../../workflow/state';

describe('workflow/state', () => {
  it('exposes shared decision and domain constants', () => {
    expect(DecisionType).toEqual({
      APPROVED: 'APPROVED',
      REVISE: 'REVISE',
      HUMAN_REVIEW: 'HUMAN_REVIEW',
      REWRITE: 'REWRITE',
      FAILED: 'FAILED',
    });
    expect(DomainType).toEqual({
      NOVEL: 'novel',
      CODE: 'code',
      KNOWLEDGE: 'knowledge',
      CUSTOM: 'custom',
    });
  });

  it('exposes the default base workflow config', () => {
    expect(DEFAULT_BASE_CONFIG).toEqual({
      pass_score: 80,
      human_review_score: 70,
      max_revisions: 3,
      auto_approve_timeout: 300,
      verbose: true,
      save_intermediate: true,
      domain: DomainType.CUSTOM,
      domain_config: {},
    });
  });

  it('creates base state with expected defaults and optional overrides', () => {
    const state = createBaseState('修复一个问题', {
      domain: DomainType.CODE,
      workflowLevel: 5,
      metadata: { source: 'test' },
    });

    expect(state.session_id).toBeTypeOf('string');
    expect(state.created_at).toBeTypeOf('string');
    expect(state.updated_at).toBeTypeOf('string');
    expect(state.domain).toBe(DomainType.CODE);
    expect(state.workflow_level).toBe(5);
    expect(state.user_request).toBe('修复一个问题');
    expect(state.current_step).toBe('init');
    expect(state.revision_count).toBe(0);
    expect(state.iteration_count).toBe(0);
    expect(state.decision).toBe('');
    expect(state.score).toBe(0);
    expect(state.errors).toEqual([]);
    expect(state.warnings).toEqual([]);
    expect(state.requires_human_intervention).toBe(false);
    expect(state.metadata).toEqual({ source: 'test' });
    expect(state.tags).toEqual([]);
  });

  it('falls back to custom domain and workflow level 3 when options are omitted', () => {
    const state = createBaseState('默认状态');

    expect(state.domain).toBe(DomainType.CUSTOM);
    expect(state.workflow_level).toBe(3);
    expect(state.metadata).toEqual({});
  });
});
