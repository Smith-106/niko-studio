import { describe, expect, it } from 'vitest';

import { determineExtractionTier } from '../../learning/spoiler-gate';
import { ExtractionTier, type ReadingSession } from '../../learning/learning-types';

function makeSession(current: number, total: number): ReadingSession {
  return {
    bookId: 'test-book',
    currentChapter: current,
    totalChapters: total,
    startedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('spoiler-gate', () => {
  it('blocks extraction below 30% progress', () => {
    const result = determineExtractionTier(makeSession(5, 100));
    expect(result.tier).toBe(ExtractionTier.BLOCKED);
    expect(result.allowedCategories).toEqual([]);
  });

  it('allows light extraction between 30% and 80%', () => {
    const result = determineExtractionTier(makeSession(50, 100));
    expect(result.tier).toBe(ExtractionTier.LIGHT);
    expect(result.allowedCategories).toContain('character');
    expect(result.allowedCategories).toContain('location');
    expect(result.allowedCategories).not.toContain('event');
  });

  it('allows heavy extraction above 80%', () => {
    const result = determineExtractionTier(makeSession(85, 100));
    expect(result.tier).toBe(ExtractionTier.HEAVY);
    expect(result.allowedCategories).toContain('event');
    expect(result.allowedCategories).toContain('concept');
  });

  it('returns reason with progress percentage', () => {
    const result = determineExtractionTier(makeSession(50, 100));
    expect(result.reason).toContain('50%');
  });

  it('handles zero totalChapters gracefully', () => {
    const result = determineExtractionTier(makeSession(0, 0));
    expect(result.tier).toBe(ExtractionTier.HEAVY);
  });

  it('handles exact boundary values', () => {
    const at30 = determineExtractionTier(makeSession(30, 100));
    expect(at30.tier).toBe(ExtractionTier.LIGHT);

    const at80 = determineExtractionTier(makeSession(80, 100));
    expect(at80.tier).toBe(ExtractionTier.HEAVY);
  });
});
