import { describe, expect, it } from 'vitest';

import { CrossChapterCharacterTracker } from '../../narrative/cross-chapter-character-tracker';

describe('CrossChapterCharacterTracker branch-gap coverage', () => {
  it('reuses the existing count when the same first name appears in repeated joint openings', () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    const names = tracker.extractCharacterNames([
      '林岚和陈明。',
      '林岚和阿泽。',
    ]);

    expect(names).toEqual(expect.arrayContaining(['林岚', '陈明', '阿泽']));
    expect(names[0]).toBe('林岚');
  });
});
