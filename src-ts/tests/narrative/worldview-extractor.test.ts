import { describe, expect, it } from 'vitest';

import {
  WorldviewExtractor,
  WorldviewNature,
  type ChapterContent,
} from '../../narrative/worldview-extractor';

describe('WorldviewExtractor', () => {
  const chapters: ChapterContent[] = [
    {
      chapterNumber: 1,
      title: '初入魔法世界',
      content: '在灵山之中，修炼者必须遵守灵力的规则。灵力是修仙者的根本，过度使用会导致反噬。结界笼罩着整个灵山，防止外敌入侵。禁术是被严禁使用的法术，触犯者将受到严厉惩罚。',
    },
    {
      chapterNumber: 2,
      title: '幽暗城',
      content: '幽暗城位于灵山之北，是一座被黑暗笼罩的古城。城中居民遵循古老的规矩，夜间不得外出。灵河从城旁流过，河水蕴含着淡淡的灵气。',
    },
  ];

  describe('quickExtract (rule-based, no LLM)', () => {
    it('extracts magic system settings from chapter content', () => {
      const extractor = new WorldviewExtractor();
      const settings = extractor.quickExtract(chapters);

      const magic = settings.filter((s) => s.nature === WorldviewNature.MAGIC_SYSTEM);
      expect(magic.length).toBeGreaterThan(0);
      expect(magic.some((s) => s.term === '灵力')).toBe(true);
      expect(magic.some((s) => s.term === '结界')).toBe(true);
    });

    it('extracts geography settings from chapter content', () => {
      const extractor = new WorldviewExtractor();
      const settings = extractor.quickExtract(chapters);

      const geo = settings.filter((s) => s.nature === WorldviewNature.GEOGRAPHY);
      expect(geo.length).toBeGreaterThan(0);
    });

    it('includes chapter source in extracted settings', () => {
      const extractor = new WorldviewExtractor();
      const settings = extractor.quickExtract(chapters);

      for (const s of settings) {
        expect(s.source).toMatch(/^Ch\.\d+: /);
      }
    });

    it('deduplicates settings with same term and nature', () => {
      const extractor = new WorldviewExtractor();
      const dupChapters: ChapterContent[] = [
        { chapterNumber: 1, title: 'A', content: '灵力是基础。灵力非常重要。' },
        { chapterNumber: 2, title: 'B', content: '灵力是修炼的根本。' },
      ];

      const settings = extractor.quickExtract(dupChapters);
      const magicSettings = settings.filter(
        (s) => s.term === '灵力' && s.nature === WorldviewNature.MAGIC_SYSTEM,
      );

      expect(magicSettings).toHaveLength(1);
    });

    it('returns empty array for empty input', () => {
      const extractor = new WorldviewExtractor();
      expect(extractor.quickExtract([])).toEqual([]);
    });

    it('returns empty array for chapter with no world-building terms', () => {
      const extractor = new WorldviewExtractor();
      const boringChapter: ChapterContent[] = [
        { chapterNumber: 1, title: '日常', content: '他走到窗前，看着外面的雨。今天天气不好。' },
      ];

      const settings = extractor.quickExtract(boringChapter);
      expect(settings.filter((s) => s.nature === WorldviewNature.MAGIC_SYSTEM)).toHaveLength(0);
    });
  });

  describe('WorldviewNature enum', () => {
    it('has all expected nature categories', () => {
      expect(WorldviewNature.ARTIFACT).toBe('artifact');
      expect(WorldviewNature.SOCIAL_NORM).toBe('social_norm');
      expect(WorldviewNature.MAGIC_SYSTEM).toBe('magic_system');
      expect(WorldviewNature.GEOGRAPHY).toBe('geography');
      expect(WorldviewNature.POLITICAL).toBe('political');
    });
  });

  describe('extract (LLM path with fallback)', () => {
    it('falls back to rule-based extraction when no LLM client', async () => {
      const extractor = new WorldviewExtractor();
      const settings = await extractor.extract(chapters);

      expect(settings.length).toBeGreaterThan(0);

      const magic = settings.filter((s) => s.nature === WorldviewNature.MAGIC_SYSTEM);
      expect(magic.length).toBeGreaterThan(0);
    });

    it('returns empty array for empty chapters', async () => {
      const extractor = new WorldviewExtractor();
      const settings = await extractor.extract([]);
      expect(settings).toEqual([]);
    });
  });
});
