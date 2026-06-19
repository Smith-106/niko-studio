import { afterEach, describe, expect, it, vi } from 'vitest';

const warnMock = vi.hoisted(() => vi.fn());
const infoMock = vi.hoisted(() => vi.fn());
const debugMock = vi.hoisted(() => vi.fn());

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    warn: warnMock,
    info: infoMock,
    debug: debugMock,
  }),
}));

describe('cowriting/GuidedMode additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('warns and falls back to an empty options array when the aggregator returns fewer than 3 options', async () => {
    const aggregate = vi.fn(() => ({
      mode: 'guided',
      text: 'trimmed',
      options: [
        {
          index: 1,
          text: 'Only option',
          scores: { coherence: 80, creativity: 78, styleMatch: 82 },
          overallScore: 80,
        },
      ],
      metadata: {
        model: 'mock-guided-model',
        generatedAt: '2026-06-05T00:00:00.000Z',
        tokenCount: 12,
        confidence: 0.6,
      },
    }));

    vi.doMock('../../cowriting/OutputAggregator.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../cowriting/OutputAggregator.js')>();
      return {
        ...actual,
        createOutputAggregator: () => ({
          aggregate,
        }),
      };
    });

    const { GuidedMode } = await import('../../cowriting/GuidedMode.js?additional-coverage');
    const guidedMode = new GuidedMode();

    const result = await guidedMode.generate({
      manuscriptText: '门后的空气像被人屏住了呼吸。',
      chapterContext: {
        precedingText: '门后的空气像被人屏住了呼吸。',
        succeedingText: '她听见楼梯尽头轻微的脚步声。',
        chapterSummary: '主角犹豫是否继续前进。',
      },
      storyBible: {
        characters: [],
        worldRules: [],
        plotThreads: [],
        timelineEvents: [],
      },
      sessionContext: {
        recentEdits: [],
        writingStyle: '近距离视角',
        currentChapter: 'CH01',
        cursorPosition: 0,
      },
    });

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(warnMock).toHaveBeenCalledWith(
      'OutputAggregator returned fewer than 3 options',
      expect.objectContaining({ optionCount: 1 }),
    );
    expect(result.options).toHaveLength(1);
  });

  it('uses the empty-array fallback when the aggregator omits guided options entirely', async () => {
    const aggregate = vi.fn(() => ({
      mode: 'guided',
      text: 'trimmed',
      metadata: {
        model: 'mock-guided-model',
        generatedAt: '2026-06-05T00:00:00.000Z',
        tokenCount: 9,
        confidence: 0.4,
      },
    }));

    vi.doMock('../../cowriting/OutputAggregator.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../cowriting/OutputAggregator.js')>();
      return {
        ...actual,
        createOutputAggregator: () => ({
          aggregate,
        }),
      };
    });

    const { GuidedMode } = await import('../../cowriting/GuidedMode.js?additional-coverage-empty');
    const guidedMode = new GuidedMode();

    const result = await guidedMode.generate({
      manuscriptText: '她没有退后。',
      chapterContext: {
        precedingText: '她没有退后。',
        succeedingText: '走廊尽头的门缝透出冷光。',
        chapterSummary: '主角决定继续前进。',
      },
      storyBible: {
        characters: [],
        worldRules: [],
        plotThreads: [],
        timelineEvents: [],
      },
      sessionContext: {
        recentEdits: [],
        writingStyle: '冷静、克制',
        currentChapter: 'CH02',
        cursorPosition: 0,
      },
    });

    expect(warnMock).toHaveBeenCalledWith(
      'OutputAggregator returned fewer than 3 options',
      expect.objectContaining({ optionCount: 0 }),
    );
    expect(result.options).toEqual([]);
  });
});
