import { describe, expect, it } from 'vitest';

import { PyramidEvaluator } from '../../narrative/evaluators/pyramid-evaluator';

describe('narrative/evaluators/pyramid-evaluator', () => {
  it('quickScan returns a stable score and issue envelope for bounded structured content', () => {
    const evaluator = new PyramidEvaluator();

    const result = evaluator.quickScan(
      '因此，我们应该统一入口。首先说明问题，其次比较方案，最后给出结论。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.level).toBeTruthy();
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('evaluate returns logical-structure metrics and summary through the public api', async () => {
    const evaluator = new PyramidEvaluator();

    const result = await evaluator.evaluate(
      '因此，我们应该统一入口。\\n\\n首先，当前实现路径分散。\\n\\n其次，重复验证成本过高。\\n\\n最后，统一入口能降低回归风险并提升可维护性。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      conclusion_first: expect.any(Number),
      vertical_structure: expect.any(Number),
      horizontal_structure: expect.any(Number),
      mece_compliance: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary.length).toBeGreaterThan(0);
  });
});
