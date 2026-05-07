import { describe, expect, it } from 'vitest';

import {
  UpgradeSystem,
  UpgradeSystemDef,
  UPGRADE_SYSTEMS,
  GoldenFingerType,
  GoldenFingerDef,
  GOLDEN_FINGERS,
  AntiPattern,
  AntiPatternDef,
  ANTI_PATTERNS,
  NarrativePrinciple,
  NarrativePrincipleDef,
  NARRATIVE_PRINCIPLES,
  STORY_STRUCTURES,
} from '../../narrative/writing-craft/craft-catalog';

describe('Craft Catalog — M15', () => {
  describe('UpgradeSystem enum', () => {
    it('has exactly 5 entries', () => {
      expect(Object.values(UpgradeSystem)).toHaveLength(5);
    });

    it('contains all upgrade system types', () => {
      expect(UpgradeSystem.LEVEL_BASED).toBe('level_based');
      expect(UpgradeSystem.SKILL_TREE).toBe('skill_tree');
      expect(UpgradeSystem.REALM_BREAKTHROUGH).toBe('realm_breakthrough');
      expect(UpgradeSystem.RESOURCE_ACCUMULATION).toBe('resource_accumulation');
      expect(UpgradeSystem.SOCIAL_RANK).toBe('social_rank');
    });
  });

  describe('UPGRADE_SYSTEMS Record', () => {
    it('has exactly 5 entries matching UpgradeSystem', () => {
      const keys = Object.keys(UPGRADE_SYSTEMS);
      expect(keys.sort()).toEqual(Object.values(UpgradeSystem).sort());
    });

    it('each entry has required fields', () => {
      for (const def of Object.values(UPGRADE_SYSTEMS)) {
        expect(def.label).toBeTruthy();
        expect(def.detectionKeywords.length).toBeGreaterThan(0);
        expect(def.progressionMarkers.length).toBeGreaterThan(0);
        expect(def.satisfactionTriggers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GoldenFingerType enum', () => {
    it('has exactly 6 entries', () => {
      expect(Object.values(GoldenFingerType)).toHaveLength(6);
    });
  });

  describe('GOLDEN_FINGERS Record', () => {
    it('has exactly 6 entries matching GoldenFingerType', () => {
      const keys = Object.keys(GOLDEN_FINGERS);
      expect(keys.sort()).toEqual(Object.values(GoldenFingerType).sort());
    });

    it('each entry has powerGrowthPattern', () => {
      for (const def of Object.values(GOLDEN_FINGERS)) {
        expect(def.powerGrowthPattern).toBeTruthy();
      }
    });
  });

  describe('AntiPattern enum', () => {
    it('has exactly 10 entries', () => {
      expect(Object.values(AntiPattern)).toHaveLength(10);
    });

    it('contains all anti-pattern types', () => {
      expect(AntiPattern.INFO_DUMP).toBe('info_dump');
      expect(AntiPattern.PASSIVE_PROTAGONIST).toBe('passive_protagonist');
      expect(AntiPattern.DEUS_EX_MACHINA).toBe('deus_ex_machina');
    });
  });

  describe('ANTI_PATTERNS Record', () => {
    it('has exactly 10 entries matching AntiPattern', () => {
      const keys = Object.keys(ANTI_PATTERNS);
      expect(keys.sort()).toEqual(Object.values(AntiPattern).sort());
    });

    it('each entry has severity and fixSuggestion', () => {
      for (const def of Object.values(ANTI_PATTERNS)) {
        expect(['critical', 'warning', 'minor']).toContain(def.severity);
        expect(def.fixSuggestion).toBeTruthy();
        expect(def.detectionKeywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('NarrativePrinciple enum', () => {
    it('has exactly 6 entries', () => {
      expect(Object.values(NarrativePrinciple)).toHaveLength(6);
    });
  });

  describe('NARRATIVE_PRINCIPLES Record', () => {
    it('has exactly 6 entries', () => {
      expect(Object.keys(NARRATIVE_PRINCIPLES)).toHaveLength(6);
    });

    it('each entry has source and applicationGuide', () => {
      for (const def of Object.values(NARRATIVE_PRINCIPLES)) {
        expect(def.source).toBeTruthy();
        expect(def.applicationGuide).toBeTruthy();
      }
    });
  });

  describe('STORY_STRUCTURES — edson_23_sequence', () => {
    it('exists in STORY_STRUCTURES', () => {
      expect(STORY_STRUCTURES.edson_23_sequence).toBeDefined();
      expect(STORY_STRUCTURES.edson_23_sequence.name).toContain('Edson');
    });

    it('has beat sequence', () => {
      const beats = STORY_STRUCTURES.edson_23_sequence.beats;
      expect(beats.length).toBeGreaterThan(10);
    });
  });
});
