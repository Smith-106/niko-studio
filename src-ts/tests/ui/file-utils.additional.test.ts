import { describe, expect, it } from 'vitest';

import { recursiveCharacterSplit } from '../../ui/file-utils.js';

describe('ui/file-utils additional coverage', () => {
  it('returns the raw chunk when the text already fits in one chunk', () => {
    expect(recursiveCharacterSplit('short text', 32, 4)).toEqual(['short text']);
  });

  it('covers the hard-split fallback and filters blank chunks', () => {
    expect(recursiveCharacterSplit('abc', 0, -1)).toEqual([]);
  });
});
