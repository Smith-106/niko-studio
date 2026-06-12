import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock('../../narrative/writing-craft/emotion-craft');
});

function createCraftResult(totalDetections: number, emotion = '平静') {
  return {
    totalDetections,
    tellCount: 0,
    showCount: totalDetections,
    showRatio: totalDetections > 0 ? 1 : 0,
    score: 100,
    detections: Array.from({ length: totalDetections }, (_, index) => ({
      mode: 'show',
      text: `evidence-${index}`,
      emotion,
      position: index,
    })),
    suggestions: [],
  };
}

function createLayerResult(overallRichness = 0.5) {
  return {
    detections: [],
    totalLayersUsed: 0,
    layerDiversityScore: 0,
    overallRichness,
    depthLevel: 'surface',
    suggestions: [],
  };
}

describe('Emotional Arc branch gap coverage', () => {
  it('covers helper edge cases, sparse vectors, and desert severity branches', async () => {
    const mod = await import('../../narrative/emotional-arc');
    const helpers = mod.__test__;

    const objectEntriesSpy = vi
      .spyOn(Object, 'entries')
      .mockReturnValue([] as [string, number][]);
    expect(
      helpers.inferDominantEmotion(createCraftResult(1, '愤怒') as any),
    ).toBe('中性');
    objectEntriesSpy.mockRestore();

    expect(helpers.normalizePoints([])).toEqual([]);
    expect(helpers.cosineSimilarity([], [])).toBe(0);
    expect(helpers.cosineSimilarity(new Array(1) as number[], [1])).toBe(0);
    expect(helpers.cosineSimilarity([1], new Array(1) as number[])).toBe(0);

    const originalHeroPoints = [...helpers.NARRATIVE_CURVES.hero_journey.points];
    helpers.NARRATIVE_CURVES.hero_journey.points = [];
    try {
      expect(helpers.matchCurves([])).toHaveLength(4);
      expect(helpers.matchCurves([0.1, 0.9])).toHaveLength(4);
    } finally {
      helpers.NARRATIVE_CURVES.hero_journey.points = originalHeroPoints;
    }

    expect(
      helpers.detectTensionDeserts([
        { chapterIndex: 1, emotionalIntensity: 0.1 },
        { chapterIndex: 2, emotionalIntensity: 0.1 },
        { chapterIndex: 3, emotionalIntensity: 0.9 },
      ] as any),
    ).toEqual([
      expect.objectContaining({ startChapter: 1, endChapter: 2, length: 2, severity: 'low' }),
    ]);

    expect(
      helpers.detectTensionDeserts([
        { chapterIndex: 1, emotionalIntensity: 0.8 },
        { chapterIndex: 2, emotionalIntensity: 0.1 },
        { chapterIndex: 3, emotionalIntensity: 0.1 },
        { chapterIndex: 4, emotionalIntensity: 0.1 },
      ] as any),
    ).toEqual([
      expect.objectContaining({ startChapter: 2, endChapter: 4, length: 3, severity: 'medium' }),
    ]);

    expect(
      helpers.detectTensionDeserts([
        { chapterIndex: 1, emotionalIntensity: 0.8 },
        { chapterIndex: 2, emotionalIntensity: 0.1 },
        { chapterIndex: 3, emotionalIntensity: 0.1 },
        { chapterIndex: 4, emotionalIntensity: 0.1 },
        { chapterIndex: 5, emotionalIntensity: 0.1 },
        { chapterIndex: 6, emotionalIntensity: 0.1 },
        { chapterIndex: 7, emotionalIntensity: 0.9 },
      ] as any),
    ).toEqual([
      expect.objectContaining({ startChapter: 2, endChapter: 6, length: 5, severity: 'high' }),
    ]);

    expect(
      helpers.detectTensionDeserts([
        { chapterIndex: 1, emotionalIntensity: 0.8 },
        { chapterIndex: 2, emotionalIntensity: 0.1 },
        { chapterIndex: 3, emotionalIntensity: 0.1 },
      ] as any),
    ).toEqual([
      expect.objectContaining({ startChapter: 2, endChapter: 3, length: 2, severity: 'low' }),
    ]);
  });

  it('adds a low-similarity suggestion when the arc diverges from classic curves', async () => {
    vi.doMock('../../narrative/writing-craft/emotion-craft', () => ({
      analyzeEmotionCraft: (text: string) => {
        const totals: Record<string, number> = {
          peak: 16,
          mid: 10,
          low1: 5,
          low2: 5,
          low3: 5,
          low4: 5,
        };
        return createCraftResult(totals[text] ?? 0, text);
      },
      analyzeEmotionLayers: () => createLayerResult(),
    }));

    const { analyzeEmotionalArc } = await import('../../narrative/emotional-arc');
    const result = analyzeEmotionalArc([
      { content: 'peak', chapterIndex: 1 },
      { content: 'mid', chapterIndex: 2 },
      { content: 'low1', chapterIndex: 3 },
      { content: 'low2', chapterIndex: 4 },
      { content: 'low3', chapterIndex: 5 },
      { content: 'low4', chapterIndex: 6 },
    ]);

    expect(result.tensionDeserts).toEqual([]);
    expect(result.curveMatches[0].similarity).toBeLessThan(0.5);
    expect(
      result.suggestions.some((item) => item.includes('经典叙事曲线匹配度较低')),
    ).toBe(true);
  });

  it('falls back to zero best-curve similarity when no classic curves are available', async () => {
    vi.doMock('../../narrative/writing-craft/emotion-craft', () => ({
      analyzeEmotionCraft: () => createCraftResult(10, '稳定'),
      analyzeEmotionLayers: () => createLayerResult(),
    }));

    const mod = await import('../../narrative/emotional-arc');
    const curves = mod.__test__.NARRATIVE_CURVES as Record<string, { type: string; label: string; points: number[] }>;
    const snapshot = Object.fromEntries(
      Object.entries(curves).map(([key, value]) => [
        key,
        { ...value, points: [...value.points] },
      ]),
    );

    for (const key of Object.keys(curves)) {
      delete curves[key];
    }

    try {
      const result = mod.analyzeEmotionalArc([{ content: 'steady', chapterIndex: 1 }]);
      expect(result.curveMatches).toEqual([]);
      expect(result.overallArcScore).toBeGreaterThanOrEqual(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    } finally {
      for (const key of Object.keys(snapshot)) {
        curves[key] = snapshot[key];
      }
    }
  });
});
