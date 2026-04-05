import { describe, expect, it, vi } from 'vitest';

import { Level3Standard } from '../../workflow/levels/level3-standard';

describe('workflow/level3-standard', () => {
  it('fails plan verification when plan outputs are incomplete', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: [
          {
            phase: 1,
            output: '已完成',
          },
          {
            phase: 2,
            output: null,
          },
        ],
        plan: {
          steps: ['analyze'],
        },
      }),
    };
    const standard = new Level3Standard({
      architect,
    });

    const result = standard.execute({
      user_request: '生成一个完整计划',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    expect((result.errors as string[])[0]).toContain('計劃驗證失敗');
  });

  it('runs mocked architect-writer-critic loop and approves when score reaches pass threshold', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: [
          { phase: 1, output: '需求理解' },
          { phase: 2, output: '内容分析' },
          { phase: 3, output: '变更范围' },
          { phase: 4, output: '实施计划' },
          { phase: 5, output: '验证定义' },
        ],
        plan: {
          steps: ['step-1'],
        },
      }),
    };
    const writer = {
      run: vi
        .fn()
        .mockReturnValueOnce({ content: '初稿内容' })
        .mockReturnValueOnce({ content: '修订后内容' }),
    };
    const critic = {
      run: vi
        .fn()
        .mockReturnValueOnce({
          score: 65,
          decision: 'REVISE',
          feedback: '补强冲突',
        })
        .mockReturnValueOnce({
          score: 82,
          decision: 'APPROVED',
          feedback: '',
        }),
    };
    const standard = new Level3Standard({
      architect,
      writer,
      critic,
    });

    const result = standard.execute({
      user_request: '执行标准模式',
      context: '补强剧情',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.decision).toBe('APPROVED');
    expect(result.score).toBe(82);
    expect(result.revision_count).toBe(1);
    expect(result.draft_content).toBe('修订后内容');
  });

  it('switches to human review when critic requests it or max revisions are exhausted', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: Array.from({ length: 5 }, (_, index) => ({
          phase: index + 1,
          output: `phase-${index + 1}`,
        })),
        plan: {
          steps: ['step-1'],
        },
      }),
    };
    const writer = {
      run: vi.fn().mockReturnValue({ content: '始终不合格的草稿' }),
    };
    const critic = {
      run: vi.fn().mockReturnValue({
        score: 40,
        decision: 'HUMAN_REVIEW',
        feedback: '需要人工判断',
      }),
    };
    const standard = new Level3Standard({
      architect,
      writer,
      critic,
      config: {
        max_revisions: 1,
      },
    });

    const result = standard.execute({
      user_request: '执行标准模式',
      errors: [],
    } as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    expect(result.requires_human_intervention).not.toBe(true);
  });

  it('exposes required agents, default config, and plan helpers', () => {
    const standard = new Level3Standard();

    expect(standard.getRequiredAgents()).toEqual(['architect', 'writer', 'critic']);
    expect(standard.getDefaultConfig()).toMatchObject({
      max_revisions: 3,
      pass_score: 80,
      retrieval_profile: 'standard_balanced',
    });
    expect(
      standard.plan({
        plan_phases: [
          { phase: 1, output: 'ok' },
        ],
      } as never),
    ).toHaveLength(5);
    expect(
      standard.planVerify({
        implementation_plan: { steps: [] },
        plan_phases: [{ output: 'done' }],
      } as never).valid,
    ).toBe(true);
  });
});
