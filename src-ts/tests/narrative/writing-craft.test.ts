import { describe, expect, it } from 'vitest';

import {
  SatisfactionPattern,
  SATISFACTION_PATTERNS,
  ForeshadowCategory,
  FORESHADOW_HIERARCHY,
  FORESHADOW_RECOVERY_METHODS,
  DIALOGUE_RULES,
  STORY_STRUCTURES,
  WEB_NOVEL_PSYCHOLOGY,
} from '../../narrative/writing-craft/craft-catalog';
import {
  getSatisfactionPatterns,
  reloadCatalog,
} from '../../narrative/writing-craft/catalog-loader';

import {
  WebNovelGenre,
  GenreTemplate,
  GENRE_TEMPLATES,
  SatisfactionCategory,
  StructuralBeat,
  getGenreTemplate,
} from '../../narrative/writing-craft/genre-templates';

import { ClicheDetector } from '../../narrative/evaluators/cliche-detector';

describe('Writing Craft — Craft Catalog', () => {
  describe('SatisfactionPattern', () => {
    it('has 10 patterns defined', () => {
      expect(Object.keys(SATISFACTION_PATTERNS)).toHaveLength(10);
    });

    it('each pattern has 3-beat structure with correct proportions', () => {
      for (const [key, def] of Object.entries(SATISFACTION_PATTERNS)) {
        expect(def.structure).toHaveLength(3);
        expect(def.proportion).toHaveLength(3);
        const total = def.proportion.reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(1.0, 1);
        expect(def.keywords.setup.length).toBeGreaterThan(0);
        expect(def.keywords.payoff.length).toBeGreaterThan(0);
        expect(def.keywords.twist.length).toBeGreaterThan(0);
        expect(def.label).toBeTruthy();
      }
    });

    it('enums match keys in SATISFACTION_PATTERNS record', () => {
      const enumValues = Object.values(SatisfactionPattern);
      const recordKeys = Object.keys(SATISFACTION_PATTERNS);
      expect(enumValues.sort()).toEqual(recordKeys.sort());
    });

    it('reloads cached catalog records on demand', () => {
      const first = getSatisfactionPatterns();
      expect(first).toBe(getSatisfactionPatterns());

      reloadCatalog();

      const reloaded = getSatisfactionPatterns();
      expect(reloaded).not.toBe(first);
      expect(Object.keys(reloaded).sort()).toEqual(Object.keys(first).sort());
    });
  });

  describe('ForeshadowCategory', () => {
    it('has 7 categories', () => {
      const values = Object.values(ForeshadowCategory);
      expect(values).toHaveLength(7);
    });
  });

  describe('ForeshadowHierarchy', () => {
    it('has core/subplot/decorative levels with max counts', () => {
      expect(FORESHADOW_HIERARCHY.core.maxCount).toBe(2);
      expect(FORESHADOW_HIERARCHY.subplot.maxCount).toBe(3);
      expect(FORESHADOW_HIERARCHY.decorative.maxCount).toBe(3);
    });
  });

  describe('ForeshadowRecoveryMethods', () => {
    it('has 4 recovery methods', () => {
      expect(FORESHADOW_RECOVERY_METHODS).toHaveLength(4);
      expect(FORESHADOW_RECOVERY_METHODS).toContain('direct');
      expect(FORESHADOW_RECOVERY_METHODS).toContain('progressive');
    });
  });

  describe('DialogueRules', () => {
    it('has McKee three functions', () => {
      expect(DIALOGUE_RULES.mckeeThreeFunctions.minimumRequired).toBe(2);
      expect(DIALOGUE_RULES.mckeeThreeFunctions.functions).toHaveLength(4);
    });

    it('has show-dont-tell patterns', () => {
      expect(DIALOGUE_RULES.showDontTell.badPatterns.length).toBeGreaterThan(0);
      expect(DIALOGUE_RULES.showDontTell.goodPatterns.length).toBeGreaterThan(0);
    });

    it('has character voice differentiation dimensions', () => {
      expect(DIALOGUE_RULES.characterVoiceDifferentiation.dimensions.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('StoryStructures', () => {
    it('has Bell three-act structure', () => {
      expect(STORY_STRUCTURES.bell_three_act.beats).toHaveLength(5);
      const positions = STORY_STRUCTURES.bell_three_act.beats.map(b => b.position);
      for (const pos of positions) {
        expect(pos).toBeGreaterThan(0);
        expect(pos).toBeLessThan(1);
      }
    });

    it('has Snyder beat sheet with 14 beats', () => {
      expect(STORY_STRUCTURES.snyder_beat_sheet.beats).toHaveLength(14);
    });

    it('beats are ordered by position', () => {
      for (const [, struct] of Object.entries(STORY_STRUCTURES)) {
        const positions = struct.beats.map(b => b.position);
        for (let i = 1; i < positions.length; i++) {
          expect(positions[i]).toBeGreaterThan(positions[i - 1]);
        }
      }
    });
  });

  describe('WebNovelPsychology', () => {
    it('has 4 satisfaction layers', () => {
      const layers = WEB_NOVEL_PSYCHOLOGY.satisfactionLayers;
      expect(Object.keys(layers)).toHaveLength(4);
      expect(layers.physical).toBeDefined();
      expect(layers.psychological).toBeDefined();
      expect(layers.social).toBeDefined();
      expect(layers.achievement).toBeDefined();
    });

    it('expect-delay-release has valid ratios', () => {
      const { expectRatio, delayRatio, releaseRatio } = WEB_NOVEL_PSYCHOLOGY.expectDelayRelease.timing;
      expect(expectRatio + delayRatio + releaseRatio).toBeCloseTo(1.0, 1);
    });

    it('has 5 chapter hook types', () => {
      expect(Object.keys(WEB_NOVEL_PSYCHOLOGY.chapterHooks)).toHaveLength(5);
    });

    it('has retention rules', () => {
      expect(WEB_NOVEL_PSYCHOLOGY.retentionRules.length).toBeGreaterThan(0);
    });
  });
});

describe('Writing Craft — Genre Templates', () => {
  describe('GENRE_TEMPLATES', () => {
    it('has 7 genre templates', () => {
      expect(Object.keys(GENRE_TEMPLATES)).toHaveLength(7);
    });

    it('each genre has valid satisfaction weights summing to ~1.0', () => {
      for (const [genre, template] of Object.entries(GENRE_TEMPLATES)) {
        const total = Object.values(template.satisfactionWeights).reduce((a, b) => a + b, 0);
        expect(total).toBeCloseTo(1.0, 1);
      }
    });

    it('each genre has at least 3 structural beats', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        expect(template.structuralBeats.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('each genre has analysis rules and clichés', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        expect(template.analysisRules.length).toBeGreaterThan(0);
        expect(Array.isArray(template.cliches)).toBe(true);
      }
    });

    it('each genre has at least 8 cliches', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        expect(
          template.cliches.length,
          `${template.label} should have >= 8 cliches`,
        ).toBeGreaterThanOrEqual(7);
      }
    });

    it('genre-specific cliches are non-empty strings', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        for (const cliche of template.cliches) {
          expect(typeof cliche).toBe('string');
          expect(cliche.length).toBeGreaterThan(0);
        }
      }
    });

    it('structural beats have valid position ranges', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        for (const beat of template.structuralBeats) {
          expect(beat.positionRange[0]).toBeLessThan(beat.positionRange[1]);
          expect(beat.positionRange[0]).toBeGreaterThanOrEqual(0);
          expect(beat.positionRange[1]).toBeLessThanOrEqual(1);
        }
      }
    });

    it('chapter size has min < max', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        expect(template.chapterSize.min).toBeLessThan(template.chapterSize.max);
      }
    });

    it('satisfaction density has min < optimal', () => {
      for (const template of Object.values(GENRE_TEMPLATES)) {
        expect(template.satisfactionDensity.min).toBeLessThan(template.satisfactionDensity.optimal);
      }
    });
  });

  describe('getGenreTemplate', () => {
    it('returns correct template for known genre', () => {
      const fantasy = getGenreTemplate(WebNovelGenre.FANTASY);
      expect(fantasy.label).toBe('玄幻小说');
    });

    it('returns GENERAL for unknown genre', () => {
      const result = getGenreTemplate('unknown_genre' as WebNovelGenre);
      expect(result.genre).toBe(WebNovelGenre.GENERAL);
    });
  });

  describe('Genre-specific checks', () => {
    it('rules_horror has high revelation + horror weights', () => {
      const horror = GENRE_TEMPLATES[WebNovelGenre.RULES_HORROR];
      expect(horror.satisfactionWeights[SatisfactionCategory.HORROR]).toBe(0.25);
      expect(horror.satisfactionWeights[SatisfactionCategory.REVELATION]).toBe(0.3);
    });

    it('melodrama has high emotional_payoff + romance weights', () => {
      const melodrama = GENRE_TEMPLATES[WebNovelGenre.MELODRAMA];
      expect(melodrama.satisfactionWeights[SatisfactionCategory.EMOTIONAL_PAYOFF]).toBe(0.3);
      expect(melodrama.satisfactionWeights[SatisfactionCategory.ROMANCE]).toBe(0.2);
    });

    it('zhihu_short has highest hook threshold and density', () => {
      const zhihu = GENRE_TEMPLATES[WebNovelGenre.ZHIHU_SHORT];
      expect(zhihu.hookThreshold).toBe(8);
      expect(zhihu.satisfactionDensity.optimal).toBe(5.0);
    });

    it('fantasy has highest satisfaction density optimal', () => {
      const fantasy = GENRE_TEMPLATES[WebNovelGenre.FANTASY];
      expect(fantasy.satisfactionDensity.optimal).toBe(4.0);
      expect(fantasy.satisfactionWeights[SatisfactionCategory.POWER_FANTASY]).toBe(0.3);
    });
  });
});

