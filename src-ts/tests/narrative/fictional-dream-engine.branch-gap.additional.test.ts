import { describe, expect, it } from 'vitest';

import { FictionalDreamEngine } from '../../narrative/fictional_dream/engine';

describe('narrative/fictional_dream/engine branch gaps', () => {
  it('covers the no-carrie and no-moral-dilemma branches', async () => {
    const engine = new FictionalDreamEngine();
    const plainContent = [
      'A quiet library at dusk.',
      'Shelves stand still.',
      'Dust drifts through the window while the narrator simply observes.',
    ].join(' ');

    const result = await engine.evaluate(plainContent);
    const quick = await engine.quickEvaluate(plainContent);

    expect(result.empathy.carrieTechnique.isDetected).toBe(false);
    expect(quick.immersion).toBe(20);
  });

  it('covers the quickEvaluate moral-dilemma true branch', async () => {
    const engine = new FictionalDreamEngine();
    const moralDilemmaContent = [
      '她知道这样做在道德上不应该。',
      '可眼前的局势让她左右为难。',
      '良心与生存同时逼近。',
    ].join('');

    const quick = await engine.quickEvaluate(moralDilemmaContent);

    expect(quick.immersion).toBe(50);
  });
});
