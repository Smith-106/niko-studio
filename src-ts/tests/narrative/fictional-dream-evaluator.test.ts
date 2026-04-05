import { describe, expect, it } from 'vitest';

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
});
