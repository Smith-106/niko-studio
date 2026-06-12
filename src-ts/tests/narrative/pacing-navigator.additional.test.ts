import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock('../../narrative/emotional-arc');
  vi.doUnmock('../../narrative/writing-craft/retention-rhythm');
});

describe('Pacing Navigator additional coverage', () => {
  it('generates high, medium, low, breathing-room, and foreshadow prescriptions with warning suggestions', async () => {
    vi.doMock('../../narrative/emotional-arc', () => ({
      analyzeEmotionalArc: () => ({
        timeline: [
          { chapterIndex: 1, emotionalIntensity: 0.1 },
          { chapterIndex: 2, emotionalIntensity: 0.85 },
        ],
        tensionDeserts: [
          { startChapter: 1, endChapter: 3, length: 3, severity: 'high' },
          { startChapter: 4, endChapter: 5, length: 2, severity: 'medium' },
          { startChapter: 6, endChapter: 6, length: 1, severity: 'low' },
          { startChapter: 7, endChapter: 8, length: 2, severity: 'high' },
          { startChapter: 9, endChapter: 10, length: 2, severity: 'high' },
          { startChapter: 11, endChapter: 12, length: 2, severity: 'high' },
        ],
        curveMatches: [],
        overallArcScore: 44,
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/writing-craft/retention-rhythm', () => ({
      analyzeRetentionRhythm: () => ({
        profiles: [],
        goldenThreeScore: 0,
        payWallDensity: 0,
        rhythmScore: 18,
        microCycles: [],
        suggestions: [],
      }),
    }));

    const { navigatePacing } = await import('../../narrative/pacing-navigator');
    const result = navigatePacing([
      { chapterIndex: 1, content: '这里埋下伏笔，秘密与真相正在酝酿。' },
      { chapterIndex: 2, content: '普通推进。' },
    ]);

    expect(result.prescriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'climax', priority: 'high' }),
        expect.objectContaining({ type: 'turning_point', priority: 'medium' }),
        expect.objectContaining({ type: 'escalation', priority: 'medium' }),
        expect.objectContaining({ type: 'escalation', priority: 'low' }),
        expect.objectContaining({ type: 'breathing_room', chapterIndex: 3 }),
        expect.objectContaining({ type: 'foreshadow_harvest', chapterIndex: 6 }),
      ]),
    );
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('高优先级'),
        expect.stringContaining('留存节奏分数偏低'),
        expect.stringContaining('情感沙漠'),
      ]),
    );
  });

  it('returns the healthy default suggestion when no pacing risks are detected', async () => {
    vi.doMock('../../narrative/emotional-arc', () => ({
      analyzeEmotionalArc: () => ({
        timeline: [
          { chapterIndex: 1, emotionalIntensity: 0.2 },
          { chapterIndex: 2, emotionalIntensity: 0.35 },
        ],
        tensionDeserts: [],
        curveMatches: [],
        overallArcScore: 82,
        suggestions: [],
      }),
    }));
    vi.doMock('../../narrative/writing-craft/retention-rhythm', () => ({
      analyzeRetentionRhythm: () => ({
        profiles: [],
        goldenThreeScore: 0,
        payWallDensity: 0,
        rhythmScore: 75,
        microCycles: [],
        suggestions: [],
      }),
    }));

    const { navigatePacing } = await import('../../narrative/pacing-navigator');
    const result = navigatePacing([{ chapterIndex: 1, content: 'A calm chapter about breakfast, walking, and an ordinary sunset.' }]);

    expect(result.prescriptions).toEqual([]);
    expect(result.suggestions).toEqual(['节奏结构良好，钩子、爽点、情感弧线分布合理']);
    expect(result.pacingScore).toBeGreaterThan(0);
  });

  it('still returns the empty-state payload for zero chapters', async () => {
    const { navigatePacing } = await import('../../narrative/pacing-navigator');
    expect(navigatePacing([])).toEqual({
      prescriptions: [],
      pacingScore: 0,
      rhythmAnalysis: null,
      emotionalArc: null,
      suggestions: ['没有章节数据'],
    });
  });
});
