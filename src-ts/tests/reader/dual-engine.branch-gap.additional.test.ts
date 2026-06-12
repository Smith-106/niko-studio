import { afterEach, describe, expect, it, vi } from 'vitest';

describe('reader/DualEngine branch-gap coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../reader/DimensionAnalyzer.js');
  });

  it('skips high-scoring dimensions without findings and falls back to paragraph zero when a finding omits its paragraph', async () => {
    vi.doMock('../../reader/DimensionAnalyzer.js', () => ({
      DimensionAnalyzer: class {
        analyzeAllDimensions() {
          return [
            {
              dimension: 'skip-me',
              score: 0.95,
              weight: 1,
              findings: [],
            },
            {
              dimension: 'character',
              score: 0.8,
              weight: 1,
              findings: [
                {
                  description: 'Missing paragraph should use the opening segment.',
                  severity: 'medium',
                  location: { chapter: 'chapter-x' },
                  suggestion: 'anchor the reaction',
                },
              ],
            },
            {
              dimension: 'style',
              score: 0.4,
              weight: 1,
              findings: [],
            },
          ];
        }
      },
    }));

    const { DualEngine } = await import('../../reader/DualEngine.js');
    const engine = new DualEngine();
    const text = [
      'The opening paragraph is deliberately long enough to satisfy the highlight threshold for fallback coverage.',
      'This second paragraph also stays long enough to act as alternate source material.',
    ].join('\n\n');

    const result = await engine.analyze(text, [
      { id: 'persona-1', name: 'Atlas Reader' } as any,
    ]);

    expect(result.readerReactions).toHaveLength(1);
    const reaction = result.readerReactions[0];
    expect(reaction.highlights).toHaveLength(2);
    expect(reaction.highlights[0]).toMatchObject({
      dimension: 'character',
      position: { chapter: 'chapter-x', paragraph: 0 },
      reaction: 'neutral',
    });
    expect(reaction.highlights[0]?.text).toContain('opening paragraph');
    expect(reaction.highlights[1]).toMatchObject({
      dimension: 'style',
      position: { chapter: 'chapter-1', paragraph: 0 },
      reaction: 'negative',
    });
    expect(reaction.highlights.every((item) => item.dimension !== 'skip-me')).toBe(true);
  });
});
