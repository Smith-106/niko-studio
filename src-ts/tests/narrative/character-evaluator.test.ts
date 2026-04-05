import { describe, expect, it } from 'vitest';

import { CharacterEvaluator } from '../../narrative/evaluators/character-evaluator';

describe('narrative/evaluators/character-evaluator', () => {
  it('quickScan returns character-depth metrics and lightweight issue signals', () => {
    const evaluator = new CharacterEvaluator();

    const result = evaluator.quickScan(
      '她擅长追踪，却总带着古怪的旧表，一方面想继续追查，一方面又害怕再次失败。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      competence: expect.any(Number),
      eccentricity: expect.any(Number),
      inner_conflict: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('人物快速扫描');
  });

  it('evaluate returns score, metrics, and issues for bounded character-focused input', async () => {
    const evaluator = new CharacterEvaluator();

    const result = await evaluator.evaluate(
      '她擅长追踪，却总带着古怪的旧表，一方面想继续追查，一方面又害怕再次失败。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      competence: expect.any(Number),
      eccentricity: expect.any(Number),
      inner_conflict: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('人物深度');
  });
});
