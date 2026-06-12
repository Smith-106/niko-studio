import { describe, expect, it } from 'vitest';

import { NarrativePatternDetector } from '../../analysis/narrative-pattern-detector.js';

describe('analysis/narrative-pattern-detector branch-gap coverage', () => {
  it('skips already-used indices when building later clusters', () => {
    const detector = new NarrativePatternDetector({
      getEntitiesByTypes: async () => [],
    }) as unknown as {
      clusterOccurrences: (
        occurrences: Array<{ entityId: string; entityName: string; confidence: number; context: string }>,
        template: { keywords: string[] },
      ) => Array<{ entityId: string }>;
    };

    const clustered = detector.clusterOccurrences(
      [
        { entityId: 'scene-1', entityName: 'scene-1', confidence: 0.8, context: 'alpha seed' },
        { entityId: 'scene-2', entityName: 'scene-2', confidence: 0.7, context: 'beta branch' },
        { entityId: 'scene-3', entityName: 'scene-3', confidence: 0.9, context: 'alpha echo' },
      ],
      {
        keywords: ['alpha', 'beta'],
      },
    );

    expect(clustered).toEqual([
      expect.objectContaining({ entityId: 'scene-1' }),
      expect.objectContaining({ entityId: 'scene-3' }),
    ]);
  });

  it('treats zero-norm keyword vectors as zero cosine similarity instead of crashing', () => {
    const detector = new NarrativePatternDetector(
      {
        getEntitiesByTypes: async () => [],
      },
      {
        similarityThreshold: 0,
      },
    ) as unknown as {
      clusterOccurrences: (
        occurrences: Array<{ entityId: string; entityName: string; confidence: number; context: string }>,
        template: { keywords: string[] },
      ) => Array<{ entityId: string }>;
    };

    const clustered = detector.clusterOccurrences(
      [
        { entityId: 'scene-1', entityName: 'scene-1', confidence: 0.4, context: 'anything' },
        { entityId: 'scene-2', entityName: 'scene-2', confidence: 0.5, context: 'else' },
      ],
      {
        keywords: [],
      },
    );

    expect(clustered).toHaveLength(2);
    expect(clustered.map((item) => item.entityId)).toEqual(['scene-1', 'scene-2']);
  });

  it('returns perfect similarity for zero or single occurrence helper inputs', () => {
    const detector = new NarrativePatternDetector({
      getEntitiesByTypes: async () => [],
    }) as unknown as {
      computeAvgSimilarity: (
        occurrences: Array<{ confidence: number }>,
      ) => number;
    };

    expect(detector.computeAvgSimilarity([])).toBe(1);
    expect(detector.computeAvgSimilarity([{ confidence: 0.8 }])).toBe(1);
  });
});
