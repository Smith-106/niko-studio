import { describe, expect, it, vi } from 'vitest';

import {
  DreamEvaluator,
} from '../../narrative/fictional_dream/evaluator';

describe('narrative/fictional_dream/evaluator', () => {
  it('quickScan returns a stable report shape on no-llm input', async () => {
    const evaluator = new DreamEvaluator();

    const report = await evaluator.quickScan(
      '她被误解、孤立，却仍然坚持保护弟弟，手心发抖，胸口发紧，并在良知与生存之间左右为难。',
    );

    expect(report).toMatchObject({
      strength: expect.any(String),
      score: expect.any(Number),
      weakestLayer: expect.any(String),
    });
    expect(Array.isArray(report.top3Issues)).toBe(true);
    expect(Array.isArray(report.quickWins)).toBe(true);
  });

  it('standardEvaluate and deepDiagnosis expose the full result and diagnosis envelopes', async () => {
    const evaluator = new DreamEvaluator();
    const content =
      '她被误解、孤立，却仍然坚持保护弟弟。她看到冷雨落在手背上，胸口发紧，只能在良知与求生之间左右为难。';

    const standard = await evaluator.standardEvaluate(content);
    const deep = await evaluator.deepDiagnosis(content);

    expect(standard.overallScore).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(standard.layerScores)).toBe(true);
    expect(Array.isArray(standard.masterSuggestions)).toBe(true);
    expect(deep.result.overallScore).toBeGreaterThanOrEqual(0);
    expect(deep.diagnosis.overallHealth).toBeTruthy();
    expect(Array.isArray(deep.diagnosis.layerDiagnosis)).toBe(true);
    expect(Array.isArray(deep.diagnosis.masterComparisons)).toBe(true);
    expect(Array.isArray(deep.diagnosis.improvementPlan)).toBe(true);
  });

  it('propagates llm-refined layer details through standard and deep evaluator flows', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({
          triggers: [
            {
              trigger_type: 'injustice',
              effectiveness: 0.93,
              vulnerability_level: 0.81,
              universality: 0.72,
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
              body_plant_effect: 0.78,
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
              intensity: 0.84,
            },
          ],
        })
        .mockResolvedValueOnce({
          triggers: [
            {
              trigger_type: 'injustice',
              effectiveness: 0.93,
              vulnerability_level: 0.81,
              universality: 0.72,
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
              body_plant_effect: 0.78,
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
              intensity: 0.84,
            },
          ],
        }),
    };
    const evaluator = new DreamEvaluator(llm);
    const content =
      '她被误解、背叛，却仍然坚持保护弟弟。她看见冷雨落在手背上，听见钟声回响，胸口发紧，在良知与生存之间左右为难，一方面想保护弟弟，另一方面又不愿背叛同伴。';

    const standard = await evaluator.standardEvaluate(content, { role: 'morally gray detective' });
    const deep = await evaluator.deepDiagnosis(content, { role: 'morally gray detective' });

    expect(llm.generateJson).toHaveBeenCalledTimes(8);
    expect(standard.sympathy.triggersDetected[0]).toMatchObject({
      effectiveness: 0.93,
      vulnerabilityLevel: 0.81,
      universality: 0.72,
    });
    expect(standard.identification.godfatherTechnique).toMatchObject({
      isDetected: true,
      moralFlaw: '她曾协助走私',
      nobleGoal: '保护弟弟并公开真相',
    });
    expect(standard.empathy.sensoryDetails[0]).toMatchObject({
      emotionEvoked: '压迫',
      bodyPlantEffect: 0.78,
    });
    expect(
      standard.immersion.internalConflicts.find((conflict) => conflict.optionA === '保护弟弟'),
    ).toMatchObject({
      optionB: '不背叛同伴',
      stakes: '失去亲人或失去底线',
      honorInvolved: true,
      dilemmaType: 'moral',
      intensity: 0.84,
    });
    expect(deep.result.identification.godfatherTechnique.isDetected).toBe(true);
    expect(Array.isArray(deep.diagnosis.improvementPlan)).toBe(true);
  });
});
