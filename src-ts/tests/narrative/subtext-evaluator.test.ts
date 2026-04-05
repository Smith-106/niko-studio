import { describe, expect, it } from 'vitest';

import { SubtextEvaluator } from '../../narrative/evaluators/subtext-evaluator';

describe('narrative/evaluators/subtext-evaluator', () => {
  it('returns the no-dialogue fallback contract when dialogue is absent', async () => {
    const evaluator = new SubtextEvaluator();

    const result = await evaluator.evaluate('叙述性段落，没有任何引号或对白内容。');

    expect(result.score).toBe(50);
    expect(result.metrics).toMatchObject({ dialogue_count: 0 });
    expect(result.summary).toContain('未检测到对话');
  });

  it('evaluates dialogue-heavy content and exposes subtext-related metrics', async () => {
    const evaluator = new SubtextEvaluator();

    const result = await evaluator.evaluate(
      '“我很生气。”她说。\\n\\n“不过，算了。”他看着窗外，没有回答。\\n\\n“让我们谈谈吧。”她端起杯子，停顿了一下。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      dialogue_count: expect.any(Number),
      on_the_nose_score: expect.any(Number),
      subtext_density: expect.any(Number),
      dialogue_length_score: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('潜台词浓度');
  });
});
