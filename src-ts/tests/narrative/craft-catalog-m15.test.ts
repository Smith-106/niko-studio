import { describe, expect, it } from 'vitest';

import {
  UpgradeSystem,
  UpgradeSystemDef,
  getUpgradeSystemsCatalog,
  GoldenFingerType,
  GoldenFingerDef,
  getGoldenFingersCatalog,
  AntiPattern,
  AntiPatternDef,
  getAntiPatternsCatalog,
  NarrativePrinciple,
  NarrativePrincipleDef,
  getNarrativePrinciplesCatalog,
  getStoryStructuresCatalog,
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

  describe('getUpgradeSystemsCatalog() Record', () => {
    it('has exactly 5 entries matching UpgradeSystem', () => {
      const keys = Object.keys(getUpgradeSystemsCatalog());
      expect(keys.sort()).toEqual(Object.values(UpgradeSystem).sort());
    });

    it('each entry has required fields', () => {
      for (const def of Object.values(getUpgradeSystemsCatalog())) {
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

  describe('getGoldenFingersCatalog() Record', () => {
    it('has exactly 6 entries matching GoldenFingerType', () => {
      const keys = Object.keys(getGoldenFingersCatalog());
      expect(keys.sort()).toEqual(Object.values(GoldenFingerType).sort());
    });

    it('each entry has powerGrowthPattern', () => {
      for (const def of Object.values(getGoldenFingersCatalog())) {
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

  describe('getAntiPatternsCatalog() Record', () => {
    it('has exactly 10 entries matching AntiPattern', () => {
      const keys = Object.keys(getAntiPatternsCatalog());
      expect(keys.sort()).toEqual(Object.values(AntiPattern).sort());
    });

    it('each entry has severity and fixSuggestion', () => {
      for (const def of Object.values(getAntiPatternsCatalog())) {
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

  describe('getNarrativePrinciplesCatalog() Record', () => {
    it('has exactly 6 entries', () => {
      expect(Object.keys(getNarrativePrinciplesCatalog())).toHaveLength(6);
    });

    it('each entry has source and applicationGuide', () => {
      for (const def of Object.values(getNarrativePrinciplesCatalog())) {
        expect(def.source).toBeTruthy();
        expect(def.applicationGuide).toBeTruthy();
      }
    });
  });

  describe('getStoryStructuresCatalog() — edson_23_sequence', () => {
    it('exists in getStoryStructuresCatalog()', () => {
      expect(getStoryStructuresCatalog().edson_23_sequence).toBeDefined();
      expect(getStoryStructuresCatalog().edson_23_sequence.name).toContain('Edson');
    });

    it('has beat sequence', () => {
      const beats = getStoryStructuresCatalog().edson_23_sequence.beats;
      expect(beats.length).toBeGreaterThan(10);
    });
  });
});
