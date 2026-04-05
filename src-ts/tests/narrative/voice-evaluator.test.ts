import { describe, expect, it } from 'vitest';

import { VoiceEvaluator } from '../../narrative/evaluators/voice-evaluator';

describe('narrative/evaluators/voice-evaluator', () => {
  it('quickScan returns voice-related metrics and lightweight issue signals', () => {
    const evaluator = new VoiceEvaluator();

    const result = evaluator.quickScan(
      '显然，她看见钟摆上的冷光，像针尖一样刺进眼底，可笑的是她仍假装镇定。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      specificity: expect.any(Number),
      vagueness_penalty: expect.any(Number),
      narrator_presence: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('语气快速扫描');
  });

  it('evaluate returns score, metrics, and issues for bounded voice-focused input', async () => {
    const evaluator = new VoiceEvaluator();

    const result = await evaluator.evaluate(
      '显然，她看见钟摆上的冷光，像针尖一样刺进眼底，可笑的是她仍假装镇定。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      specificity: expect.any(Number),
      vagueness_penalty: expect.any(Number),
      narrator_presence: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('语气强度');
  });
});
