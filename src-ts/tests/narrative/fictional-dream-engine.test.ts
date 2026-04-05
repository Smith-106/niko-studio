import { describe, expect, it } from 'vitest';

import {
  DreamStrength,
  FictionalDreamEngine,
} from '../../narrative/fictional_dream/engine';

describe('narrative/fictional_dream/engine', () => {
  it('exposes dream-strength metadata and quickEvaluate scores through the public api', async () => {
    const engine = new FictionalDreamEngine();

    const scores = await engine.quickEvaluate(
      '她被误解、孤立，却仍然坚持保护弟弟，手心发抖，胸口发紧，并在良知与生存之间左右为难。',
    );

    expect(Object.values(DreamStrength)).toEqual([
      'hypnotic',
      'strong',
      'moderate',
      'weak',
      'broken',
    ]);
    expect(scores).toMatchObject({
      sympathy: expect.any(Number),
      identification: expect.any(Number),
      empathy: expect.any(Number),
      immersion: expect.any(Number),
    });
  });

  it('produces a stable no-llm evaluation result shape across all four layers', async () => {
    const engine = new FictionalDreamEngine();

    const result = await engine.evaluate(
      '她被误解、孤立，却仍然坚持保护弟弟。她看到冷雨落在手背上，胸口发紧，只能在良知与求生之间左右为难。',
    );

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(Object.values(DreamStrength)).toContain(result.dreamStrength);
    expect(result.layerScores).toHaveLength(4);
    expect(result.sympathy.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.identification.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.empathy.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.immersion.overallScore).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.masterSuggestions)).toBe(true);
    expect(Array.isArray(result.dreamBreakers)).toBe(true);
  });
});
