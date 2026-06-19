import { describe, expect, it, vi } from 'vitest';

import {
  ComprehensiveReport,
  CriticEngine,
} from '../../narrative/evaluators/critic-engine';
import {
  EvaluationResult,
  ScoreLevel,
  Severity,
} from '../../narrative/evaluators/base';

describe('narrative/evaluators/critic-engine additional branches', () => {
  it('renders suggestion and recommended skill sections in markdown output', () => {
    const report = new ComprehensiveReport({
      overallScore: 61,
      overallLevel: 'fair',
      moduleScores: { suspense: 61 },
      allIssues: [
        {
          code: 'SUSPENSE-1',
          message: '冲突升级偏慢',
          severity: Severity.MAJOR,
          suggestion: '补充更明确的倒计时压力',
          relatedSkill: 'revision-craft',
        },
      ],
      criticalIssues: [],
      top3Issues: [
        {
          code: 'SUSPENSE-1',
          message: '冲突升级偏慢',
          severity: Severity.MAJOR,
          suggestion: '补充更明确的倒计时压力',
          relatedSkill: 'revision-craft',
        },
      ],
      moduleResults: {},
      summary: '需要加强悬念推进。',
      recommendedSkills: ['revision-craft'],
    });

    const markdown = report.toMarkdown();

    expect(markdown).toContain('建议: 补充更明确的倒计时压力');
    expect(markdown).toContain('## 推荐技能包');
    expect(markdown).toContain('`skills/revision-craft/SKILL.md`');
  });

  it('skips unknown modules, uses fallback weights, and sorts unknown severities last', async () => {
    const engine = new CriticEngine();

    const customResult = new EvaluationResult(
      'custom',
      10,
      ScoreLevel.FAIR,
      [
        {
          code: 'CUSTOM-UNKNOWN',
          message: '未知严重度问题',
          severity: 'mystery' as Severity,
          relatedSkill: 'ghost-skill',
        },
        {
          code: 'CUSTOM-MAJOR',
          message: '主要问题',
          severity: Severity.MAJOR,
          relatedSkill: 'outline-generator',
        },
      ],
      {},
      '自定义模块摘要',
    );
    const suspenseResult = new EvaluationResult(
      'suspense',
      80,
      ScoreLevel.GOOD,
      [
        {
          code: 'SUSPENSE-CRITICAL',
          message: '关键冲突缺失',
          severity: Severity.CRITICAL,
          suggestion: '补足核心抉择',
          relatedSkill: 'revision-craft',
        },
      ],
      {},
      '悬念模块摘要',
    );

    const customEvaluator = {
      evaluate: vi.fn().mockResolvedValue(customResult),
      quickScan: vi.fn().mockReturnValue(customResult),
    };
    const suspenseEvaluator = {
      evaluate: vi.fn().mockResolvedValue(suspenseResult),
      quickScan: vi.fn().mockReturnValue(suspenseResult),
    };

    (engine as any).evaluators = {
      custom: customEvaluator,
      suspense: suspenseEvaluator,
    };
    (engine as any).weights = {
      custom: undefined,
      suspense: 0.3,
    };

    const report = await engine.evaluate('测试文本', {}, ['custom', 'missing', 'suspense']);

    expect(customEvaluator.evaluate).toHaveBeenCalledOnce();
    expect(suspenseEvaluator.evaluate).toHaveBeenCalledOnce();
    expect(report.moduleScores).toEqual({
      custom: 10,
      suspense: 80,
    });
    expect(report.criticalIssues.map((issue) => issue.code)).toEqual([
      'SUSPENSE-CRITICAL',
    ]);
    expect(report.top3Issues.map((issue) => issue.code)).toEqual([
      'SUSPENSE-CRITICAL',
      'CUSTOM-MAJOR',
      'CUSTOM-UNKNOWN',
    ]);
    expect(report.recommendedSkills).toEqual([
      'revision-craft',
      'outline-generator',
      'ghost-skill',
    ]);
    expect(report.overallScore).toBeCloseTo(86.6666666667, 6);
  });

  it('handles empty module selections and unknown summary levels', async () => {
    const engine = new CriticEngine();

    (engine as any).evaluators = {};
    (engine as any).weights = {};

    const emptyReport = await engine.evaluate('测试文本', {}, []);

    expect(emptyReport.moduleScores).toEqual({});
    expect(emptyReport.summary).toContain('最强模块：N/A，最弱模块：N/A');
    expect(emptyReport.summary).not.toContain('首要问题');
    expect((engine as any).generateSummary(12, 'mystery', {}, [])).toContain(
      '总体评价：未知（12.0分）。',
    );
  });

  it('uses fallback quick-scan weights for modules outside the default table', async () => {
    const engine = new CriticEngine();
    const quickResult = new EvaluationResult(
      'quick-only',
      60,
      ScoreLevel.FAIR,
      [],
      {},
      '快速扫描摘要',
    );
    const quickEvaluator = {
      evaluate: vi.fn().mockResolvedValue(quickResult),
      quickScan: vi.fn().mockReturnValue(quickResult),
    };

    (engine as any).evaluators = { 'quick-only': quickEvaluator };
    (engine as any).weights = { 'quick-only': undefined };

    const report = await engine.quickScan('测试文本');

    expect(quickEvaluator.quickScan).toHaveBeenCalledOnce();
    expect(report.overallScore).toBe(12);
    expect(report.summary).toContain('总分：12.0');
  });
});
