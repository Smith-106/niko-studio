import { describe, expect, it } from 'vitest';

import {
  buildLockBreakdown,
  buildLockRadarData,
} from '../../ui/components/lock-radar.js';

describe('ui/components/lock-radar additional coverage', () => {
  it('falls back to English translations for unsupported languages', () => {
    const unsupportedLang = 'fr' as 'en' | 'zh';

    const radar = buildLockRadarData(
      { L: 4, O: 3, C: 2, K: 1 },
      12,
      undefined,
      unsupportedLang,
    );
    const breakdown = buildLockBreakdown(
      { L: 4, O: 3, C: 2, K: 1 },
      { K: 'ending lands' },
      unsupportedLang,
    );

    expect(radar.categories).toEqual([
      'Lead',
      'Objective',
      'Confrontation',
      'Knockout',
    ]);
    expect(radar.title).toBe('LOCK System Score');
    expect(breakdown.map(item => item.name)).toEqual([
      'Lead',
      'Objective',
      'Confrontation',
      'Knockout',
    ]);
    expect(breakdown[3]?.analysis).toBe('ending lands');
  });
});
