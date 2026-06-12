import { describe, expect, it } from 'vitest';

import { detectUnreliableNarrator } from '../../narrative/writing-craft/unreliable-narrator';

describe('narrative/writing-craft/unreliable-narrator branch-gap coverage', () => {
  it('flags perspective-limited narration and severe unreliability when signals accumulate', () => {
    const chapters = [
      {
        chapterIndex: 1,
        content: [
          '在我看来这件事本来很清楚。',
          '我觉得他从不说谎，但有一次他当面承认自己一直在隐瞒。',
          '据我所知这些就不说了，总之结果已经注定。',
          '后来才知道其实并非如此。',
          '好像我也许记不太清了。',
        ].join(''),
      },
    ];

    const result = detectUnreliableNarrator(chapters);

    expect(result.reliabilityScore).toBeLessThan(40);
    expect(result.contradictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'perspective' }),
        expect.objectContaining({ type: 'omission' }),
        expect.objectContaining({ type: 'statement' }),
      ]),
    );
    expect(result.manipulationSigns.length).toBeGreaterThan(0);
    expect(result.suggestions).toHaveLength(2);
  });
});
