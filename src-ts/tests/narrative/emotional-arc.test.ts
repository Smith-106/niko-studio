import { describe, expect, it } from 'vitest';
import { analyzeEmotionalArc } from '../../narrative/emotional-arc';

const EMOTIONAL_CHAPTER = `她攥紧了拳头，眼眶泛红。心跳加速，呼吸一滞，手指颤抖着。那一拳砸在桌上，震得杯子都跳了起来。深吸一口气，她告诉自己要冷静。`;
const NEUTRAL_CHAPTER = `今天天气不错。出门散步。回来吃饭。看了会儿书。睡了个午觉。`;
const MIXED_CHAPTER = `他咬紧牙关，攥紧了衣角，声音发抖地说："我不知道。"眼眶湿润，转过头去，不再说话。`;

describe('Emotional Arc', () => {
  it('analyzes multiple chapters with varying intensity', () => {
    const chapters = [
      { content: EMOTIONAL_CHAPTER, chapterIndex: 0 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 1 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 2 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 3 },
      { content: MIXED_CHAPTER, chapterIndex: 4 },
    ];

    const result = analyzeEmotionalArc(chapters);

    expect(result.timeline).toHaveLength(5);
    expect(result.overallArcScore).toBeGreaterThanOrEqual(0);
    expect(result.timeline[0].emotionalIntensity).toBeGreaterThan(result.timeline[1].emotionalIntensity);
  });

  it('detects tension deserts', () => {
    const chapters = [
      { content: NEUTRAL_CHAPTER, chapterIndex: 0 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 1 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 2 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 3 },
    ];

    const result = analyzeEmotionalArc(chapters);
    expect(result.tensionDeserts.length).toBeGreaterThan(0);
    expect(result.tensionDeserts[0].severity).toBeDefined();
  });

  it('matches against narrative curves', () => {
    const chapters = [
      { content: NEUTRAL_CHAPTER, chapterIndex: 0 },
      { content: MIXED_CHAPTER, chapterIndex: 1 },
      { content: EMOTIONAL_CHAPTER, chapterIndex: 2 },
      { content: MIXED_CHAPTER, chapterIndex: 3 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 4 },
    ];

    const result = analyzeEmotionalArc(chapters);
    expect(result.curveMatches.length).toBe(4);
    expect(result.curveMatches[0].similarity).toBeGreaterThanOrEqual(result.curveMatches[1].similarity);
  });

  it('extends classic curves when the chapter count exceeds template length', () => {
    const chapters = Array.from({ length: 13 }, (_, index) => ({
      content: NEUTRAL_CHAPTER,
      chapterIndex: index + 1,
    }));

    const result = analyzeEmotionalArc(chapters);

    expect(result.curveMatches).toHaveLength(4);
    expect(result.curveMatches.every((match) => Number.isFinite(match.similarity))).toBe(true);
  });

  it('each timeline point has required fields', () => {
    const result = analyzeEmotionalArc([
      { content: EMOTIONAL_CHAPTER, chapterIndex: 0 },
    ]);

    const point = result.timeline[0];
    expect(point).toHaveProperty('chapterIndex', 0);
    expect(point).toHaveProperty('emotionScore');
    expect(point).toHaveProperty('showTellRatio');
    expect(point).toHaveProperty('layerRichness');
    expect(point).toHaveProperty('dominantEmotion');
    expect(point).toHaveProperty('emotionalIntensity');
    expect(point.emotionalIntensity).toBeGreaterThanOrEqual(0);
    expect(point.emotionalIntensity).toBeLessThanOrEqual(1);
  });

  it('returns empty result for no chapters', () => {
    const result = analyzeEmotionalArc([]);
    expect(result.timeline).toHaveLength(0);
    expect(result.overallArcScore).toBe(0);
  });

  it('adds a severe desert suggestion for long flat emotional stretches', () => {
    const chapters = Array.from({ length: 5 }, (_, index) => ({
      content: NEUTRAL_CHAPTER,
      chapterIndex: index + 1,
    }));

    const result = analyzeEmotionalArc(chapters);

    expect(result.tensionDeserts).toEqual([
      expect.objectContaining({ startChapter: 1, endChapter: 5, length: 5, severity: 'high' }),
    ]);
    expect(result.suggestions).toContain('存在 1 处严重的情感沙漠（连续 5+ 章缺乏情感变化），建议在章节 1-5 加入情感冲突');
  });
});
