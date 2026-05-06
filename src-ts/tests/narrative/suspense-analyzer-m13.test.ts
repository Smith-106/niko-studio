import { describe, expect, it } from 'vitest';

import {
  SuspenseAnalyzer,
  ActBeat,
  SetupPayoffState,
  SatisfactionType,
} from '../../narrative/suspense-analyzer';

describe('SuspenseAnalyzer — M13 enhancements', () => {
  const analyzer = new SuspenseAnalyzer();

  // ── Bell三幕结构 ────────────────────────────────────────────

  describe('analyzeThreeActStructure', () => {
    it('detects key beats in well-structured scenes', () => {
      const scenes = [
        { content: '他过着平静的生活，然而突然有一天收到了一封意外的信。', position: 0.15 },
        { content: '她决定踏上寻找真相的旅程，必须找到答案。', position: 0.25 },
        { content: '原来真相出人意料地转折了，一切都不同了。', position: 0.5 },
        { content: '他失去了所有的希望，坠入绝望的深渊，一切都完了。', position: 0.75 },
        { content: '最终决战来临，真相大白于天下。', position: 0.9 },
      ];

      const result = analyzer.analyzeThreeActStructure(scenes);

      expect(result.beats.length).toBeGreaterThan(0);
      expect(result.act1Score).toBeGreaterThan(0);
      expect(result.act2Score).toBeGreaterThan(0);
      expect(result.act3Score).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
    });

    it('reports missing beats for flat content', () => {
      const scenes = [
        { content: '今天天气很好。', position: 0.3 },
        { content: '他吃了午饭。', position: 0.6 },
      ];

      const result = analyzer.analyzeThreeActStructure(scenes);

      expect(result.missingBeats.length).toBeGreaterThan(0);
      expect(result.overallStructureScore).toBeLessThan(5);
    });
  });

  // ── 蔡骏 设局-解局 ──────────────────────────────────────

  describe('detectSetupPayoffCycles', () => {
    it('detects setup and payoff patterns', () => {
      const scenes = [
        { content: '小镇上出现了奇怪的谜团，有不寻常的事情发生。', position: 0.1 },
        { content: '危险逼近，情况更加危急，威胁升级了。', position: 0.4 },
        { content: '真相终于揭露了，原来一切都解开了。', position: 0.8 },
      ];

      const result = analyzer.detectSetupPayoffCycles(scenes);

      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
    });

    it('warns about unresolved cycles', () => {
      const scenes = [
        { content: '发现了一个秘密谜团。', position: 0.2 },
        { content: '又一个奇怪的疑点出现了。', position: 0.5 },
      ];

      const result = analyzer.detectSetupPayoffCycles(scenes);

      expect(result.unresolvedCount).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  // ── 爽点密度 ────────────────────────────────────────────

  describe('analyzeSatisfactionDensity', () => {
    it('detects satisfaction points in text', () => {
      const text = '他一击秒杀了对手，全场震惊目瞪口呆。真相终于大白，所有人都被他碾压了。他突破了瓶颈，升级到新境界，获得了传说中的神器。';

      const result = analyzer.analyzeSatisfactionDensity(text);

      expect(result.points.length).toBeGreaterThan(0);
      expect(result.density).toBeGreaterThan(0);
    });

    it('returns low density for plain text', () => {
      const text = '他走在路上，看到了一棵树。树叶在风中轻轻摇摆。他继续往前走，来到了一座桥。';

      const result = analyzer.analyzeSatisfactionDensity(text);

      expect(result.density).toBeLessThan(2);
    });

    it('classifies satisfaction types correctly', () => {
      const text = '他碾压了所有对手，原来真相如此。终于突破了极限。';

      const result = analyzer.analyzeSatisfactionDensity(text);

      const types = new Set(result.points.map(p => p.type));
      expect(types.size).toBeGreaterThan(1);
    });
  });
});
