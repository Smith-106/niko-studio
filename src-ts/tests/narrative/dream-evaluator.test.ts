import { describe, expect, it } from 'vitest';

import { DreamEvaluator } from '../../narrative/evaluators/dream-evaluator';

describe('narrative/evaluators/dream-evaluator', () => {
  it('quickScan returns a stable score and issue envelope for bounded dream inputs', () => {
    const evaluator = new DreamEvaluator();

    const result = evaluator.quickScan(
      '她被误解、孤立，却仍然坚持保护弟弟。手心发抖，胸口发紧，她在良知与求生之间左右为难。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.level).toBeTruthy();
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('快速扫描');
  });

  it('evaluate returns metrics and issues aligned with fictional-dream layers', async () => {
    const evaluator = new DreamEvaluator();

    const result = await evaluator.evaluate(
      '她被误解、孤立，却仍然坚持保护弟弟。手心发抖，胸口发紧，她在良知与求生之间左右为难。',
      { character_goal: '保护弟弟' },
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      sympathy: expect.any(Number),
      identification: expect.any(Number),
      empathy: expect.any(Number),
      immersion: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('梦境强度');
  });
});
