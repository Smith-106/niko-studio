import { describe, expect, it } from 'vitest';

import { PremiseEvaluator } from '../../narrative/evaluators/premise-evaluator';

describe('narrative/evaluators/premise-evaluator', () => {
  it('quickScan returns premise-related metrics and lightweight issue signals', () => {
    const evaluator = new PremiseEvaluator();

    const result = evaluator.quickScan(
      '因为她执意追查，所以真相反而更靠近；讽刺的是，她最信任的人偏偏在误导她。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      causality: expect.any(Number),
      irony: expect.any(Number),
      consistency: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('预设快速扫描');
  });

  it('evaluate returns score, metrics, and issues for bounded premise-focused input', async () => {
    const evaluator = new PremiseEvaluator();

    const result = await evaluator.evaluate(
      '因为她执意追查，所以真相反而更靠近；讽刺的是，她最信任的人偏偏在误导她。',
      { premise: '执意追查导致真相更近' },
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      causality: expect.any(Number),
      irony: expect.any(Number),
      consistency: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('预设强度');
  });
});
