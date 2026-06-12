import { describe, expect, it } from 'vitest';

import { FourSelvesEvaluator } from '../../narrative/evaluators/four-selves-evaluator';

describe('narrative/evaluators/four-selves-evaluator', () => {
  it('exposes public metadata getters', () => {
    const evaluator = new FourSelvesEvaluator();

    expect(evaluator.name).toContain('四个自我');
    expect(evaluator.description).toContain('四个自我层次');
    expect(evaluator.relatedSkill).toBe('four-selves');
  });

  it('evaluate returns layered metrics for a character with multiple revealed selves', async () => {
    const evaluator = new FourSelvesEvaluator();

    const result = await evaluator.evaluate(
      '在会议上，他穿着西装，以职业身份面对客户。回到家后，他终于在家人面前放松下来。深夜里，他独自写日记，不愿让人知道自己的秘密。多年前的创伤和从未承认的真相仍压在心头。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      social_self: expect.any(Number),
      personal_self: expect.any(Number),
      private_self: expect.any(Number),
      hidden_self: expect.any(Number),
      layers_present: expect.any(Number),
    });
    expect(result.summary).toContain('/4层');
  });

  it('flags shallow characterization when too few selves are revealed', async () => {
    const evaluator = new FourSelvesEvaluator();

    const result = await evaluator.evaluate(
      '他总是在会议和媒体面前维护形象，展示职业头衔与完美表现。',
    );

    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.issues.some(issue => issue.code === 'CHARACTER_SHALLOW')).toBe(true);
  });
});
