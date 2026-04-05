import { describe, expect, it } from 'vitest';

import {
  SympathyAnalyzer,
  SympathyTrigger,
} from '../../narrative/fictional_dream/sympathy';

describe('narrative/fictional_dream/sympathy', () => {
  it('detects universal predicament categories from keyword matches', () => {
    const analyzer = new SympathyAnalyzer();

    const detected = analyzer.detectUniversalPredicament(
      '她被误解、孤立，还面临死亡威胁，最终失去唯一的亲人。',
    );

    expect(detected).toEqual(
      expect.arrayContaining([
        SympathyTrigger.INJUSTICE,
        SympathyTrigger.LONELINESS_EXCLUSION,
        SympathyTrigger.DANGER,
        SympathyTrigger.LOSS,
      ]),
    );
  });

  it('produces a stable no-llm sympathy analysis result with scores and suggestions', async () => {
    const analyzer = new SympathyAnalyzer();

    const result = await analyzer.analyze(
      '她被误解和背叛，只能独自逃离危险的旧城区。即使满怀恐惧，她仍试图保护弟弟，最终却失去了一切。',
    );

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.triggersDetected.length).toBeGreaterThan(0);
    expect(result.vulnerabilityDisplay).toBeGreaterThan(0);
    expect(result.universalPredicament).toBe(false);
    expect(
      result.triggersDetected.some(trigger => trigger.triggerType === SympathyTrigger.INJUSTICE),
    ).toBe(true);
    expect(
      result.triggersDetected.some(
        trigger => trigger.triggerType === SympathyTrigger.LONELINESS_EXCLUSION,
      ),
    ).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
