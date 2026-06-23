import { describe, expect, it } from 'vitest';

import {
  SuspenseAnalyzer,
  NarrativeTechniqueDetection,
  NarrativeTechniqueResult,
  GenreBeatAlignment,
  GenreBeatAnalysisResult,
} from '../../narrative/suspense-analyzer';
import {
  NarrativeTechnique,
  GenreBeatType,
} from '../../narrative/writing-craft/craft-catalog';
import { getNarrativeTechniquesCatalog, getGenreBeatsCatalog } from '../../narrative/writing-craft/craft-catalog';

describe('SuspenseAnalyzer — M14 narrative techniques', () => {
  const analyzer = new SuspenseAnalyzer();

  describe('getNarrativeTechniquesCatalog() catalog', () => {
    it('has 8 technique entries with complete data', () => {
      const entries = Object.values(getNarrativeTechniquesCatalog());
      expect(entries).toHaveLength(8);

      for (const def of entries) {
        expect(def.technique).toBeDefined();
        expect(def.label).toBeTruthy();
        expect(def.description.length).toBeGreaterThan(10);
        expect(def.detectionKeywords.length).toBeGreaterThanOrEqual(3);
        expect(def.effectDescription.length).toBeGreaterThan(5);
        expect(def.applicationContext.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('each technique has a unique label', () => {
      const labels = Object.values(getNarrativeTechniquesCatalog()).map((d) => d.label);
      expect(new Set(labels).size).toBe(8);
    });

    it('ESCALATION_LADDER has upgrade/pressure keywords', () => {
      const def = getNarrativeTechniquesCatalog()[NarrativeTechnique.ESCALATION_LADDER];
      expect(def.detectionKeywords).toContain('升级');
    });

    it('RED_HERRING has misdirection keywords', () => {
      const def = getNarrativeTechniquesCatalog()[NarrativeTechnique.RED_HERRING];
      expect(def.detectionKeywords).toContain('误导');
    });
  });

  describe('detectNarrativeTechniques()', () => {
    it('detects ESCALATION_LADDER with escalation keywords', () => {
      const chapters = [
        { content: '冲突进一步升级，局势更加恶化，情况层层加剧。危险不断恶化。', chapterIndex: 1 },
      ];
      const result = analyzer.detectNarrativeTechniques(chapters);

      const escalation = result.detections.find(
        (d) => d.technique === NarrativeTechnique.ESCALATION_LADDER,
      );
      expect(escalation).toBeDefined();
      expect(escalation!.detected).toBe(true);
      expect(escalation!.confidence).toBeGreaterThan(0.2);
    });

    it('detects REVERSAL_TIMING with reversal/surprise keywords', () => {
      const chapters = [
        { content: '原来真相是这样，竟然没想到反转来得如此突然，出乎意料的发展。', chapterIndex: 1 },
      ];
      const result = analyzer.detectNarrativeTechniques(chapters);

      const reversal = result.detections.find(
        (d) => d.technique === NarrativeTechnique.REVERSAL_TIMING,
      );
      expect(reversal).toBeDefined();
      expect(reversal!.detected).toBe(true);
    });

    it('detects TICKING_CLOCK with deadline/pressure keywords', () => {
      const chapters = [
        { content: '时间只剩三天了，倒计时已经开始，最后的机会不能错过太来不及了。', chapterIndex: 1 },
      ];
      const result = analyzer.detectNarrativeTechniques(chapters);

      const clock = result.detections.find(
        (d) => d.technique === NarrativeTechnique.TICKING_CLOCK,
      );
      expect(clock).toBeDefined();
      expect(clock!.detected).toBe(true);
    });

    it('returns low scores for text without technique signals', () => {
      const chapters = [
        { content: '他走在路上，看到了一棵树。阳光很好，他继续走。', chapterIndex: 1 },
      ];
      const result = analyzer.detectNarrativeTechniques(chapters);

      expect(result.overallScore).toBeLessThan(0.3);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('provides recommendations for undetected techniques', () => {
      const chapters = [
        { content: '升级加剧进一步恶化。', chapterIndex: 1 },
      ];
      const result = analyzer.detectNarrativeTechniques(chapters);

      const undetectedCount = result.detections.filter((d) => !d.detected).length;
      expect(undetectedCount).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('SuspenseAnalyzer — M14 genre beats', () => {
  const analyzer = new SuspenseAnalyzer();

  describe('getGenreBeatsCatalog() catalog', () => {
    it('has 10 genre entries with complete data', () => {
      const entries = Object.values(getGenreBeatsCatalog());
      expect(entries).toHaveLength(10);

      for (const def of entries) {
        expect(def.genreType).toBeDefined();
        expect(def.label).toBeTruthy();
        expect(def.description.length).toBeGreaterThan(10);
        expect(def.beatSequence.length).toBeGreaterThanOrEqual(8);
        expect(def.characterArchetypes.length).toBeGreaterThanOrEqual(3);
        expect(def.keyScenes.length).toBeGreaterThanOrEqual(3);
        expect(def.typicalKeywords.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('each genre has a unique label', () => {
      const labels = Object.values(getGenreBeatsCatalog()).map((d) => d.label);
      expect(new Set(labels).size).toBe(10);
    });

    it('MONSTER_IN_THE_HOUSE has enclosed-space + monster keywords', () => {
      const def = getGenreBeatsCatalog()[GenreBeatType.MONSTER_IN_THE_HOUSE];
      expect(def.typicalKeywords).toContain('封闭');
      expect(def.typicalKeywords).toContain('怪物');
    });

    it('beat positions are within 0-1 range', () => {
      for (const def of Object.values(getGenreBeatsCatalog())) {
        for (const beat of def.beatSequence) {
          expect(beat.position).toBeGreaterThanOrEqual(0);
          expect(beat.position).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('analyzeGenreBeats()', () => {
    it('detects well-aligned beats for MONSTER_IN_THE_HOUSE', () => {
      const chapters = [
        { content: '封闭空间内怪物逃不出去，恐惧笼罩所有人。罪人隐藏着秘密。死了第一个人。', position: 0.01 },
        { content: '第一起死亡后，怪物出现猎杀封闭空间里的生存者。罪人被揭露。', position: 0.1 },
        { content: '他们决定逃亡对抗怪物。恐惧和生存本能驱动。', position: 0.25 },
        { content: '怪物逐一猎杀剩下的幸存者，空间越来越封闭。', position: 0.35 },
        { content: '怪物真正的力量和罪被揭露，隐藏的真相浮出水面。', position: 0.5 },
        { content: '怪物力量加强，空间进一步封闭逃不出去。最后希望破灭。', position: 0.75 },
        { content: '直面怪物，利用罪的力量反杀，生存者获得救赎。', position: 0.92 },
        { content: '生存者状态，罪被偿还，一切结束。', position: 0.99 },
      ];
      const result = analyzer.analyzeGenreBeats(chapters, GenreBeatType.MONSTER_IN_THE_HOUSE);

      expect(result.genreType).toBe(GenreBeatType.MONSTER_IN_THE_HOUSE);
      expect(result.label).toBe('屋里有怪物');
      expect(result.alignments.length).toBeGreaterThan(0);
      expect(result.overallAlignmentScore).toBeGreaterThan(0);
    });

    it('detects missing beats for sparse chapters', () => {
      const chapters = [
        { content: '开场画面展示日常状态。', position: 0.01 },
        { content: '故事结束。', position: 0.9 },
      ];
      const result = analyzer.analyzeGenreBeats(chapters, GenreBeatType.MONSTER_IN_THE_HOUSE);

      expect(result.missingBeats.length).toBeGreaterThan(0);
      expect(result.overallAlignmentScore).toBeLessThan(0.5);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('reports good alignment for complete beat coverage', () => {
      const beatPositions = [0.01, 0.05, 0.1, 0.15, 0.25, 0.27, 0.35, 0.5, 0.6, 0.75, 0.92, 0.99];
      const chapters = beatPositions.map((pos) => ({
        content: `节拍位置 ${pos}。旅程出发路上伙伴寻找目标冒险奇遇回到改变。`,
        position: pos,
      }));
      const result = analyzer.analyzeGenreBeats(chapters, GenreBeatType.GOLDEN_FLEECE);

      expect(result.overallAlignmentScore).toBeGreaterThan(0.5);
    });

    it('works with SUPERHERO genre', () => {
      const chapters = [
        { content: '展示非凡能力，隐藏身份。孤独伴随着能力。', position: 0.01 },
        { content: '敌人出现，被迫使用能力。害怕但必须保护。', position: 0.1 },
        { content: '接受英雄身份，承担责任。常人伙伴关系。', position: 0.25 },
        { content: '使用能力的快感和代价。能力无法解决根本问题。', position: 0.35 },
        { content: '敌人利用主角弱点。普通人需要保护。', position: 0.6 },
        { content: '能力失去，最重要的东西被夺走。', position: 0.75 },
        { content: '不求能力只求牺牲，英雄的选择。', position: 0.92 },
        { content: '接受孤独，找到平衡。', position: 0.99 },
      ];
      const result = analyzer.analyzeGenreBeats(chapters, GenreBeatType.SUPERHERO);

      expect(result.genreType).toBe(GenreBeatType.SUPERHERO);
      expect(result.alignments.length).toBeGreaterThan(0);
    });
  });
});
