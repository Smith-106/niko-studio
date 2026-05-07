import { describe, expect, it } from 'vitest';

import { ReaderSatisfactionAnalyzer } from '../../narrative/reader-satisfaction-analyzer';

describe('ReaderSatisfactionAnalyzer — M15', () => {
  const analyzer = new ReaderSatisfactionAnalyzer();

  const webNovelChapters = [
    { content: '他的等级终于突破到了Lv10，属性暴涨，力量突飞猛进。升级！连升三级！', chapterIndex: 0 },
    { content: '获得了远古传承，血脉觉醒，修为突破到了金丹境界。原来前世记忆中藏着这个秘密。', chapterIndex: 1 },
    { content: '叮！系统奖励发放，宿主获得新的技能。商店兑换了绝世神兵。', chapterIndex: 2 },
  ];

  describe('detectUpgradePattern()', () => {
    it('detects level-based upgrade system', () => {
      const result = analyzer.detectUpgradePattern(webNovelChapters);
      expect(result.length).toBeGreaterThan(0);
      const levelSystem = result.find((r) => r.system === 'level_based');
      expect(levelSystem).toBeDefined();
      expect(levelSystem!.confidence).toBeGreaterThan(0);
    });

    it('detects realm breakthrough system', () => {
      const result = analyzer.detectUpgradePattern(webNovelChapters);
      const realmSystem = result.find((r) => r.system === 'realm_breakthrough');
      expect(realmSystem).toBeDefined();
    });

    it('returns evidence for each detection', () => {
      const result = analyzer.detectUpgradePattern(webNovelChapters);
      for (const detection of result) {
        expect(detection.evidence.length).toBeGreaterThan(0);
      }
    });
  });

  describe('analyzeGoldenFinger()', () => {
    it('detects system cheat golden finger', () => {
      const result = analyzer.analyzeGoldenFinger(webNovelChapters);
      expect(result.length).toBeGreaterThan(0);
      const system = result.find((r) => r.type === 'system_cheat');
      expect(system).toBeDefined();
    });

    it('detects rebirth knowledge golden finger', () => {
      const result = analyzer.analyzeGoldenFinger(webNovelChapters);
      const rebirth = result.find((r) => r.type === 'rebirth_knowledge');
      expect(rebirth).toBeDefined();
    });

    it('includes growthPattern for each detection', () => {
      const result = analyzer.analyzeGoldenFinger(webNovelChapters);
      for (const detection of result) {
        expect(detection.growthPattern).toBeTruthy();
      }
    });
  });

  describe('analyzeWebNovelCurve()', () => {
    it('returns comprehensive web novel analysis', () => {
      const result = analyzer.analyzeWebNovelCurve(webNovelChapters);

      expect(result.upgradeDetections).toBeDefined();
      expect(result.goldenFingerDetections).toBeDefined();
      expect(result.upgradeNodes).toBeDefined();
      expect(result.curveData).toHaveLength(3);
      expect(result.suggestions).toBeDefined();
    });

    it('curveData has required fields per chapter', () => {
      const result = analyzer.analyzeWebNovelCurve(webNovelChapters);
      for (const point of result.curveData) {
        expect(point.chapterIndex).toBeDefined();
        expect(typeof point.hookStrength).toBe('number');
        expect(typeof point.upgradePresent).toBe('boolean');
        expect(typeof point.density).toBe('number');
      }
    });

    it('generates suggestions for chapters without upgrade systems', () => {
      const plainChapters = [
        { content: '今天天气不错，他出门散步了。', chapterIndex: 0 },
      ];
      const result = analyzer.analyzeWebNovelCurve(plainChapters);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});
