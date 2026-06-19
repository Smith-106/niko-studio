import { afterEach, describe, expect, it, vi } from 'vitest';

describe('reader/DualEngine additional coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../reader/DimensionAnalyzer.js');
  });

  it('generates fallback and generic highlights while the editor reports slow long-form pacing', async () => {
    vi.doMock('../../reader/DimensionAnalyzer.js', () => ({
      DimensionAnalyzer: class {
        analyzeAllDimensions() {
          return [
            {
              dimension: 'suspense',
              score: 0.4,
              weight: 2,
              findings: [
                {
                  description: 'Missing tension in the reveal',
                  severity: 'high',
                  location: { paragraph: 9 },
                  suggestion: 'tighten the turn',
                },
              ],
            },
            {
              dimension: 'character',
              score: 0.6,
              weight: 1,
              findings: [
                {
                  description: 'Motivation could be clearer',
                  severity: 'medium',
                  location: { chapter: 'chapter-9', paragraph: 0 },
                  suggestion: 'clarify the intent',
                },
              ],
            },
            {
              dimension: 'style',
              score: 0.2,
              weight: 1,
              findings: [],
            },
          ];
        }
      },
    }));

    const { DualEngine } = await import('../../reader/DualEngine.js');
    const engine = new DualEngine();
    const text = Array.from({ length: 260 }, (_, index) => `word${index}`).join(' ');

    const result = await engine.analyze(text, [
      { id: 'persona-1', name: 'Curious Reader' } as any,
    ]);

    expect(result.readerReactions).toHaveLength(1);
    const reaction = result.readerReactions[0];
    expect(reaction.overallScore).toBeCloseTo(0.4);
    expect(reaction.highlights).toHaveLength(3);
    expect(reaction.highlights[0]).toMatchObject({
      reaction: 'negative',
      position: { chapter: 'chapter-1', paragraph: 9 },
      dimension: 'suspense',
    });
    expect(reaction.highlights[1]).toMatchObject({
      reaction: 'neutral',
      position: { chapter: 'chapter-9', paragraph: 0 },
      dimension: 'character',
    });
    expect(reaction.highlights[2]?.comment).toContain('Curious Reader');
    expect(reaction.highlights.every((item) => item.text.length > 20)).toBe(true);

    expect(result.editorialAnalysis.structuralIssues).toHaveLength(2);
    expect(result.editorialAnalysis.styleNotes).toHaveLength(1);
    expect(result.editorialAnalysis.recommendations).toHaveLength(3);
  });
});
