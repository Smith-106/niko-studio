import { describe, expect, it } from 'vitest';

import {
  BrainstormRole,
  brainstormSynthesisToDict,
  getCreativeRoles,
  getDefaultRoles,
  getRoleDisplayName,
  getRolePerspective,
  getTechnicalRoles,
  guidanceSpecToDict,
  guidanceSpecToMarkdown,
  Level4Brainstorm,
  roleAnalysisToDict,
} from '../../workflow/levels/level4-brainstorm';

describe('workflow/level4-brainstorm', () => {
  it('exposes role helper exports and serializer helpers deterministically', () => {
    expect(getRoleDisplayName(BrainstormRole.SYSTEM_ARCHITECT)).toBe('系统架构师');
    expect(getRolePerspective(BrainstormRole.DEVIL_ADVOCATE)).toContain('反面论证');
    expect(getDefaultRoles()).toContain(BrainstormRole.PRODUCT_MANAGER);
    expect(getCreativeRoles()).toContain(BrainstormRole.STORYTELLER);
    expect(getTechnicalRoles()).toContain(BrainstormRole.RISK_ANALYST);

    expect(
      roleAnalysisToDict({
        role: BrainstormRole.PRODUCT_MANAGER,
        analysisContent: '分析',
        keyPoints: ['统一入口'],
        recommendations: ['先落最小闭环'],
        concerns: ['避免无关重构'],
        score: 88,
        metadata: { source: 'test' },
      }),
    ).toMatchObject({
      role_name: '产品经理',
      key_points: ['统一入口'],
      recommendations: ['先落最小闭环'],
    });

    expect(
      brainstormSynthesisToDict({
        summary: '已形成共识',
        consensusPoints: ['统一入口'],
        divergentPoints: ['实现节奏不同'],
        prioritizedRecommendations: ['先落最小闭环'],
        riskAssessment: '低风险',
        nextSteps: ['执行'],
        confidenceScore: 80,
      }),
    ).toMatchObject({
      consensus_points: ['统一入口'],
      confidence_score: 80,
    });

    const markdown = guidanceSpecToMarkdown({
      title: '头脑风暴规范',
      objective: '统一目标',
      scope: '统一范围',
      guidelines: ['先保证闭环'],
      constraints: ['不碰无关模块'],
      successCriteria: ['测试通过'],
      qualityStandards: ['保持一致性'],
      deliverables: ['规范文档'],
    });

    expect(markdown).toContain('# 头脑风暴规范');
    expect(markdown).toContain('## 指导原则');
    expect(
      guidanceSpecToDict({
        title: '头脑风暴规范',
        objective: '统一目标',
        scope: '统一范围',
        guidelines: ['先保证闭环'],
        constraints: ['不碰无关模块'],
        successCriteria: ['测试通过'],
        qualityStandards: ['保持一致性'],
        deliverables: ['规范文档'],
      }),
    ).toMatchObject({
      success_criteria: ['测试通过'],
      quality_standards: ['保持一致性'],
    });
  });

  it('falls back to failed analysis artifacts when no service container is available', () => {
    const brainstorm = new Level4Brainstorm();

    const analyses = brainstorm.generateArtifacts('规划下一步工作', [
      BrainstormRole.PRODUCT_MANAGER,
    ]);

    expect(analyses).toHaveLength(1);
    expect(analyses[0]).toMatchObject({
      role: BrainstormRole.PRODUCT_MANAGER,
      score: 0,
    });
    expect(analyses[0]?.analysisContent).toContain('分析过程中出错');
  });

  it('synthesizes analyses into a guidance specification and approved execute result', () => {
    const fakeContainer = {
      getAgent() {
        return {
          run() {
            return {
              content: [
                '关键要点:',
                '- 统一入口',
                '- 最小闭环',
                '建议:',
                '- 先补测试',
                '- 再做实现',
                '关注点:',
                '- 避免无关重构',
              ].join('\n'),
            };
          },
        };
      },
    };
    const brainstorm = new Level4Brainstorm({}, fakeContainer as never);
    const state = {
      user_request: '规划迁移下一步',
      context: '当前处于 Phase 3',
      errors: [],
    } as Record<string, unknown>;

    const result = brainstorm.execute(state as never, {
      roles: [
        BrainstormRole.PRODUCT_MANAGER,
        BrainstormRole.SYSTEM_ARCHITECT,
      ],
    }) as Record<string, unknown>;

    expect(result.current_step).toBe('verify');
    expect(result.decision).toBe('APPROVED');
    expect(result.role_analyses).toHaveLength(2);
    expect((result.synthesis as Record<string, unknown>).summary).toContain('2 位专家角色');
    expect((result.specification as Record<string, unknown>).guidelines).toHaveLength(2);
    expect(String(result.final_output)).toContain('## 成功标准');
  });

  it('provides deterministic async artifacts for multiple roles', async () => {
    const fakeContainer = {
      getAgent() {
        return {
          run() {
            return {
              content: [
                '关键要点:',
                '- 统一入口',
                '建议:',
                '- 先补测试',
                '关注点:',
                '- 控制范围',
              ].join('\n'),
            };
          },
        };
      },
    };
    const brainstorm = new Level4Brainstorm({}, fakeContainer as never);

    const analyses = await brainstorm.generateArtifactsAsync('规划迁移下一步', [
      BrainstormRole.PRODUCT_MANAGER,
      BrainstormRole.REALIST,
    ]);

    expect(analyses).toHaveLength(2);
    expect(analyses.every((item) => item.score > 0)).toBe(true);
    expect(analyses[0]?.recommendations).toContain('先补测试');
  });
});
