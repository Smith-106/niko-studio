import { describe, expect, it } from 'vitest';

import {
  EmpathyDeepener,
  SenseType,
  type SensoryDetail,
} from '../../narrative/fictional_dream/empathy';

describe('narrative/fictional_dream/empathy additional coverage', () => {
  it('matches longer llm content and preserves fallback values for blank refinement fields', () => {
    const deepener = new EmpathyDeepener() as any;
    const details: SensoryDetail[] = [
      {
        senseType: SenseType.VISUAL,
        content: '冷雨打在窗上',
        emotionEvoked: '压抑',
        bodyPlantEffect: 0.4,
        textLocation: '原始位置',
      },
    ];

    const merged = deepener.mergeLlmSensoryDetails(details, [
      {
        content: '她看见冷雨打在窗上',
        emotion_evoked: '   ',
        body_plant_effect: 'NaN',
        text_location: '   ',
      },
    ]) as SensoryDetail[];

    expect(merged[0]).toMatchObject({
      senseType: SenseType.VISUAL,
      content: '冷雨打在窗上',
      emotionEvoked: '压抑',
      bodyPlantEffect: 0.4,
      textLocation: '原始位置',
    });
  });

  it('keeps unmatched sensory details unchanged when llm candidates are exhausted', () => {
    const deepener = new EmpathyDeepener() as any;
    const details: SensoryDetail[] = [
      {
        senseType: SenseType.VISUAL,
        content: '冷雨打在窗上',
        emotionEvoked: '压抑',
        bodyPlantEffect: 0.4,
        textLocation: '第一段',
      },
      {
        senseType: SenseType.AUDITORY,
        content: '钟声在长廊里回荡',
        emotionEvoked: '不安',
        bodyPlantEffect: 0.3,
        textLocation: '第二段',
      },
    ];

    const merged = deepener.mergeLlmSensoryDetails(details, [
      {
        sense_type: SenseType.VISUAL,
        content: '冷雨打在窗上',
        emotion_evoked: '窒息',
        body_plant_effect: 0.9,
        text_location: '开头',
      },
    ]) as SensoryDetail[];

    expect(merged[0]).toMatchObject({
      emotionEvoked: '窒息',
      bodyPlantEffect: 0.9,
      textLocation: '开头',
    });
    expect(merged[1]).toEqual(details[1]);
  });

  it('handles unknown coverage keys through the nullish fallback branch', () => {
    const deepener = new EmpathyDeepener() as any;

    const coverage = deepener.calculateCoverage([
      {
        senseType: 'mystery',
        content: '未知感官',
        emotionEvoked: '困惑',
        bodyPlantEffect: 0.2,
        textLocation: '段落一',
      },
    ]);

    expect(coverage.mystery).toBe(1);
  });

  it('detects a red-badge sensory chain across consecutive sensory sentences', async () => {
    const deepener = new EmpathyDeepener() as any;

    const result = await deepener.analyzeRedBadgeTechnique(
      '她看见冷雨打在窗上。她听见钟声回响。她手心发抖，呼吸急促。',
    );

    expect(result).toMatchObject({
      isDetected: true,
    });
    expect(result.immersiveEffect).toBeGreaterThan(0);
    expect(result.sensoryChain.length).toBeGreaterThanOrEqual(3);
  });

  it('adds red-badge bonus when calculating body-plant score', () => {
    const deepener = new EmpathyDeepener() as any;

    const score = deepener.calculateBodyPlantScore(
      [],
      { isDetected: false, physicalStateDescriptions: [], emotionThroughBody: [], effectiveness: 0 },
      { isDetected: true, sensoryChain: ['a', 'b', 'c'], immersiveEffect: 0.5 },
    );

    expect(score).toBe(15);
  });

  it('adds kinesthetic suggestions when the coverage map omits that sense entirely', async () => {
    const deepener = new EmpathyDeepener() as any;

    const suggestions = await deepener.generateSuggestions(
      '',
      [],
      {
        [SenseType.VISUAL]: 1,
      },
      20,
    );

    expect(suggestions.some((item: string) => item.includes('嘉莉'))).toBe(true);
    expect(suggestions.some((item: string) => item.includes('身体状态'))).toBe(true);
  });
});
