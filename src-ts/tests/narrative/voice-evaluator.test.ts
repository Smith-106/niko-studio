import { describe, expect, it } from 'vitest';

import { VoiceEvaluator } from '../../narrative/evaluators/voice-evaluator';

describe('narrative/evaluators/voice-evaluator', () => {
  it('exposes public metadata getters and quickScan weak-detail branches', () => {
    const evaluator = new VoiceEvaluator();

    const result = evaluator.quickScan('很非常特别好坏大少，很非常特别好坏大少。');

    expect(evaluator.name).toContain('叙事语气');
    expect(evaluator.description).toContain('叙述语气');
    expect(evaluator.relatedSkill).toBe('voice-workshop');
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['VOICE_QUICK_VAGUE', 'VOICE_QUICK_DETAIL_WEAK']),
    );
  });

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
  it('treats empty content as zero vagueness density', async () => {
    const evaluator = new VoiceEvaluator();

    const result = await evaluator.evaluate('');

    expect(result.metrics).toMatchObject({
      specificity: 50,
      vagueness_penalty: 0,
      narrator_presence: 30,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['VOICE_LACKS_DETAIL', 'VOICE_INVISIBLE']),
    );
  });

  it('emits the vague-voice issue when vague wording dominates the content', async () => {
    const evaluator = new VoiceEvaluator();

    const result = await evaluator.evaluate('很非常特别十分好坏大小多少很非常特别十分好坏大小多少');

    expect(result.metrics.vagueness_penalty).toBeGreaterThan(40);
    expect(result.issues.map((issue) => issue.code)).toContain('VOICE_TOO_VAGUE');
  });
});
