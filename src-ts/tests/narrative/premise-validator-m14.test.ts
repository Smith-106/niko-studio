import { describe, expect, it } from 'vitest';

import {
  OutlineQualityDimension,
  DimensionAssessment,
  OutlineAssessment,
  assessOutlineQuality,
  DIMENSION_THRESHOLDS,
  OUTLINE_QUALITY_PATTERNS,
} from '../../narrative/premise-validator';

describe('PremiseValidator — M14 outline quality', () => {
  describe('OutlineQualityDimension enum', () => {
    it('has exactly 5 entries', () => {
      const values = Object.values(OutlineQualityDimension);
      expect(values).toHaveLength(5);
    });

    it('contains all dimension values', () => {
      expect(OutlineQualityDimension.CHARACTER_ARC_CLARITY).toBe('character_arc_clarity');
      expect(OutlineQualityDimension.CONFLICT_SUSTAINABILITY).toBe('conflict_sustainability');
      expect(OutlineQualityDimension.PACING_STRUCTURE).toBe('pacing_structure');
      expect(OutlineQualityDimension.THEMATIC_COHERENCE).toBe('thematic_coherence');
      expect(OutlineQualityDimension.HOOK_STRENGTH).toBe('hook_strength');
    });
  });

  describe('DIMENSION_THRESHOLDS', () => {
    it('has exactly 5 entries matching OutlineQualityDimension', () => {
      const keys = Object.keys(DIMENSION_THRESHOLDS);
      const enumValues = Object.values(OutlineQualityDimension);
      expect(keys.sort()).toEqual(enumValues.sort());
    });

    it('each entry has threshold, weight, and description', () => {
      for (const [key, entry] of Object.entries(DIMENSION_THRESHOLDS)) {
        expect(key as OutlineQualityDimension).toBeDefined();
        expect(typeof entry.threshold).toBe('number');
        expect(entry.threshold).toBeGreaterThan(0);
        expect(typeof entry.weight).toBe('number');
        expect(entry.weight).toBeGreaterThan(0);
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);
      }
    });

    it('weights sum to 1.0', () => {
      const totalWeight = Object.values(DIMENSION_THRESHOLDS)
        .reduce((sum, t) => sum + t.weight, 0);
      expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.01);
    });
  });

  describe('OUTLINE_QUALITY_PATTERNS', () => {
    it('has exactly 5 entries matching OutlineQualityDimension', () => {
      const keys = Object.keys(OUTLINE_QUALITY_PATTERNS);
      const enumValues = Object.values(OutlineQualityDimension);
      expect(keys.sort()).toEqual(enumValues.sort());
    });

    it('each dimension has positive and negative keyword arrays', () => {
      for (const [key, patterns] of Object.entries(OUTLINE_QUALITY_PATTERNS)) {
        expect(key as OutlineQualityDimension).toBeDefined();
        expect(patterns.positive.length).toBeGreaterThan(0);
        expect(patterns.negative.length).toBeGreaterThan(0);
      }
    });
  });

  describe('DimensionAssessment interface', () => {
    it('can be constructed with all fields', () => {
      const assessment: DimensionAssessment = {
        dimension: OutlineQualityDimension.CHARACTER_ARC_CLARITY,
        label: '角色弧线清晰度',
        score: 7.5,
        confidence: 0.8,
        evidence: ['成长', '转变'],
        issues: [],
        suggestions: [],
      };
      expect(assessment.dimension).toBe(OutlineQualityDimension.CHARACTER_ARC_CLARITY);
      expect(assessment.score).toBe(7.5);
    });
  });

  describe('OutlineAssessment interface', () => {
    it('can be constructed with all fields including actionableSuggestions', () => {
      const assessment: OutlineAssessment = {
        outlineText: 'test',
        dimensions: [],
        overallQualityScore: 7.2,
        qualityLevel: 'GOOD',
        criticalGaps: [],
        actionableSuggestions: [
          {
            dimension: OutlineQualityDimension.HOOK_STRENGTH,
            suggestion: '加强开篇钩子',
            priority: 'high',
          },
        ],
      };
      expect(assessment.qualityLevel).toBe('GOOD');
      expect(assessment.actionableSuggestions).toHaveLength(1);
    });
  });

  describe('assessOutlineQuality()', () => {
    it('scores high-quality outline with strong positive signals', () => {
      const outline = [
        '主角从一个懦弱的少年成长为勇敢的领袖，学会面对恐惧，转变自己的人生。',
        '核心冲突围绕两大势力的对抗，矛盾层层升级，一波三折。',
        '高潮与低谷交替，伏笔前后呼应，节奏紧凑。',
        '主题贯穿始终，围绕"勇气"这一核心展开。',
        '开篇设置悬念，意外发现一个秘密，危机突然降临。',
      ].join('\n');

      const result = assessOutlineQuality(outline);

      expect(result.overallQualityScore).toBeGreaterThan(5);
      expect(result.qualityLevel).toMatch(/EXCELLENT|GOOD/);
      expect(result.dimensions).toHaveLength(5);
      expect(result.criticalGaps.length).toBeLessThan(3);
    });

    it('detects problems in low-quality outline', () => {
      const outline = '他照旧一成不变地生活着，日常惯例，一帆风顺，流水账般平铺直叙。';

      const result = assessOutlineQuality(outline);

      expect(result.overallQualityScore).toBeLessThan(5);
      expect(result.qualityLevel).toBe('WEAK');
      expect(result.criticalGaps.length).toBeGreaterThan(0);
      expect(result.actionableSuggestions.length).toBeGreaterThan(0);
    });

    it('produces actionableSuggestions with priority for below-threshold dimensions', () => {
      const outline = '这是一个平淡的故事。他照旧过着日常惯例的生活。';
      const result = assessOutlineQuality(outline);

      expect(result.actionableSuggestions.length).toBeGreaterThan(0);
      for (const suggestion of result.actionableSuggestions) {
        expect(['high', 'medium', 'low']).toContain(suggestion.priority);
        expect(suggestion.dimension).toBeDefined();
        expect(suggestion.suggestion.length).toBeGreaterThan(0);
      }
    });

    it('returns 5 dimension assessments', () => {
      const result = assessOutlineQuality('主角成长，对抗敌人，高潮转折。');

      expect(result.dimensions).toHaveLength(5);
      const dimTypes = result.dimensions.map((d) => d.dimension);
      expect(dimTypes).toContain(OutlineQualityDimension.CHARACTER_ARC_CLARITY);
      expect(dimTypes).toContain(OutlineQualityDimension.CONFLICT_SUSTAINABILITY);
      expect(dimTypes).toContain(OutlineQualityDimension.PACING_STRUCTURE);
      expect(dimTypes).toContain(OutlineQualityDimension.THEMATIC_COHERENCE);
      expect(dimTypes).toContain(OutlineQualityDimension.HOOK_STRENGTH);
    });

    it('scores each dimension between 0 and 10', () => {
      const result = assessOutlineQuality('成长 转变 对抗 冲突 高潮 转折 主题 核心 悬念 意外');

      for (const dim of result.dimensions) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(10);
      }
    });

    it('assigns correct qualityLevel based on overallQualityScore', () => {
      const weakResult = assessOutlineQuality('');
      expect(['WEAK', 'ADEQUATE']).toContain(weakResult.qualityLevel);

      const strongOutline = '成长 转变 成为 学会 觉醒 对抗 冲突 矛盾 阻碍 升级 '
        + '高潮 低谷 转折 伏笔 呼应 主题 核心 主线 围绕 贯穿 '
        + '悬念 意外 谜团 危机 秘密';
      const strongResult = assessOutlineQuality(strongOutline);
      expect(['GOOD', 'EXCELLENT']).toContain(strongResult.qualityLevel);
    });

    it('stores original outlineText in result', () => {
      const outline = '主角在冲突中成长';
      const result = assessOutlineQuality(outline);
      expect(result.outlineText).toBe(outline);
    });
  });
});
