import { describe, expect, it } from 'vitest';
import { analyzeReaderImmersion } from '../../narrative/reader-immersion-engine';

const ENGAGING_CHAPTER = `林岚紧握着那封匿名信，心中充满了疑惑。她不知道背后隐藏着什么秘密，但她发誓要找到真相。危险正在逼近，倒计时开始了。一旦失败，代价将不可承受。`;
const NEUTRAL_CHAPTER = `今天天气不错。他出了门，买了些东西，回了家。吃了午饭，看了会儿书。`;
const IMMERSION_BREAKING = `本章完。作者说：下一章更精彩，敬请期待。综上所述，这就是今天的故事。`;

describe('Reader Immersion Engine', () => {
  it('tracks reader state across chapters', () => {
    const chapters = [
      { content: ENGAGING_CHAPTER, chapterIndex: 0 },
      { content: ENGAGING_CHAPTER, chapterIndex: 1 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 2 },
      { content: ENGAGING_CHAPTER, chapterIndex: 3 },
    ];

    const result = analyzeReaderImmersion(chapters);

    expect(result.chapterStates).toHaveLength(4);
    expect(result.averageImmersion).toBeGreaterThan(0);

    const state = result.chapterStates[0].state;
    expect(state).toHaveProperty('curiosity');
    expect(state).toHaveProperty('emotionalInvestment');
    expect(state).toHaveProperty('cognitiveLoad');
    expect(state).toHaveProperty('suspenseTension');
    expect(state).toHaveProperty('immersion');
  });

  it('computes dropout risk per chapter', () => {
    const chapters = [
      { content: NEUTRAL_CHAPTER, chapterIndex: 0 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 1 },
      { content: IMMERSION_BREAKING, chapterIndex: 2 },
    ];

    const result = analyzeReaderImmersion(chapters);

    for (const cs of result.chapterStates) {
      expect(cs.dropoutRisk).toBeGreaterThanOrEqual(0);
      expect(cs.dropoutRisk).toBeLessThanOrEqual(1);
    }

    expect(result.highRiskChapters.length).toBeGreaterThan(0);
  });

  it('detects immersion breakers', () => {
    const result = analyzeReaderImmersion([
      { content: IMMERSION_BREAKING, chapterIndex: 0 },
    ]);

    expect(result.chapterStates[0].state.immersion).toBeLessThan(0.5);
  });

  it('infers trajectory correctly', () => {
    const result = analyzeReaderImmersion([
      { content: ENGAGING_CHAPTER, chapterIndex: 0 },
      { content: ENGAGING_CHAPTER, chapterIndex: 1 },
      { content: ENGAGING_CHAPTER, chapterIndex: 2 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 3 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 4 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 5 },
    ]);

    expect(['rising', 'stable', 'declining', 'volatile']).toContain(result.trajectory);
  });

  it('returns empty result for no chapters', () => {
    const result = analyzeReaderImmersion([]);
    expect(result.chapterStates).toHaveLength(0);
    expect(result.averageImmersion).toBe(0);
  });
});
