import { describe, expect, it } from 'vitest';

import {
  ANALYSIS_SCHEMA_VERSION,
  PROHIBITED_DETECTION_KEYS,
  PROHIBITED_DETECTION_TERMS,
  clampFloat,
  containsDetectionEvasionIntent,
  guardDetectionEvasionPayload,
  mergeQualitySidecar,
  normalizeContextBudgetMetrics,
  normalizeCount,
  normalizeIssueItem,
  normalizeIssueSeverity,
  normalizeIssueText,
  normalizePublishRecommendation,
  normalizeQualityPayload,
  normalizeQualityScore,
  normalizeRatio,
  normalizeRetrievalMetrics,
  normalizeSchemaVersion,
  normalizeSelfLearningMetrics,
  qualityDefaultPayload,
  safeFloat,
  safeInt,
  withContract,
  withTerminalContract,
} from '../../mcp/contract';

describe('mcp/contract', () => {
  it('wraps workflow contracts and terminal compatibility fields', () => {
    const base = withContract({
      workflow_level: 'L1-Rapid',
      final_output: 'draft content',
    });

    expect(base).toMatchObject({
      workflow_level: 'L1-Rapid',
      analysis_schema_version: ANALYSIS_SCHEMA_VERSION,
    });

    const interrupted = withTerminalContract({
      workflow_level: 'L4-Brainstorm',
      terminal: 'interrupted',
      legacy_contract_fields: {
        decision: 'soft_go',
      },
    });

    expect(interrupted.terminal_state).toBe('aborted');
    expect(interrupted.legacy_contract_fields).toMatchObject({
      decision: 'go',
      terminal: 'aborted',
      terminal_state: 'aborted',
    });

    const recovered = withTerminalContract({
      workflow_level: 'L3-Standard',
      terminal: 'recovered',
    });

    expect(recovered.decision).toBeDefined();
    expect(recovered.legacy_contract_fields).toMatchObject({
      terminal: 'done',
      terminal_state: 'done',
    });
  });

  it('detects and blocks detection-evasion payloads recursively', () => {
    const payload = {
      nested: [
        {
          prompt: 'Please bypass AI detector checks and avoid detection',
        },
      ],
    };

    expect(PROHIBITED_DETECTION_KEYS.has('anti_detection')).toBe(true);
    expect(PROHIBITED_DETECTION_TERMS).toContain('ai detector');
    expect(containsDetectionEvasionIntent(payload)).toBe(true);
    expect(containsDetectionEvasionIntent({ safe: ['story polish only'] })).toBe(false);

    expect(guardDetectionEvasionPayload(payload, false)).toBeNull();
    expect(guardDetectionEvasionPayload(payload, true)).toEqual({
      statusCode: 400,
      body: expect.objectContaining({
        error: 'DETECTION_EVASION_BLOCKED',
        code: 'COMPLIANCE_DETECTION_EVASION_BLOCKED',
      }),
    });
  });

  it('provides numeric and issue normalization helpers', () => {
    expect(clampFloat(8, 0, 5)).toBe(5);
    expect(clampFloat(-2, 0, 5)).toBe(0);
    expect(safeFloat('2.5', 0)).toBe(2.5);
    expect(safeFloat(true, 7)).toBe(7);
    expect(safeFloat('NaN', 3)).toBe(3);
    expect(safeInt('17px', 0)).toBe(17);
    expect(safeInt(false, 6)).toBe(6);
    expect(normalizeQualityScore(120, 40)).toBe(100);
    expect(normalizeRatio(-1, 0.3)).toBe(0);
    expect(normalizeCount(-5, 3)).toBe(0);

    expect(normalizeIssueText(null, 'fallback')).toBe('fallback');
    expect(normalizeIssueSeverity('CRITICAL')).toBe('medium');
    expect(normalizeIssueSeverity('HIGH')).toBe('high');
    expect(
      normalizeIssueItem({
        severity: 'HIGH',
        type: '  logic  ',
        evidence: 123,
        suggestion: undefined,
      }),
    ).toEqual({
      severity: 'high',
      type: 'logic',
      evidence: '123',
      suggestion: '',
    });
  });

  it('normalizes nested metric payloads and publish recommendations', () => {
    const retrieval = normalizeRetrievalMetrics(
      {
        stage1_candidates: '12',
        stage2_selected: -3,
        cited_count: '5',
        effective_hit_rate: 4,
      },
      {
        stage1_candidates: 1,
        stage2_selected: 2,
        cited_count: 3,
        effective_hit_rate: 0.2,
      },
    );
    expect(retrieval).toEqual({
      stage1_candidates: 12,
      stage2_selected: 0,
      cited_count: 5,
      effective_hit_rate: 1,
    });

    const contextBudget = normalizeContextBudgetMetrics(
      {
        token_total: '20',
        token_effective: true,
        utilization: '0.75',
      },
      {
        token_total: 3,
        token_effective: 4,
        utilization: 0.1,
      },
    );
    expect(contextBudget).toEqual({
      token_total: 20,
      token_effective: 4,
      utilization: 0.75,
    });

    const selfLearning = normalizeSelfLearningMetrics(
      {
        strategy_adoption_rate: '0.4',
        reflector_triggered: 'yes',
        curator_applied: 0,
      },
      {
        strategy_adoption_rate: 0.1,
        reflector_triggered: false,
        curator_applied: true,
      },
    );
    expect(selfLearning).toEqual({
      strategy_adoption_rate: 0.4,
      reflector_triggered: true,
      curator_applied: false,
    });

    expect(
      normalizeSchemaVersion(
        {
          contract_version: 'legacy-v2',
        },
        {},
      ),
    ).toBe('legacy-v2');
    expect(
      normalizePublishRecommendation(
        {
          decision: 'soft_go',
        },
        'pass',
      ),
    ).toBe('revise');
    expect(
      normalizePublishRecommendation(
        {
          decision_result: 'rewrite',
        },
        'pass',
      ),
    ).toBe('block');
  });

  it('builds default quality payloads and deeply normalizes malformed quality results', () => {
    const defaults = qualityDefaultPayload();
    expect(defaults).toMatchObject({
      analysis_schema_version: ANALYSIS_SCHEMA_VERSION,
      publish_recommendation: 'revise',
      metrics: {
        retrieval: {
          stage1_candidates: 0,
        },
      },
    });

    const normalized = normalizeQualityPayload({
      analysis_schema_version: 'schema-x',
      quality_score: '120',
      decision: 'no_go',
      issues: [
        {
          severity: 'HIGH',
          type: ' pacing ',
          evidence: 'too abrupt',
          suggestion: 'smooth transition',
        },
        'ignore-me',
      ],
      metrics: {
        dialogue_ratio: '1.5',
        conflict_points: '-8',
        visual_details: '7',
        template_sentence_ratio: 0.25,
        dimension_scores: {
          repetition: '88.8',
          tone: true,
        },
        retrieval: {
          stage1_candidates: '12',
          stage2_selected: '-5',
          cited_count: '2',
          effective_hit_rate: '1.6',
        },
        context_budget: {
          token_total: '30',
          token_effective: '20',
          utilization: '0.9',
        },
        self_learning: {
          strategy_adoption_rate: '0.5',
          reflector_triggered: '',
          curator_applied: '1',
        },
      },
    });

    expect(normalized).toEqual({
      analysis_schema_version: 'schema-x',
      quality_score: 100,
      issues: [
        {
          severity: 'high',
          type: 'pacing',
          evidence: 'too abrupt',
          suggestion: 'smooth transition',
        },
      ],
      metrics: {
        dialogue_ratio: 1,
        conflict_points: 0,
        visual_details: 7,
        template_sentence_ratio: 0.25,
        dimension_scores: {
          repetition: 88.8,
          tone: 0,
          clarity: 0,
          causality: 0,
          detail: 0,
          factuality: 0,
        },
        retrieval: {
          stage1_candidates: 12,
          stage2_selected: 0,
          cited_count: 2,
          effective_hit_rate: 1,
        },
        context_budget: {
          token_total: 30,
          token_effective: 20,
          utilization: 0.9,
        },
        self_learning: {
          strategy_adoption_rate: 0.5,
          reflector_triggered: false,
          curator_applied: true,
        },
      },
      publish_recommendation: 'block',
    });

    expect(normalizeQualityPayload(null)).toEqual(defaults);
  });

  it('merges sidecar metrics into an existing quality result without clobbering valid data', () => {
    const merged = mergeQualitySidecar(
      {
        quality_score: 75,
        metrics: {
          dialogue_ratio: 0.3,
        },
      },
      {
        stage1_candidates: 4,
      },
      {
        token_total: 10,
      },
      {
        reflector_triggered: true,
      },
    );

    expect(merged).toEqual({
      quality_score: 75,
      metrics: {
        dialogue_ratio: 0.3,
        retrieval: {
          stage1_candidates: 4,
        },
        context_budget: {
          token_total: 10,
        },
        self_learning: {
          reflector_triggered: true,
        },
      },
    });

    expect(
      mergeQualitySidecar(
        {
          quality_score: 50,
        },
        'bad',
        null,
      ),
    ).toEqual({
      quality_score: 50,
      metrics: {},
    });
  });
});
