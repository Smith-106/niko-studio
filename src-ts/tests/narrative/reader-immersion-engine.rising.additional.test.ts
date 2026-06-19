import { describe, expect, it } from 'vitest';

import { analyzeReaderImmersion } from '../../narrative/reader-immersion-engine';

const IMMERSION_BREAKING_CHAPTER =
  '\u4f5c\u8005\u8bf4\u3002\u4ee5\u4e0a\u3002\u672c\u7ae0\u5b8c\u3002\u4e0b\u4e00\u7ae0\u3002\u656c\u8bf7\u671f\u5f85\u3002';
const NEUTRAL_CHAPTER = '\u4eca\u5929\u51fa\u95e8\u4e70\u83dc\u7136\u540e\u56de\u5bb6\u7761\u89c9\u3002';
const HIGH_SIGNAL_CHAPTER =
  '\u79d8\u5bc6 \u7591\u60d1 \u771f\u76f8 \u4e3a\u4ec0\u4e48 \u7a76\u7adf ' +
  '\u5371\u9669 \u5a01\u80c1 \u8ffd\u6740 \u9677\u9631 \u9634\u8c0b \u6697\u7b97 \u80cc\u53db \u5012\u8ba1\u65f6 ' +
  '\u6700\u540e \u53ea\u5269 \u4e00\u65e6 \u5982\u679c\u4e0d \u6765\u4e0d\u53ca ' +
  '\u8a93\u8a00 \u627f\u8bfa \u727a\u7272 \u5b88\u62a4 \u4fdd\u62a4 \u4fe1\u5ff5 \u5728\u4e4e \u73cd\u60dc ' +
  '\u4e0d\u7518 \u6267\u7740 \u51b3\u5fc3 \u575a\u6301 \u4ee3\u4ef7';

describe('Reader Immersion Engine rising trajectory', () => {
  it('classifies a steady late-chapter lift as rising', () => {
    const chapters = [
      IMMERSION_BREAKING_CHAPTER,
      IMMERSION_BREAKING_CHAPTER,
      NEUTRAL_CHAPTER,
      HIGH_SIGNAL_CHAPTER,
      HIGH_SIGNAL_CHAPTER,
      HIGH_SIGNAL_CHAPTER,
    ].map((content, chapterIndex) => ({ content, chapterIndex }));

    const result = analyzeReaderImmersion(chapters);

    expect(result.trajectory).toBe('rising');
    expect(result.chapterStates.map((chapter) => chapter.state.immersion)).toEqual([
      0, 0, 0.36, 0.47, 0.56, 0.64,
    ]);
    expect(result.highRiskChapters).toEqual([0, 1, 2]);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toContain(
      '\u8bfb\u8005\u6d41\u5931\u98ce\u9669\u8f83\u9ad8',
    );
  });
});
