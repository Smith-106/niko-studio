import { describe, expect, it } from 'vitest';

import {
  NowledgeMemEvolvesKind,
  NowledgeMemRelationType,
} from '../../protocols/nowledge-mem.js';

describe('protocols/nowledge-mem', () => {
  it('exports the relation and evolves enums with stable literal values', () => {
    expect(Object.values(NowledgeMemRelationType)).toEqual([
      'RELATED',
      'CAUSED',
      'ENABLED',
      'PART_OF',
      'PRECEDED',
      'EVOLVES',
    ]);
    expect(Object.values(NowledgeMemEvolvesKind)).toEqual([
      'Replaces',
      'Enriches',
      'Confirms',
      'Challenges',
    ]);
  });
});
