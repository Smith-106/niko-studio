import { describe, expect, it } from 'vitest';

import { translations } from '../../ui/translations.js';
import {
  buildLockBreakdown,
  buildLockRadarData,
  normalizeLockScores,
} from '../../ui/components/lock-radar.js';

describe('ui/components/lock-radar', () => {
  it('builds radar chart data with defaults, custom titles, and pass thresholds', () => {
    const directScores = { L: 8, O: 7, C: 6, K: 5 };
    const defaultData = buildLockRadarData(directScores);
    const customData = buildLockRadarData(directScores, 40, 'Custom LOCK', 'zh');

    expect(defaultData).toEqual({
      categories: ['Lead', 'Objective', 'Confrontation', 'Knockout'],
      values: [8, 7, 6, 5],
      valuesClosed: [8, 7, 6, 5, 8],
      categoriesClosed: ['Lead', 'Objective', 'Confrontation', 'Knockout', 'Lead'],
      thresholdPerItem: 7,
      total: 26,
      passed: false,
      title: 'LOCK System Score',
    });

    expect(customData.title).toBe('Custom LOCK');
    expect(customData.categories[0]).toBe(translations.zh('lock_L'));
    expect(customData.thresholdPerItem).toBe(10);
    expect(customData.passed).toBe(false);
  });

  it('builds lock breakdown entries and marks confrontation as the conflict axis', () => {
    const breakdown = buildLockBreakdown(
      { L: 8, O: 7, C: 6, K: 5 },
      { C: 'conflict is active' },
    );

    expect(breakdown).toHaveLength(4);
    expect(breakdown[0]).toMatchObject({
      key: 'L',
      name: 'Lead',
      description: 'Does the scene establish a clear leading thread?',
      tooltip: 'Lead measures narrative direction clarity',
      score: 8,
      isConflict: false,
      analysis: null,
    });
    expect(breakdown[2]).toMatchObject({
      key: 'C',
      isConflict: true,
      analysis: 'conflict is active',
    });
  });

  it('normalizes mixed raw score keys through direct, full-key, prefix, and missing fallbacks', () => {
    expect(
      normalizeLockScores({
        'L (Lead)': 9,
        'O narrative': 8,
        C: 7,
      }),
    ).toEqual({
      L: 9,
      O: 8,
      C: 7,
      K: 0,
    });
  });
});
