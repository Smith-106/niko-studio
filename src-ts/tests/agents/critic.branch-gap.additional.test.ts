import { describe, expect, it, vi } from 'vitest';

import {
  createCriticNode,
  type CriticOutput,
  CriticAgent,
} from '../../agents/critic';

function createBaseCriticOutput(overrides: Partial<CriticOutput> = {}): CriticOutput {
  return {
    agent_role: 'critic',
    lock_analysis: {
      L: { score: 8, reasoning: 'ok' },
      O: { score: 8, reasoning: 'ok' },
      C: { score: 8, reasoning: 'ok' },
      K: { score: 8, reasoning: 'ok' },
    },
    decision: 'REVISE',
    decision_reason: 'needs work',
    total_score: 96,
    lock_score: 32,
    style_score: 32,
    logic_score: 32,
    dimension_details: [
      {
        dimension: 'dialogue_quality',
        score: 9,
        weight: 0.09,
        feedback: 'good',
        issues: [],
      },
    ],
    lock_scene_check: null,
    shuangdian_check: null,
    suggestions_high: [],
    suggestions_medium: [],
    suggestions_low: [],
    revision_instructions: [],
    actionable_feedback: '',
    ...overrides,
  };
}

describe('CriticAgent branch-gap coverage', () => {
  it('skips narrative report generation when the narrative engine is absent', async () => {
    const agent = new CriticAgent({
      llmService: {
        generateJson: vi.fn().mockResolvedValue(createBaseCriticOutput()),
      } as never,
    });

    (
      agent as unknown as {
        narrativeEngine: null;
      }
    ).narrativeEngine = null;

    const result = await agent.review('draft', {}, [], {});

    expect(result.narrative_report).toBeUndefined();
  });

  it('fills missing node state inputs with review fallbacks', async () => {
    const reviewSpy = vi
      .spyOn(CriticAgent.prototype, 'review')
      .mockResolvedValue(createBaseCriticOutput());

    const node = createCriticNode({
      generateJson: vi.fn(),
    } as never);

    await node({});

    expect(reviewSpy).toHaveBeenCalledWith('', {}, [], {}, true);
  });
});
