import { describe, expect, it } from 'vitest';

import {
  CharacterArchetype,
  ArchetypeCategory,
  ARCHETYPE_CATALOG,
  matchArchetype,
} from '../../narrative/writing-craft/archetype-catalog';

describe('Character Archetypes', () => {
  it('has 45 archetypes defined', () => {
    expect(Object.keys(ARCHETYPE_CATALOG)).toHaveLength(45);
  });

  it('enum values match record keys', () => {
    const enumValues = Object.values(CharacterArchetype);
    const recordKeys = Object.keys(ARCHETYPE_CATALOG);
    expect(enumValues.sort()).toEqual(recordKeys.sort());
  });

  it('has 8 categories with correct counts', () => {
    const categories = Object.values(ARCHETYPE_CATALOG).map((a) => a.category);
    const counts: Record<string, number> = {};
    for (const c of categories) counts[c] = (counts[c] || 0) + 1;

    expect(counts[ArchetypeCategory.HERO]).toBe(6);
    expect(counts[ArchetypeCategory.MENTOR]).toBe(5);
    expect(counts[ArchetypeCategory.SHADOW]).toBe(7);
    expect(counts[ArchetypeCategory.HERALD]).toBe(5);
    expect(counts[ArchetypeCategory.THRESHOLD_GUARDIAN]).toBe(5);
    expect(counts[ArchetypeCategory.SHAPESHIFTER]).toBe(6);
    expect(counts[ArchetypeCategory.TRICKSTER]).toBe(6);
    expect(counts[ArchetypeCategory.ALLY]).toBe(5);
  });

  it('each archetype has complete data', () => {
    for (const def of Object.values(ARCHETYPE_CATALOG)) {
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.motivation).toBeTruthy();
      expect(def.fear).toBeTruthy();
      expect(def.arc.positive).toBeTruthy();
      expect(def.arc.negative).toBeTruthy();
      expect(def.keywords.length).toBeGreaterThanOrEqual(3);
      expect(def.shadowTraits.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('matchArchetype returns WARRIOR for warrior keywords', () => {
    const results = matchArchetype(['他战斗勇猛，守护身边的人，不屈不挠']);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].archetype).toBe(CharacterArchetype.WARRIOR);
  });

  it('matchArchetype returns VILLAIN for villain keywords', () => {
    const results = matchArchetype(['他是主角最大的敌人，阴谋野心勃勃']);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.archetype === CharacterArchetype.VILLAIN)).toBe(true);
  });

  it('matchArchetype returns low confidence for generic text', () => {
    const results = matchArchetype(['今天天气不错']);
    expect(results.every((r) => r.confidence < 0.3)).toBe(true);
  });

  it('match results have required fields', () => {
    const results = matchArchetype(['他战斗勇猛守护身边人']);
    for (const r of results) {
      expect(r.archetype).toBeDefined();
      expect(r.label).toBeTruthy();
      expect(r.category).toBeDefined();
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.suggestedArc).toBeTruthy();
    }
  });
});
