import { describe, expect, it } from 'vitest';

import { DefaultWorkflowRoutingStrategy } from '../../workflow/strategies/routing-strategy.js';
import { WorkflowLevel } from '../../workflow/types.js';

describe('workflow/strategies/routing-strategy branch coverage', () => {
  it('skips legacy level 4 indicators and ignores invalid legacy regex patterns', () => {
    const strategy = new DefaultWorkflowRoutingStrategy(() => [], (payload) => payload);
    const router = (strategy as unknown as {
      router: {
        getLevelIndicators: () => Record<number, string[]>;
        scoreRouteFeatures: (task: string) => {
          legacy_scores: Record<string, number>;
          legacy_level: number;
        };
      };
    }).router;

    router.getLevelIndicators = () => ({
      [WorkflowLevel.L1_RAPID]: ['['],
      [WorkflowLevel.L2_LITE]: ['扩写'],
      [WorkflowLevel.L3_STANDARD]: ['章节'],
      [WorkflowLevel.L4_BRAINSTORM]: ['继续'],
      [WorkflowLevel.L5_COORDINATOR]: ['整体设计'],
    });

    const score = router.scoreRouteFeatures('继续扩写这一章');

    expect(score.legacy_scores).toMatchObject({
      L1: 0,
      L2: 1,
      L4: 0,
    });
    expect(score.legacy_level).toBe(WorkflowLevel.L2_LITE);
  });

  it('ignores invalid structured regex patterns without throwing', () => {
    const strategy = new DefaultWorkflowRoutingStrategy(() => [], (payload) => payload);
    const router = (strategy as unknown as {
      router: {
        getRoutingFeatureModel: () => Record<string, unknown>;
        scoreRouteFeatures: (task: string) => {
          structured_scores: Record<string, number>;
          matched_features: Array<Record<string, unknown>>;
        };
      };
    }).router;

    router.getRoutingFeatureModel = () => ({
      weights: { keyword: 3, structure: 2, history: 2, long_text_escalation: 2 },
      thresholds: {
        min_structured_score: 1,
        long_text_escalation_min_length: 100,
        long_text_target_floor: 'L3',
        default_level: 'L2',
      },
      category_explanations: {
        keyword: '命中层级关键词',
        structure: '命中结构信号',
        history: '命中历史反馈信号',
        long_text_escalation: '长文本任务自动升级',
      },
      levels: {
        [WorkflowLevel.L1_RAPID]: {
          keyword: ['['],
          structure: [],
          history: [],
        },
        [WorkflowLevel.L2_LITE]: {
          keyword: ['扩写'],
          structure: [],
          history: [],
        },
        [WorkflowLevel.L3_STANDARD]: {
          keyword: [],
          structure: [],
          history: [],
        },
        [WorkflowLevel.L4_BRAINSTORM]: {
          keyword: [],
          structure: [],
          history: [],
        },
        [WorkflowLevel.L5_COORDINATOR]: {
          keyword: [],
          structure: [],
          history: [],
        },
      },
    });

    const score = router.scoreRouteFeatures('扩写一段内容');

    expect(score.structured_scores).toMatchObject({
      L1: 0,
      L2: 3,
    });
    expect(score.matched_features.every((feature) => feature.signal !== '[')).toBe(true);
  });
});
