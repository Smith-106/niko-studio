import { describe, expect, it } from 'vitest';

import { Severity } from '../../narrative/evaluators/base';
import { PyramidEvaluator } from '../../narrative/evaluators/pyramid-evaluator';

describe('narrative/evaluators/pyramid-evaluator additional coverage', () => {
  it('exposes metadata getters and handles empty content gracefully', async () => {
    const evaluator = new PyramidEvaluator();
    const result = await evaluator.evaluate('');

    expect(evaluator.name).toBe('pyramid_evaluator');
    expect(evaluator.description).toContain('Pyramid Principle');
    expect(evaluator.relatedSkill).toBe('pyramid-structure');
    expect(result.metrics).toMatchObject({
      conclusion_first: 50,
      vertical_structure: 60,
      horizontal_structure: 60,
      mece_compliance: 70,
    });
    expect(result.summary).toContain('逻辑结构得分');
  });

  it('reports missing conclusion-first structure and weak logical organization', async () => {
    const evaluator = new PyramidEvaluator();
    const content = [
      '背景是当前方案已经积累了很多历史包袱，我们先说明现状。',
      '',
      '现状描述主要停留在问题罗列，没有直接回答核心判断。',
      '',
      '团队讨论经常来回反复，读者很难快速抓住重点。',
    ].join('\n\n');

    const result = await evaluator.evaluate(content);
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toContain('PYRAMID_NO_CONCLUSION_FIRST');
    expect(codes).toContain('PYRAMID_BURIED_CONCLUSION');
    expect(codes).toContain('PYRAMID_WEAK_CAUSAL_CHAIN');
    expect(codes).toContain('PYRAMID_NO_STRUCTURE_MARKERS');
    expect(codes).toContain('PYRAMID_NO_CLEAR_FRAMEWORK');
    expect(result.summary).toContain('主要结构问题');
  });

  it('rewards strong pyramid structure while still flagging likely overlap', async () => {
    const evaluator = new PyramidEvaluator();
    const content = [
      '因此，我们应该统一入口，并将从以下三个方面展开。',
      '',
      '因为流程重复，所以协作成本上升。由于责任分散，导致风险增加。这是因为缺少统一标准。此外，更重要的是治理口径不一致。不仅如此，同时另外一方面，沟通也在反复折返。总之，这个方案可以分为三个维度。',
      '',
      '第一，alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta。',
      '',
      '第二，alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta。',
      '',
      '第三，alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta alpha beta gamma delta。',
    ].join('\n\n');

    const result = await evaluator.evaluate(content);
    const codes = result.issues.map((issue) => issue.code);

    expect(result.metrics.conclusion_first).toBeGreaterThanOrEqual(100);
    expect(result.metrics.vertical_structure).toBeGreaterThanOrEqual(90);
    expect(result.metrics.horizontal_structure).toBeGreaterThanOrEqual(90);
    expect(result.metrics.mece_compliance).toBeGreaterThanOrEqual(75);
    expect(codes).toContain('PYRAMID_POSSIBLE_OVERLAP');
    expect(result.score).toBeGreaterThan(80);
  });

  it('scores the intermediate horizontal-structure branch when exactly two markers exist', () => {
    const evaluator = new PyramidEvaluator() as unknown as {
      evaluateHorizontalStructure: (
        content: string,
        paragraphs: string[],
      ) => [number, Array<{ code: string }>];
    };
    const paragraphs = [
      '第一，统一入口可以减少上下文切换。',
      '第二，统一校验可以降低回归风险。',
    ];

    const [score, issues] = evaluator.evaluateHorizontalStructure(
      paragraphs.join('\n\n'),
      paragraphs,
    );

    expect(score).toBe(75);
    expect(issues).toEqual([]);
  });

  it('quickScan flags missing conclusion and structure markers for long content', () => {
    const evaluator = new PyramidEvaluator();
    const content = `${'背景说明需要补充细节但仍未给出结论 '.repeat(20)}尾段依然没有结构标记`;

    const result = evaluator.quickScan(content);

    expect(result.score).toBe(50);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'PYRAMID_NO_CONCLUSION_FIRST',
      'PYRAMID_NO_STRUCTURE_MARKERS',
    ]);
  });

  it('can summarize critical findings through the internal summary helper', () => {
    const evaluator = new PyramidEvaluator() as unknown as {
      generateSummary: (
        score: number,
        metrics: Record<string, number>,
        issues: Array<{ severity: Severity }>,
      ) => string;
    };

    const summary = evaluator.generateSummary(
      12.3,
      { custom_low: 10, custom_high: 80 },
      [{ severity: Severity.CRITICAL }],
    );

    expect(summary).toContain('最强：custom_high');
    expect(summary).toContain('最弱：custom_low');
    expect(summary).toContain('严重结构问题');
  });
});
