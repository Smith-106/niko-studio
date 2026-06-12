import { describe, expect, it } from 'vitest';

import { SubtextEvaluator } from '../../narrative/evaluators/subtext-evaluator';

describe('narrative/evaluators/subtext-evaluator branch gap coverage', () => {
  it('falls back to neutral dialogue metrics when no dialogue is present', async () => {
    const evaluator = new SubtextEvaluator();

    const result = await evaluator.evaluate('The corridor stayed silent while the narrator described the rain.');

    expect(result.metrics).toMatchObject({
      dialogue_count: 0,
    });
    expect(result.score).toBeGreaterThan(0);
  });

  it('covers private helper fallbacks for empty and zero-ratio dialogue inputs', () => {
    const evaluator = new SubtextEvaluator() as any;

    expect(evaluator.evaluateOnTheNose([])).toBe(100);
    expect(evaluator.evaluateSubtextDensity('No dialogue appears here.', [])).toBe(50);
    expect(evaluator.evaluateDialogueLength([])).toBe(100);

    let lengthReads = 0;
    const unstableDialogues = {
      get length() {
        lengthReads += 1;
        return lengthReads === 1 ? 1 : 0;
      },
    };

    expect(
      evaluator.evaluateSubtextDensity(
        'The scene leaves the meaning implied instead of spoken outright.',
        unstableDialogues,
      ),
    ).toBe(50);
  });
});
