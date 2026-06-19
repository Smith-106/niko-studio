import { describe, expect, it } from 'vitest';

import { DreamEvaluator } from '../../narrative/evaluators/dream-evaluator';

describe('narrative/evaluators/dream-evaluator branch-gap coverage', () => {
  it('emits weak identification and immersion issues for low-engagement content', async () => {
    const evaluator = new DreamEvaluator();

    const result = await evaluator.evaluate('plain neutral text without dream markers');

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DREAM_IDENTIFICATION_WEAK' }),
        expect.objectContaining({ code: 'DREAM_IMMERSION_WEAK' }),
      ]),
    );
  });

  it('increases sympathy when hardship keywords are present', () => {
    const evaluator = new DreamEvaluator();

    expect((evaluator as any).evaluateSympathy('危险与贫穷同时逼近')).toBeGreaterThan(50);
  });

  it('returns zero empathy and immersion scores for empty content', () => {
    const evaluator = new DreamEvaluator();

    expect((evaluator as any).evaluateEmpathy('')).toBe(0);
    expect((evaluator as any).evaluateImmersion('')).toBe(0);
  });

  it('covers empathy density thresholds at 100, 80, and 60', () => {
    const evaluator = new DreamEvaluator();

    const highDensity = `看到看到看到${'a'.repeat(80)}`;
    const mediumDensity = `看到看到看到${'b'.repeat(450)}`;
    const lowMediumDensity = `看到看到${'c'.repeat(600)}`;

    expect((evaluator as any).evaluateEmpathy(highDensity)).toBe(100);
    expect((evaluator as any).evaluateEmpathy(mediumDensity)).toBe(80);
    expect((evaluator as any).evaluateEmpathy(lowMediumDensity)).toBe(60);
  });

  it('covers immersion density thresholds at 80 and 60', () => {
    const evaluator = new DreamEvaluator();

    const mediumHighDensity = `但是但是但是${'d'.repeat(450)}`;
    const mediumDensity = `但是但是${'e'.repeat(600)}`;

    expect((evaluator as any).evaluateImmersion(mediumHighDensity)).toBe(80);
    expect((evaluator as any).evaluateImmersion(mediumDensity)).toBe(60);
  });
});
