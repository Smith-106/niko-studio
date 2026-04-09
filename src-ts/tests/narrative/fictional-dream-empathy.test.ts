import { describe, expect, it, vi } from 'vitest';

import {
  EmpathyDeepener,
  SenseType,
} from '../../narrative/fictional_dream/empathy';

describe('narrative/fictional_dream/empathy', () => {
  it('evaluates body-plant effect from physical-state keywords', () => {
    const deepener = new EmpathyDeepener();

    const score = deepener.evaluateBodyPlant('手心发抖，胸口发紧，呼吸急促，脊背发凉。');

    expect(score).toBeGreaterThan(0);
  });

  it('produces a stable no-llm empathy analysis result with sensory details and suggestions', async () => {
    const deepener = new EmpathyDeepener();

    const result = await deepener.analyze(
      '她看见冷雨打在窗上，听见钟声回响，手心发抖，胸口发紧，仿佛整个人都被拖进了那场旧梦。',
      undefined,
      60,
    );

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.bodyPlantScore).toBeGreaterThan(0);
    expect(result.sensoryDetails.length).toBeGreaterThan(0);
    expect(result.sensoryCoverage[SenseType.VISUAL]).toBeGreaterThanOrEqual(0);
    expect(result.sensoryCoverage[SenseType.AUDITORY]).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('merges llm sensory refinements into detected empathy details when available', async () => {
    const llm = {
      generateJson: vi.fn(async () => ({
        sensory_details: [
          {
            sense_type: SenseType.VISUAL,
            content: '她看见冷雨打在窗上',
            emotion_evoked: '压迫',
            body_plant_effect: 0.82,
            text_location: '开场段落',
          },
          {
            senseType: SenseType.AUDITORY,
            content: '听见钟声回响',
            emotionEvoked: '不安',
            bodyPlantEffect: 0.76,
            textLocation: '中段',
          },
        ],
      })),
    };
    const deepener = new EmpathyDeepener(llm);

    const result = await deepener.analyze(
      '她看见冷雨打在窗上，听见钟声回响，手心发抖，胸口发紧，仿佛整个人都被拖进了那场旧梦。',
      undefined,
      60,
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(
      result.sensoryDetails.find((detail) => detail.senseType === SenseType.VISUAL),
    ).toMatchObject({
      emotionEvoked: '压迫',
      bodyPlantEffect: 0.82,
      textLocation: '开场段落',
    });
    expect(
      result.sensoryDetails.find((detail) => detail.senseType === SenseType.AUDITORY),
    ).toMatchObject({
      emotionEvoked: '不安',
      bodyPlantEffect: 0.76,
      textLocation: '中段',
    });
  });
});
