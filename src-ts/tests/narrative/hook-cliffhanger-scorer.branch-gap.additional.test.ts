import { describe, expect, it, vi } from 'vitest';

import {
  scoreCliffhanger,
  scoreHook,
} from '../../narrative/writing-craft/hook-cliffhanger-scorer';

function looksLikePatternMap(value: unknown): value is Record<string, { keywords: string[]; weight: number }> {
  if (value == null || typeof value !== 'object') {
    return false;
  }

  const entries = Reflect.ownKeys(value).map((key) => (value as Record<PropertyKey, unknown>)[key]);
  return entries.length > 0 && entries.every((entry) => (
    entry != null
    && typeof entry === 'object'
    && Array.isArray((entry as { keywords?: unknown }).keywords)
    && typeof (entry as { weight?: unknown }).weight === 'number'
  ));
}

describe('narrative/hook-cliffhanger-scorer branch-gap coverage', () => {
  it('falls back to zero-valued hook dimensions when no dimension scores are produced', () => {
    const originalEntries = Object.entries;
    let patternCallCount = 0;

    vi.spyOn(Object, 'entries').mockImplementation((value: object) => {
      if (looksLikePatternMap(value)) {
        patternCallCount += 1;
        if (patternCallCount === 1) {
          return [];
        }
      }

      return originalEntries(value);
    });

    const result = scoreHook('hook fallback probe');

    expect(result.overall).toBe(0);
    expect(result.dimensions.conflict_hint).toBe(0);
    expect(result.dimensions.info_gap).toBe(0);
    expect(result.dimensions.sensory_impact).toBe(0);
    expect(result.dimensions.pacing_entry).toBe(0);
    expect(result.evidence).toEqual([]);
  });

  it('falls back to zero-valued cliffhanger dimensions when pattern maps are empty throughout scoring', () => {
    const originalEntries = Object.entries;

    vi.spyOn(Object, 'entries').mockImplementation((value: object) => {
      if (looksLikePatternMap(value)) {
        return [];
      }

      return originalEntries(value);
    });

    const result = scoreCliffhanger('cliffhanger fallback probe');

    expect(result.overall).toBe(0);
    expect(result.dimensions.unresolved_questions).toBe(0);
    expect(result.dimensions.emotional_peak).toBe(0);
    expect(result.dimensions.twist_impact).toBe(0);
    expect(result.dimensions.anticipation).toBe(0);
    expect(result.evidence).toEqual([]);
  });
});
