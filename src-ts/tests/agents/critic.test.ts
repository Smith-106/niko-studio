import { describe, expect, it, vi } from 'vitest';

import {
  createCriticChain,
  createCriticNode,
  lockCScoreSufficient,
  lockHasCriticalFailure,
  lockWeightedScore,
  shuangDianIsEffective,
  shuangDianTotalScore,
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
      {
        dimension: 'plot_logic',
        score: 9,
        weight: 0.09,
        feedback: 'good',
        issues: [],
      },
    ],
    lock_scene_check: null,
    shuangdian_check: {
      setup_score: 3,
      setup_feedback: 'ok',
      payoff_score: 3,
      payoff_feedback: 'ok',
      reaction_score: 2,
      reaction_feedback: 'ok',
    },
    suggestions_high: [],
    suggestions_medium: ['加强冲突'],
    suggestions_low: [],
    revision_instructions: [
      {
        target: 'scene-1',
        issue: '冲突不足',
        suggestion: '提高对抗性',
        priority: 'high',
      },
    ],
    actionable_feedback: '提高对抗性',
    ...overrides,
  };
}

describe('CriticAgent', () => {
  it('computes score helper exports consistently', () => {
    expect(
      shuangDianTotalScore({
        setup_score: 3,
        setup_feedback: '',
        payoff_score: 2,
        payoff_feedback: '',
        reaction_score: 2,
        reaction_feedback: '',
      }),
    ).toBe(7);
    expect(
      shuangDianIsEffective({
        setup_score: 3,
        setup_feedback: '',
        payoff_score: 2,
        payoff_feedback: '',
        reaction_score: 2,
        reaction_feedback: '',
      }),
    ).toBe(true);

    const lock = {
      L: { score: 8, reasoning: '' },
      O: { score: 7, reasoning: '' },
      C: { score: 9, reasoning: '' },
      K: { score: 6, reasoning: '' },
    };
    expect(lockWeightedScore(lock)).toBe(31.2);
    expect(lockCScoreSufficient(lock)).toBe(true);
    expect(
      lockHasCriticalFailure({
        ...lock,
        K: { score: 2, reasoning: '' },
      }),
    ).toBe(true);
  });

  it('applies deterministic rule checks and narrative report mapping during review', async () => {
    const llmService = {
      generateJson: vi.fn().mockResolvedValue(
        createBaseCriticOutput({
          total_score: 98,
          dimension_details: [
            {
              dimension: 'dialogue_quality',
              score: 9,
              weight: 0.09,
              feedback: 'good',
              issues: [],
            },
            {
              dimension: 'plot_logic',
              score: 10,
              weight: 0.09,
              feedback: 'good',
              issues: [],
            },
          ],
        }),
      ),
    };
    const narrativeCriticEngine = {
      evaluate: vi.fn().mockResolvedValue({
        overallScore: 0.91,
        overallLevel: 'strong',
        moduleScores: { logic: 0.9 },
        summary: '整体稳定',
        recommendedSkills: ['script-doctor'],
        allIssues: ['minor issue'],
        criticalIssues: [],
      }),
    };
    const agent = new CriticAgent({
      llmService: llmService as never,
      narrativeCriticEngine: narrativeCriticEngine as never,
    });

    const result = await agent.review(
      '她突然转身，却突然又不禁笑了。',
      { scene_id: 'scene-1', objective: '逃离', conflict: '被追击', outcome: '暂时脱险' },
      [],
      {},
    );

    expect(llmService.generateJson).toHaveBeenCalled();
    expect(result.suggestions_high[0]).toContain('Forbidden words found');
    expect(result.dimension_details[0]?.issues.length).toBeGreaterThan(0);
    expect(result.decision).toBe('REWRITE');
    expect(result.narrative_report).toMatchObject({
      overall_level: 'strong',
      issues_count: 1,
      critical_count: 0,
    });
  });

  it('throws a fallback-disabled error when llm execution fails and exposes revision feedback helpers', async () => {
    const llmService = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const agent = new CriticAgent({
      llmService: llmService as never,
      narrativeCriticEngine: null,
    });

    await expect(
      agent.review('draft', {}, [], {}, false),
    ).rejects.toThrow('LLM execution failed with fallback disabled');

    const output = createBaseCriticOutput({
      decision: 'HUMAN_REVIEW',
      suggestions_high: ['修复硬伤'],
      suggestions_medium: ['提升节奏'],
    });
    const feedback = agent.generateRevisionFeedback(output);
    const actionable = agent.generateActionableFeedback(output);

    expect(feedback).toContain('## Review Result');
    expect(feedback).toContain('### Must Fix');
    expect(actionable).toMatchObject({
      decision: 'HUMAN_REVIEW',
      suggestions: ['修复硬伤', '提升节奏'],
    });
    expect(agent.shouldRevise(output)).toBe(false);
    expect(agent.shouldHumanReview(output)).toBe(true);
  });

  it('exposes node and chain helpers over the review contract', async () => {
    const llmService = {
      generateJson: vi.fn().mockResolvedValue(createBaseCriticOutput()),
    };

    const node = createCriticNode(llmService as never);
    const nodeResult = await node({
      draft_content: 'draft',
      current_scene_card: {},
      character_profiles: [],
      world_settings: {},
    });

    expect(nodeResult.critic_result).toBeTruthy();
    expect(nodeResult.critic_decision).toBe('REWRITE');
    expect(String(nodeResult.revision_feedback)).toContain('Review Result');

    const chain = createCriticChain(llmService as never);
    const chainResult = await chain.review('draft', {}, [], {});

    expect(chainResult.agent_role).toBe('critic');
    expect(chainResult.revision_instructions[0]?.target).toBe('scene-1');
  });
});
