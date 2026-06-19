import { describe, expect, it } from 'vitest';

import {
  canonicalizeWorkflowRecommendations,
  computeWorkflowPlanHash,
} from '../../../workflow/engine/recommendations.js';

describe('workflow/engine/recommendations', () => {
  it('canonicalizes object and string recommendations while preserving original array indexes', () => {
    const params = { nested: { keep: true } };
    const recommendations = [
      {
        name: '  Rename task  ',
        rationale: '  clearer naming  ',
        suggestion: '  update-task  ',
        target: '  chapter-1  ',
        params,
      },
      '  plain text recommendation  ',
      '',
      null,
      {
        recommendation: 'Fallback title',
        params: null,
      },
    ];

    const result = canonicalizeWorkflowRecommendations(recommendations as any);

    expect(result).toEqual([
      {
        id: 'rec-01',
        title: 'Rename task',
        reason: 'clearer naming',
        action: 'update-task',
        target: 'chapter-1',
        params: { nested: { keep: true } },
        index: 0,
      },
      {
        id: 'rec-02',
        title: 'plain text recommendation',
        reason: '',
        action: 'plain text recommendation',
        target: '',
        params: {},
        index: 1,
      },
      {
        id: 'rec-05',
        title: 'Fallback title',
        reason: '',
        action: 'recommendation-5',
        target: '',
        params: null,
        index: 4,
      },
    ]);
    expect(result[0]?.params).not.toBe(params);

    params.nested.keep = false;
    expect(result[0]?.params).toEqual({ nested: { keep: true } });
  });

  it('returns an empty array for missing recommendations', () => {
    expect(canonicalizeWorkflowRecommendations()).toEqual([]);
  });

  it('ignores volatile template metadata when computing workflow plan hashes', () => {
    const basePlan = {
      task: 'Ship release',
      level: 'critical',
      steps: [
        { name: 'Plan', description: 'Draft the rollout', dependencies: [] },
        { name: 'Verify', description: 'Run smoke checks', dependencies: ['Plan'] },
      ],
      template_meta: {
        stable_key: 'keep',
        current_phase: 'planning',
        session_id: 'session-a',
        execution_mode: 'fast',
      },
      recommendations: [
        { id: 'rec-01', title: 'Do it', action: 'run' },
      ],
    };

    const changedVolatilePlan = {
      ...basePlan,
      template_meta: {
        stable_key: 'keep',
        current_phase: 'executing',
        session_id: 'session-b',
        execution_mode: 'eco',
        runner_transition_reason: 'resume',
      },
    };

    expect(computeWorkflowPlanHash(basePlan)).toBe(
      computeWorkflowPlanHash(changedVolatilePlan),
    );
  });

  it('changes the workflow plan hash when stable plan content changes', () => {
    const basePlan = {
      task: 'Ship release',
      level: 'critical',
      steps: [
        { name: 'Plan', description: 'Draft the rollout', dependencies: [] },
      ],
      template_meta: {
        stable_key: 'keep',
      },
      recommendations: [
        { id: 'rec-01', title: 'Do it', action: 'run' },
      ],
    };

    const changedPlan = {
      ...basePlan,
      recommendations: [
        { id: 'rec-01', title: 'Do it', action: 'review' },
      ],
    };

    expect(computeWorkflowPlanHash(basePlan)).not.toBe(
      computeWorkflowPlanHash(changedPlan),
    );
  });
});