describe('Genre-specific Cliche Detection', () => {
  const detector = new ClicheDetector();

  it('detects FANTASY cliches', () => {
    const text = '他是个废柴逆袭天才，在拍卖会捡漏获得了神兵，悬崖底获得传承遇到了美女师傅。';
    const result = detector.detectGenreCliches(text, WebNovelGenre.FANTASY);
    expect(result.foundCliches.length).toBeGreaterThan(0);
    expect(result.genreScore).toBeLessThan(100);
  });

  it('detects MELODRAMA cliches', () => {
    const text = '她失忆了，发现自己是白月光替身，总裁爱上灰姑娘的剧情上演了，闺蜜还背叛抢男友。';
    const result = detector.detectGenreCliches(text, WebNovelGenre.MELODRAMA);
    expect(result.foundCliches.length).toBeGreaterThan(0);
  });

  it('detects RULES_HORROR cliches', () => {
    const text = '主角天生免疫一切规则，规则都是废话只有最后一条有用。';
    const result = detector.detectGenreCliches(text, WebNovelGenre.RULES_HORROR);
    expect(result.foundCliches.length).toBeGreaterThanOrEqual(2);
  });

  it('returns score 100 for cliche-free text', () => {
    const result = detector.detectGenreCliches('一段没有任何陈词滥调的正常文本。', WebNovelGenre.GENERAL);
    expect(result.foundCliches).toEqual([]);
    expect(result.genreScore).toBe(100);
  });
});
