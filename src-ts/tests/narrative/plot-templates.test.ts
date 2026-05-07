import { describe, expect, it } from 'vitest';

import {
  PlotPattern,
  PLOT_PATTERNS,
  detectPlotPatterns,
} from '../../narrative/writing-craft/plot-templates';

describe('Plot Templates', () => {
  it('has 20 patterns defined', () => {
    expect(Object.keys(PLOT_PATTERNS)).toHaveLength(20);
  });

  it('enum values match record keys', () => {
    const enumValues = Object.values(PlotPattern);
    const recordKeys = Object.keys(PLOT_PATTERNS);
    expect(enumValues.sort()).toEqual(recordKeys.sort());
  });

  it('each pattern has valid stages and proportions', () => {
    for (const def of Object.values(PLOT_PATTERNS)) {
      expect(def.stages.length).toBeGreaterThanOrEqual(3);
      expect(def.proportions).toHaveLength(def.stages.length);
      const total = def.proportions.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 1);
      expect(def.keywords).toHaveLength(def.stages.length);
      expect(def.variations.length).toBeGreaterThan(0);
    }
  });

  it('detects revenge pattern', () => {
    const text = '他遭受屈辱，发誓报仇。暗中忍耐多年，终于开始反击，以牙还牙加倍奉还。';
    const results = detectPlotPatterns(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pattern).toBe(PlotPattern.REVENGE);
  });

  it('detects growth/maturation pattern', () => {
    const text = '他一直不懂世事的艰难，天真地以为一切很简单。失败后才明白原来不是这样，终于懂了，走向成熟。';
    const results = detectPlotPatterns(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.pattern === PlotPattern.MATURATION)).toBe(true);
  });

  it('detects quest pattern', () => {
    const text = '他决定出发去寻找失踪多年的父亲。一路上遭遇重重困难和险境，终于找到目的地。';
    const results = detectPlotPatterns(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.pattern === PlotPattern.QUEST)).toBe(true);
  });

  it('detects underdog pattern', () => {
    const text = '所有人都觉得他不可能赢，差距太大了。但他不服输，坚持不放弃，终于找到机会逆袭成功，创造了奇迹。';
    const results = detectPlotPatterns(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.pattern === PlotPattern.UNDERDOG)).toBe(true);
  });

  it('returns empty for plain text', () => {
    const results = detectPlotPatterns('今天天气不错，他出去散步了。');
    expect(results.every((r) => r.confidence < 0.3)).toBe(true);
  });

  it('respects topK option', () => {
    const text = '他发誓报仇，同时踏上寻找宝藏的旅途，经历冒险和成长。';
    const results = detectPlotPatterns(text, { topK: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('each result has required fields', () => {
    const text = '他发誓复仇，忍耐多年后开始反击清算。';
    const results = detectPlotPatterns(text);
    for (const r of results) {
      expect(r.pattern).toBeDefined();
      expect(r.label).toBeTruthy();
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.matchedStages.length).toBeGreaterThan(0);
      expect(r.evidence.length).toBeGreaterThan(0);
    }
  });
});
