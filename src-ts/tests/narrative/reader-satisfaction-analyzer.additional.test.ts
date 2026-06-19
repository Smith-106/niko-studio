import { describe, expect, it } from 'vitest';

import {
  ReaderSatisfactionAnalyzer,
  ExpectPhase,
  SatisfactionLayer,
} from '../../narrative/reader-satisfaction-analyzer';

describe('ReaderSatisfactionAnalyzer additional coverage', () => {
  it('warns when expectation setup never reaches a release payoff', () => {
    const analyzer = new ReaderSatisfactionAnalyzer() as unknown as {
      generateSuggestions: (
        points: Array<{ layer: SatisfactionLayer }>,
        hooks: Array<unknown>,
        cycles: Array<{ phase: ExpectPhase }>,
        density: number[],
        chapterCount: number,
      ) => string[];
    };

    const suggestions = analyzer.generateSuggestions(
      [
        { layer: SatisfactionLayer.PHYSICAL },
        { layer: SatisfactionLayer.PSYCHOLOGICAL },
        { layer: SatisfactionLayer.SOCIAL },
      ],
      [{}, {}],
      [{ phase: ExpectPhase.EXPECTATION }],
      [1.2, 1.3],
      2,
    );

    expect(suggestions).toHaveLength(1);
  });
});
