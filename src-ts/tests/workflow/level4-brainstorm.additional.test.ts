import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BrainstormRole,
  type BrainstormSynthesis,
  type GuidanceSpecification,
  Level4Brainstorm,
  type RoleAnalysis,
} from '../../workflow/levels/level4-brainstorm';

function makeAnalysis(
  role: BrainstormRole,
  overrides: Partial<RoleAnalysis> = {},
): RoleAnalysis {
  return {
    role,
    analysisContent: 'analysis',
    keyPoints: [],
    recommendations: [],
    concerns: [],
    score: 80,
    metadata: {},
    ...overrides,
  };
}

describe('workflow/level4-brainstorm additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks execute as failed when async artifact generation throws', async () => {
    const brainstorm = new Level4Brainstorm();
    vi.spyOn(brainstorm, 'generateArtifactsAsync').mockRejectedValue(new Error('async exploded'));

    const result = await brainstorm.execute({
      user_request: '补齐分支覆盖',
      context: '仅验证失败路径',
      errors: [],
    } as never);

    expect(result.decision).toBe('FAILED');
    expect(result.errors).toContain('头脑风暴执行失败: async exploded');
  });

  it('returns required agents deterministically', () => {
    const brainstorm = new Level4Brainstorm();

    expect(brainstorm.getRequiredAgents()).toEqual(['architect', 'writer', 'critic']);
  });

  it('uses sync and async fallback placeholders when role analysis fails', async () => {
    const brainstorm = new Level4Brainstorm();
    const syncSpy = vi.spyOn(brainstorm as never, '_analyzeAsRole' as never);
    syncSpy
      .mockImplementationOnce(() => {
        throw new Error('sync exploded');
      })
      .mockImplementationOnce(() =>
        makeAnalysis(BrainstormRole.SYSTEM_ARCHITECT, {
          analysisContent: 'ok',
          recommendations: ['建议 保持 兼容'],
        }),
      );

    const syncAnalyses = brainstorm.generateArtifacts('主题', [
      BrainstormRole.PRODUCT_MANAGER,
      BrainstormRole.SYSTEM_ARCHITECT,
    ]);

    expect(syncAnalyses).toHaveLength(2);
    expect(syncAnalyses[0]).toMatchObject({
      role: BrainstormRole.PRODUCT_MANAGER,
      score: 0,
    });
    expect(syncAnalyses[0]?.analysisContent).toContain('分析失败: sync exploded');

    const asyncSpy = vi.spyOn(brainstorm as never, '_analyzeAsRoleAsync' as never);
    asyncSpy
      .mockResolvedValueOnce(
        makeAnalysis(BrainstormRole.PRODUCT_MANAGER, {
          recommendations: ['建议 统一 接口'],
        }),
      )
      .mockRejectedValueOnce(new Error('async role exploded'));

    const asyncAnalyses = await brainstorm.generateArtifactsAsync('主题', [
      BrainstormRole.PRODUCT_MANAGER,
      BrainstormRole.SYSTEM_ARCHITECT,
    ]);

    expect(asyncAnalyses).toHaveLength(2);
    expect(asyncAnalyses[1]).toMatchObject({
      role: BrainstormRole.SYSTEM_ARCHITECT,
      score: 0,
    });
    expect(asyncAnalyses[1]?.analysisContent).toContain('分析失败: async role exploded');
  });

  it('stringifies non-Error async role failures during async artifact generation', async () => {
    const brainstorm = new Level4Brainstorm();
    const asyncSpy = vi.spyOn(brainstorm as never, '_analyzeAsRoleAsync' as never);
    asyncSpy
      .mockResolvedValueOnce(makeAnalysis(BrainstormRole.PRODUCT_MANAGER))
      .mockRejectedValueOnce('async role string failure');

    const analyses = await brainstorm.generateArtifactsAsync('主题', [
      BrainstormRole.PRODUCT_MANAGER,
      BrainstormRole.SYSTEM_ARCHITECT,
    ]);

    expect(analyses[1]).toMatchObject({
      role: BrainstormRole.SYSTEM_ARCHITECT,
      score: 0,
    });
    expect(analyses[1]?.analysisContent).toContain('分析失败: async role string failure');
  });

  it('returns async role fallback when writer.generate rejects', async () => {
    const container = {
      getAgent() {
        return {
          generate: vi.fn().mockRejectedValue(new Error('writer offline')),
          run: vi.fn(),
        };
      },
    };
    const brainstorm = new Level4Brainstorm({}, container as never);

    const analysis = await (brainstorm as any)._analyzeAsRoleAsync(
      BrainstormRole.CREATIVE_DIRECTOR,
      '主题',
      '上下文',
    );

    expect(analysis).toMatchObject({
      role: BrainstormRole.CREATIVE_DIRECTOR,
      score: 0,
    });
    expect(analysis.analysisContent).toContain('分析过程中出错: writer offline');
  });

  it('uses object content returned by writer.generate during async role analysis', async () => {
    const generate = vi.fn().mockResolvedValue({
      content: ['关键要点:', '- 保持接口一致', '建议:', '- 先补测试'].join('\n'),
    });
    const container = {
      getAgent() {
        return {
          generate,
          run: vi.fn(),
        };
      },
    };
    const brainstorm = new Level4Brainstorm({}, container as never);
    const parseSpy = vi
      .spyOn(brainstorm as never, '_parseAnalysisResult' as never)
      .mockReturnValue(makeAnalysis(BrainstormRole.CREATIVE_DIRECTOR, { analysisContent: 'parsed from object' }));

    const analysis = await (brainstorm as any)._analyzeAsRoleAsync(
      BrainstormRole.CREATIVE_DIRECTOR,
      '主题',
      '上下文',
    );

    expect(generate).toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalledWith(
      BrainstormRole.CREATIVE_DIRECTOR,
      ['关键要点:', '- 保持接口一致', '建议:', '- 先补测试'].join('\n'),
    );
    expect(analysis).toMatchObject({
      role: BrainstormRole.CREATIVE_DIRECTOR,
      analysisContent: 'parsed from object',
    });
  });

  it('handles empty and zero-score synthesis inputs', () => {
    const brainstorm = new Level4Brainstorm();

    expect(brainstorm.synthesize([])).toEqual({
      summary: '无可用分析结果',
      consensusPoints: [],
      divergentPoints: [],
      prioritizedRecommendations: [],
      riskAssessment: '',
      nextSteps: [],
      confidenceScore: 0,
    });

    const synthesis = brainstorm.synthesize([
      makeAnalysis(BrainstormRole.PRODUCT_MANAGER, {
        keyPoints: ['统一 接口 设计'],
        recommendations: ['建议 统一 接口'],
        concerns: ['避免 扩展 接口 风险'],
        score: 0,
      }),
      makeAnalysis(BrainstormRole.SYSTEM_ARCHITECT, {
        keyPoints: ['统一 接口 流程'],
        recommendations: ['建议 扩展 接口 自动化'],
        score: 0,
      }),
    ]);

    expect(synthesis.confidenceScore).toBe(0);
    expect(synthesis.divergentPoints).toHaveLength(1);
    expect(synthesis.summary).toContain('1 个分歧点');
  });

  it('builds specification with fallback objective, default deliverables, and truncated title', () => {
    const brainstorm = new Level4Brainstorm();
    const synthesis: BrainstormSynthesis = {
      summary: '',
      consensusPoints: ['统一接口', '先补测试'],
      divergentPoints: ['实现节奏不同'],
      prioritizedRecommendations: ['完成最小闭环'],
      riskAssessment: '低风险',
      nextSteps: [],
      confidenceScore: 0,
    };
    const topic = '这是一个非常长的话题标题'.repeat(5);

    const spec = brainstorm.generateSpecification(synthesis, topic);

    expect(spec.title).toContain('...');
    expect(spec.title.length).toBeLessThan(topic.length + 20);
    expect(spec.objective).toBe('基于多角色分析制定执行规范');
    expect(spec.deliverables).toEqual([
      '完成初始草案',
      '完成审查和修订',
      '生成最终输出',
    ]);
  });

  it('does not let unknown parse sections inherit previous buckets', () => {
    const brainstorm = new Level4Brainstorm();

    const parsed = (brainstorm as any)._parseAnalysisResult(
      BrainstormRole.PRODUCT_MANAGER,
      [
        '关键要点:',
        '- 保持统一接口',
        '其他说明:',
        '- 这一条不应落入关键要点',
        '建议:',
        '- 先补测试',
        '关注点:',
        '- 接口漂移需要监控',
      ].join('\n'),
    ) as RoleAnalysis;

    expect(parsed.keyPoints).toEqual(['保持统一接口']);
    expect(parsed.recommendations).toEqual(['先补测试']);
    expect(parsed.concerns).toEqual(['接口漂移需要监控']);
  });

  it('identifies conflicts, medium and high risks, and divergent summaries', () => {
    const brainstorm = new Level4Brainstorm();
    const analyses = [
      makeAnalysis(BrainstormRole.PRODUCT_MANAGER, {
        concerns: ['避免 扩展 接口 风险'],
      }),
      makeAnalysis(BrainstormRole.SYSTEM_ARCHITECT, {
        recommendations: ['建议 扩展 接口 自动化'],
      }),
    ];

    const divergent = (brainstorm as any)._findDivergence(analyses) as string[];
    const mediumRisk = (brainstorm as any)._assessRisks([
      '风险一',
      '风险二',
      '风险三',
      '风险四',
    ]) as string;
    const highRisk = (brainstorm as any)._assessRisks([
      '风险一',
      '风险二',
      '风险三',
      '风险四',
      '风险五',
      '风险六',
    ]) as string;
    const summary = (brainstorm as any)._generateSummary(
      [
        makeAnalysis(BrainstormRole.PRODUCT_MANAGER),
        makeAnalysis(BrainstormRole.SYSTEM_ARCHITECT),
        makeAnalysis(BrainstormRole.CREATIVE_DIRECTOR),
        makeAnalysis(BrainstormRole.REALIST),
      ],
      ['统一接口'],
      divergent,
    ) as string;

    expect(divergent).toHaveLength(1);
    expect(divergent[0]).toContain('产品经理');
    expect(divergent[0]).toContain('系统架构师');
    expect(mediumRisk).toContain('风险等级: 中');
    expect(highRisk).toContain('风险等级: 高');
    expect(summary).toContain('产品经理, 系统架构师, 创意总监等');
    expect(summary).toContain('1 个分歧点');
  });

  it('flags incomplete specifications during verification', () => {
    const brainstorm = new Level4Brainstorm();
    const invalidSpec: GuidanceSpecification = {
      title: '不完整规范',
      objective: '',
      scope: '范围',
      guidelines: ['仅一条指导原则'],
      constraints: [],
      successCriteria: [],
      qualityStandards: [],
      deliverables: [],
    };

    const verification = (brainstorm as any)._verifySpecification(invalidSpec) as {
      valid: boolean;
      score: number;
      issues: string[];
      suggestions: string[];
    };

    expect(verification.valid).toBe(false);
    expect(verification.score).toBe(55);
    expect(verification.issues).toEqual([
      '缺少目标描述',
      '缺少成功标准',
      '指导原则不足 (建议至少 2 条)',
    ]);
    expect(verification.suggestions).toEqual(['补充缺失的规范内容']);
  });
});
