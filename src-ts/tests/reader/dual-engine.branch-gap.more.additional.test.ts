import { afterEach, describe, expect, it, vi } from 'vitest';

describe('reader/DualEngine branch-gap additional coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('../../reader/DimensionAnalyzer.js');
  });

  it('returns undefined aiFlavor when text is empty (line 290 else branch)', async () => {
    vi.doMock('../../reader/DimensionAnalyzer.js', () => ({
      DimensionAnalyzer: class {
        analyzeAllDimensions() {
          return [
            {
              dimension: 'plot',
              score: 0.8,
              weight: 1,
              findings: [],
            },
          ];
        }
      },
    }));

    const { DualEngine } = await import('../../reader/DualEngine.js');
    const engine = new DualEngine();

    // Empty string should trigger the `text.trim().length > 0 ? ... : undefined` else branch
    const result = await engine.analyze('', [
      { id: 'persona-1', name: 'Atlas Reader' } as any,
    ]);

    expect(result.readerReactions).toHaveLength(1);
    expect(result.editorialAnalysis).toBeDefined();
    // aiFlavor should be undefined for empty text
    expect(result.editorialAnalysis.aiFlavor).toBeUndefined();
  });
});
