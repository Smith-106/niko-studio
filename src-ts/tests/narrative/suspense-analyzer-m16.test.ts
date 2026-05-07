import { describe, expect, it } from 'vitest';

import { SuspenseAnalyzer } from '../../narrative/suspense-analyzer';
import { MysterySubtype, MYSTERY_SUBTYPES } from '../../narrative/writing-craft/craft-catalog';

describe('SuspenseAnalyzer — M16 mystery & deduction', () => {
  const analyzer = new SuspenseAnalyzer();

  describe('MysterySubtype enum + MYSTERY_SUBTYPES', () => {
    it('has exactly 4 entries', () => {
      expect(Object.values(MysterySubtype)).toHaveLength(4);
    });

    it('each subtype has coreRules and representativeWorks', () => {
      for (const def of Object.values(MYSTERY_SUBTYPES)) {
        expect(def.coreRules.length).toBeGreaterThan(0);
        expect(def.representativeWorks.length).toBeGreaterThan(0);
        expect(def.detectionKeywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('detectMysterySubtype()', () => {
    it('detects honkaku (本格推理) subtype', () => {
      const chapters = [
        { content: '密室中发现了一具尸体。不在场证明完美无缺。侦探开始推理，寻找线索和证据。', chapterIndex: 0 },
      ];
      const result = analyzer.detectMysterySubtype(chapters);

      expect(result.length).toBeGreaterThan(0);
      const honkaku = result.find((r) => r.subtype === MysterySubtype.HONKAKU);
      expect(honkaku).toBeDefined();
      expect(honkaku!.confidence).toBeGreaterThan(0);
    });

    it('detects social faction subtype', () => {
      const chapters = [
        { content: '底层社会的悲剧，因为社会不公导致了复仇。人性的挣扎在权力压迫下显得无奈。', chapterIndex: 0 },
      ];
      const result = analyzer.detectMysterySubtype(chapters);

      const social = result.find((r) => r.subtype === MysterySubtype.SOCIAL_FACTION);
      expect(social).toBeDefined();
    });

    it('detects hardboiled subtype', () => {
      const chapters = [
        { content: '夜雨中，私家侦探走进酒吧。黑帮的腐败和暴力在暗巷中蔓延。', chapterIndex: 0 },
      ];
      const result = analyzer.detectMysterySubtype(chapters);

      const hardboiled = result.find((r) => r.subtype === MysterySubtype.HARDBOILED);
      expect(hardboiled).toBeDefined();
    });

    it('detects thriller suspense subtype', () => {
      const chapters = [
        { content: '恐惧蔓延，逃亡开始了。杀手在黑暗中追踪。倒计时开始了。', chapterIndex: 0 },
      ];
      const result = analyzer.detectMysterySubtype(chapters);

      const thriller = result.find((r) => r.subtype === MysterySubtype.THRILLER_SUSPENSE);
      expect(thriller).toBeDefined();
    });
  });

  describe('analyzeDeductionChain()', () => {
    it('detects complete deduction chain', () => {
      const chapters = [
        { content: '发现了关键线索和证据，注意到一些痕迹。', chapterIndex: 0 },
        { content: '根据线索推理分析，因此推断出不可能是他。', chapterIndex: 1 },
        { content: '真相终于大白，原来是他的所作所为。', chapterIndex: 2 },
      ];
      const result = analyzer.analyzeDeductionChain(chapters);

      expect(result.chainScore).toBe(10);
      expect(result.cluePresented.length).toBeGreaterThan(0);
      expect(result.deductions.length).toBeGreaterThan(0);
    });

    it('detects missing chain elements', () => {
      const chapters = [
        { content: '平常的一天。', chapterIndex: 0 },
      ];
      const result = analyzer.analyzeDeductionChain(chapters);

      expect(result.chainScore).toBeLessThan(5);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('classifies deductions by type', () => {
      const chapters = [
        { content: '发现了线索和证据。', chapterIndex: 0 },
        { content: '根据线索推理分析。', chapterIndex: 1 },
        { content: '真相大白。', chapterIndex: 2 },
      ];
      const result = analyzer.analyzeDeductionChain(chapters);

      const types = new Set(result.deductions.map((d) => d.type));
      expect(types.has('clue')).toBe(true);
    });
  });
});
