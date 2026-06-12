import { describe, expect, it, vi } from 'vitest';

import {
  type DreamLayerScore,
  DreamStrength,
  FictionalDreamEngine,
} from '../../narrative/fictional_dream/engine';

type FictionalDreamEngineInternals = FictionalDreamEngine & {
  calculateOverallScore(layerScores: DreamLayerScore[]): number;
  determineStrength(score: number): DreamStrength;
  detectDreamBreakers(content: string): Promise<string[]>;
  generateMasterSuggestions(
    layerScores: DreamLayerScore[],
    strength: DreamStrength,
    breakers: string[],
  ): string[];
};

function makeLayerScore(
  layerName: string,
  score: number,
  suggestions: string[] = [`improve ${layerName}`],
): DreamLayerScore {
  return {
    layerName,
    score,
    isEffective: score >= 60,
    keyFindings: [],
    suggestions,
  };
}

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

  it('threads llm refinements through all four fictional-dream layers', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({
          triggers: [
            {
              trigger_type: 'injustice',
              effectiveness: 0.91,
              vulnerability_level: 0.82,
              universality: 0.74,
            },
          ],
        })
        .mockResolvedValueOnce({
          is_detected: true,
          moral_flaw: '她曾协助走私',
          noble_goal: '保护弟弟并公开真相',
          sympathy_transfer_path: '弟弟的依赖先让读者站到她这一边',
          effectiveness: 0.8,
        })
        .mockResolvedValueOnce({
          sensory_details: [
            {
              sense_type: 'visual',
              emotion_evoked: '压迫',
              body_plant_effect: 0.79,
              text_location: '开场',
            },
          ],
        })
        .mockResolvedValueOnce({
          conflicts: [
            {
              dilemma:
                '她看见冷雨落在手背上，听见钟声回响，胸口发紧，在良知与生存之间左右为难，一方面想保护弟弟，另一方面又不愿背叛同伴',
              option_a: '保护弟弟',
              option_b: '不背叛同伴',
              stakes: '失去亲人或失去底线',
              honor_involved: true,
              dilemma_type: 'moral',
              intensity: 0.86,
            },
          ],
        }),
    };
    const engine = new FictionalDreamEngine(llm);

    const result = await engine.evaluate(
      '她被误解、背叛，却仍然坚持保护弟弟。她看见冷雨落在手背上，听见钟声回响，胸口发紧，在良知与生存之间左右为难，一方面想保护弟弟，另一方面又不愿背叛同伴。',
      { role: 'morally gray detective' },
    );

    expect(llm.generateJson).toHaveBeenCalled();
    expect(llm.generateJson.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(result.sympathy.triggersDetected[0]).toMatchObject({
      effectiveness: 0.91,
      vulnerabilityLevel: 0.82,
      universality: 0.74,
    });
    expect(result.identification.godfatherTechnique).toMatchObject({
      isDetected: true,
      moralFlaw: '她曾协助走私',
      nobleGoal: '保护弟弟并公开真相',
      sympathyTransferPath: '弟弟的依赖先让读者站到她这一边',
      effectiveness: 0.8,
    });
    expect(result.empathy.sensoryDetails[0]).toMatchObject({
      emotionEvoked: '压迫',
      bodyPlantEffect: 0.79,
      textLocation: '开场',
    });
    expect(
      result.immersion.internalConflicts.find(
        (conflict) => conflict.optionA === '保护弟弟',
      ),
    ).toMatchObject({
      optionA: '保护弟弟',
      optionB: '不背叛同伴',
      stakes: '失去亲人或失去底线',
      honorInvolved: true,
      dilemmaType: 'moral',
      intensity: 0.86,
    });
  });

  it('covers dream strength boundaries, score shape guard, and dream breaker detection', async () => {
    const engine = new FictionalDreamEngine() as FictionalDreamEngineInternals;

    expect(engine.calculateOverallScore([makeLayerScore('only-one', 100)])).toBe(0);
    expect(engine.determineStrength(95)).toBe(DreamStrength.HYPNOTIC);
    expect(engine.determineStrength(80)).toBe(DreamStrength.STRONG);
    expect(engine.determineStrength(65)).toBe(DreamStrength.MODERATE);
    expect(engine.determineStrength(45)).toBe(DreamStrength.WEAK);
    expect(engine.determineStrength(20)).toBe(DreamStrength.BROKEN);

    await expect(
      engine.detectDreamBreakers('读者会立刻明白。首先，其次，第一，第二，总之，这是一段说明。'),
    ).resolves.toEqual([
      expect.stringContaining('作者跳出叙事'),
      expect.stringContaining('信息堆砌'),
    ]);
  });

  it('generates master suggestions for every strength and continuity warning branch', () => {
    const engine = new FictionalDreamEngine() as FictionalDreamEngineInternals;
    const fracturedLayers = [
      makeLayerScore('sympathy', 45, ['raise sympathy']),
      makeLayerScore('identification', 80, ['raise identification']),
      makeLayerScore('empathy', 72, ['raise empathy']),
      makeLayerScore('immersion', 92, ['raise immersion']),
    ];

    for (const strength of Object.values(DreamStrength)) {
      const suggestions = engine.generateMasterSuggestions(
        fracturedLayers,
        strength,
        ['explicit dream breaker'],
      );

      expect(suggestions[0]).toBeTruthy();
      expect(suggestions).toContain('\n最需要加强的层级: sympathy');
      expect(suggestions).toContain('raise sympathy');
      expect(suggestions).toContain('\n层级断裂警告: sympathy 未能有效支撑 identification');
      expect(suggestions).toContain('\n梦境破坏者:');
      expect(suggestions).toContain('explicit dream breaker');
    }
  });
});
