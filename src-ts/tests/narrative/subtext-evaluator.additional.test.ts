import { describe, expect, it } from 'vitest';

import { SubtextEvaluator } from '../../narrative/evaluators/subtext-evaluator';

describe('narrative/evaluators/subtext-evaluator additional coverage', () => {
  it('exposes evaluator metadata getters', () => {
    const evaluator = new SubtextEvaluator();

    expect(evaluator.name).toContain('潜台词');
    expect(evaluator.description).toContain('On-The-Nose');
    expect(evaluator.relatedSkill).toBe('subtext-dialogue');
  });

  it('reports on-the-nose, low-subtext, and overlong dialogue issues together', async () => {
    const evaluator = new SubtextEvaluator();
    const longDialogue =
      '“我很生气，因为我爱你，我的意思是你必须听我的安排，' +
      '否则我们之间的一切都会被毁掉。'.repeat(8) +
      '”';

    const result = await evaluator.evaluate(longDialogue);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIALOGUE_ON_THE_NOSE' }),
        expect.objectContaining({ code: 'DIALOGUE_LACKS_SUBTEXT' }),
        expect.objectContaining({ code: 'DIALOGUE_TOO_LONG' }),
      ]),
    );
    expect(result.metrics).toMatchObject({
      dialogue_count: 1,
    });
    expect(result.summary).toContain('潜台词浓度');
  });
});
