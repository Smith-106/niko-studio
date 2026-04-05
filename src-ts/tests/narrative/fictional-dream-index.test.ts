import { describe, expect, it } from 'vitest';

import * as fictionalDream from '../../narrative/fictional_dream';
import {
  DreamEvaluator,
} from '../../narrative/fictional_dream/evaluator';
import {
  DreamStrength,
  FictionalDreamEngine,
} from '../../narrative/fictional_dream/engine';
import {
  EmpathyDeepener,
  SenseType,
} from '../../narrative/fictional_dream/empathy';
import {
  IdentificationBuilder,
  IdentificationElement,
} from '../../narrative/fictional_dream/identification';
import { ImmersionCatalyst } from '../../narrative/fictional_dream/immersion';
import { SympathyAnalyzer } from '../../narrative/fictional_dream/sympathy';

describe('narrative/fictional_dream index barrel', () => {
  it('re-exports representative fictional-dream classes, enums, and builders through the barrel', () => {
    expect(fictionalDream.SympathyAnalyzer).toBe(SympathyAnalyzer);
    expect(fictionalDream.IdentificationBuilder).toBe(IdentificationBuilder);
    expect(fictionalDream.EmpathyDeepener).toBe(EmpathyDeepener);
    expect(fictionalDream.ImmersionCatalyst).toBe(ImmersionCatalyst);
    expect(fictionalDream.FictionalDreamEngine).toBe(FictionalDreamEngine);
    expect(fictionalDream.DreamEvaluator).toBe(DreamEvaluator);

    expect(fictionalDream.DreamStrength).toBe(DreamStrength);
    expect(fictionalDream.SenseType).toBe(SenseType);
    expect(fictionalDream.IdentificationElement).toBe(IdentificationElement);
  });

  it('provides working representative fictional-dream instances through the barrel', async () => {
    const sympathy = new fictionalDream.SympathyAnalyzer();
    const empathy = new fictionalDream.EmpathyDeepener();
    const immersion = new fictionalDream.ImmersionCatalyst();
    const engine = new fictionalDream.FictionalDreamEngine();
    const evaluator = new fictionalDream.DreamEvaluator();

    const sympathyResult = await sympathy.analyze('她被误解、孤立，却仍然坚持保护弟弟。');
    const quickScores = await engine.quickEvaluate('她被误解、孤立，却仍然坚持保护弟弟，手心发抖，胸口发紧。');
    const quickReport = await evaluator.quickScan('她被误解、孤立，却仍然坚持保护弟弟，手心发抖，胸口发紧。');

    expect(sympathyResult.overallScore).toBeGreaterThanOrEqual(0);
    expect(empathy.evaluateBodyPlant('手心发抖，胸口发紧，呼吸急促。')).toBeGreaterThan(0);
    expect(typeof immersion.detectMoralDilemma('她在良知与生存之间左右为难。')).toBe(
      'boolean',
    );
    expect(quickScores).toMatchObject({
      sympathy: expect.any(Number),
      empathy: expect.any(Number),
      immersion: expect.any(Number),
    });
    expect(quickReport.strength).toBeDefined();
    expect(Object.values(fictionalDream.DreamStrength)).toContain(quickReport.strength);
  });
});
