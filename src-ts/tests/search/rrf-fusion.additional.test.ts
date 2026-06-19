import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RRF_K,
  heatDecayScore,
  rrfMerge,
} from '../../search/utils/rrf-fusion.js';

describe('search/utils/rrf-fusion additional coverage', () => {
  it('merges ranked sources with rounded scores and deduplicated source names', () => {
    const results = rrfMerge([
      {
        name: 'vector',
        weight: 2,
        items: [
          { id: 'alpha', score: 0.91 },
          { id: 'beta', score: 0.8 },
        ],
      },
      {
        name: 'keyword',
        weight: 1,
        items: [
          { id: 'beta', score: 0.99 },
          { id: 'alpha', score: 0.6 },
          { id: 'gamma', score: 0.5 },
        ],
      },
      {
        name: 'vector',
        weight: 1,
        items: [{ id: 'alpha', score: 0.7 }],
      },
    ]);

    expect(results).toEqual([
      {
        id: 'alpha',
        score: 0.0653,
        sources: ['vector', 'keyword'],
      },
      {
        id: 'beta',
        score: 0.0487,
        sources: ['vector', 'keyword'],
      },
      {
        id: 'gamma',
        score: 0.0159,
        sources: ['keyword'],
      },
    ]);
  });

  it('supports empty inputs, custom smoothing, and heat decay edge cases', () => {
    expect(rrfMerge([], DEFAULT_RRF_K)).toEqual([]);

    expect(
      rrfMerge(
        [
          {
            name: 'solo',
            weight: 3,
            items: [{ id: 'only', score: 1 }],
          },
        ],
        1,
      ),
    ).toEqual([
      {
        id: 'only',
        score: 1.5,
        sources: ['solo'],
      },
    ]);

    expect(heatDecayScore(0, 10, 5)).toBe(0);
    expect(heatDecayScore(20, 10, 0)).toBe(1);
    expect(heatDecayScore(5, 10, 30, 30)).toBeCloseTo(0.18394, 5);
  });
});
