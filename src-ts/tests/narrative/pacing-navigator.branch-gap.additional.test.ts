import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock('../../narrative/emotional-arc');
  vi.doUnmock('../../narrative/writing-craft/retention-rhythm');
});

describe('Pacing Navigator branch gap coverage', () => {
  it('uses the next timeline chapter when scheduling breathing room after a spike', async () => {
    vi.doMock('../../narrative/emotional-arc', () => ({
      analyzeEmotionalArc: () => ({
        timeline: [
          { chapterIndex: 1, emotionalIntensity: 0.1 },
          { chapterIndex: 2, emotionalIntensity: 0.9 },
          { chapterIndex: 3, emotionalIntensity: 0.2 },
        ],
        tensionDeserts: [],
        curveMatches: [],
        overallArcScore: 80,
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/writing-craft/retention-rhythm', () => ({
      analyzeRetentionRhythm: () => ({
        profiles: [],
        goldenThreeScore: 0,
        payWallDensity: 0,
        rhythmScore: 70,
        microCycles: [],
        suggestions: [],
      }),
    }));

    const { navigatePacing } = await import('../../narrative/pacing-navigator');
    const result = navigatePacing([
      { chapterIndex: 1, content: 'setup' },
      { chapterIndex: 2, content: 'spike' },
      { chapterIndex: 3, content: 'aftermath' },
    ]);

    expect(result.prescriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'breathing_room',
          chapterIndex: 3,
        }),
      ]),
    );
  });

  it('deduplicates repeated prescription keys from duplicate foreshadow chapters', async () => {
    vi.doMock('../../narrative/emotional-arc', () => ({
      analyzeEmotionalArc: () => ({
        timeline: [],
        tensionDeserts: [],
        curveMatches: [],
        overallArcScore: 88,
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/writing-craft/retention-rhythm', () => ({
      analyzeRetentionRhythm: () => ({
        profiles: [],
        goldenThreeScore: 0,
        payWallDensity: 0,
        rhythmScore: 72,
        microCycles: [],
        suggestions: [],
      }),
    }));

    const { navigatePacing } = await import('../../narrative/pacing-navigator');
    const result = navigatePacing([
      { chapterIndex: 1, content: '这里埋下伏笔与秘密。' },
      { chapterIndex: 1, content: '同一章再次暗示秘密。' },
    ]);

    const foreshadowHarvests = result.prescriptions.filter(
      (item) => item.type === 'foreshadow_harvest',
    );

    expect(foreshadowHarvests).toHaveLength(1);
    expect(foreshadowHarvests[0]).toMatchObject({
      chapterIndex: 6,
      type: 'foreshadow_harvest',
    });
  });
});
