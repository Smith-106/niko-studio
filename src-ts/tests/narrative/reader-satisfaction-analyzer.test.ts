import { describe, expect, it } from 'vitest';

import {
  ReaderSatisfactionAnalyzer,
  SatisfactionLayer,
  HookType,
  ExpectPhase,
} from '../../narrative/reader-satisfaction-analyzer';

describe('ReaderSatisfactionAnalyzer', () => {
  const analyzer = new ReaderSatisfactionAnalyzer();

  it('detects satisfaction points across chapters', () => {
    const chapters = [
      { content: '他碾压了所有对手，全场目瞪口呆。突破了瓶颈，终于升级了。', chapterIndex: 1 },
      { content: '他算计了一切，早已看穿敌人的阴谋。原来如此，真相大白。', chapterIndex: 2 },
    ];

    const result = analyzer.analyzeSatisfaction(chapters);

    expect(result.satisfactionPoints.length).toBeGreaterThan(0);
    expect(result.densityPerChapter.length).toBe(2);
  });

  it('detects chapter hooks', () => {
    const chapters = [
      { content: '他走在路上，一切看似平静。但就在这时，突然一道黑影从天而降。', chapterIndex: 1 },
      { content: '平静的一天。他回家了。', chapterIndex: 2 },
    ];

    const result = analyzer.analyzeSatisfaction(chapters);

    expect(result.hooks.length).toBeGreaterThan(0);
    expect(result.hooks[0].hookType).toBeDefined();
    expect(result.hooks[0].strength).toBeGreaterThan(0);
  });

  it('detects expectation cycles', () => {
    const chapters = [
      { content: '他期待着即将到来的比赛，渴望证明自己。', chapterIndex: 1 },
      { content: '困难接踵而来，一次又一次的挫折。', chapterIndex: 2 },
      { content: '他终于成功了，如愿以偿地实现了目标。', chapterIndex: 3 },
    ];

    const result = analyzer.analyzeSatisfaction(chapters);

    const phases = new Set(result.expectationCycles.map(c => c.phase));
    expect(phases.has(ExpectPhase.EXPECTATION)).toBe(true);
    expect(phases.has(ExpectPhase.RELEASE)).toBe(true);
  });

  it('provides suggestions for low density', () => {
    const chapters = [
      { content: '他走在路上，天气不错。', chapterIndex: 1 },
      { content: '她看了一会儿书，喝了杯茶。', chapterIndex: 2 },
    ];

    const result = analyzer.analyzeSatisfaction(chapters);

    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('classifies satisfaction layers', () => {
    const chapters = [
      { content: '他一击秒杀了敌人，恐怖如斯的力量震惊全场。', chapterIndex: 1 },
      { content: '他智商碾压对手，早已看穿一切。', chapterIndex: 2 },
      { content: '所有人对他刮目相看，佩服得五体投地。', chapterIndex: 3 },
      { content: '他终于突破了，觉醒了新的能力。', chapterIndex: 4 },
    ];

    const result = analyzer.analyzeSatisfaction(chapters);

    const layers = new Set(result.satisfactionPoints.map(p => p.layer));
    expect(layers.size).toBeGreaterThanOrEqual(3);
  });

  it('handles empty input gracefully', () => {
    const result = analyzer.analyzeSatisfaction([]);

    expect(result.satisfactionPoints).toEqual([]);
    expect(result.hooks).toEqual([]);
    expect(result.overallScore).toBe(0);
  });
});
