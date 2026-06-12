import { describe, expect, it } from 'vitest';

import { NarrativePatternDetector } from '../../analysis/narrative-pattern-detector.js';

describe('analysis/narrative-pattern-detector additional coverage', () => {
  it('uses perfect average similarity for a single clustered occurrence', () => {
    const detector = new NarrativePatternDetector({
      getEntitiesByTypes: async () => [],
    });

    const pattern = (
      detector as unknown as {
        detectPattern: (
          entities: Array<{ id: string; name: string; observations: string[] }>,
          template: {
            name: string;
            category: 'theme';
            keywords: string[];
            minOccurrences: number;
            confidenceThreshold: number;
          },
        ) => {
          avgSimilarity: number;
          occurrences: Array<{ entityId: string }>;
          name: string;
          category: string;
        } | null;
      }
    ).detectPattern(
      [
        {
          id: 'scene-1',
          name: 'Recurring Motif',
          observations: ['A motif returns once.'],
        },
      ],
      {
        name: 'single-motif',
        category: 'theme',
        keywords: ['motif'],
        minOccurrences: 1,
        confidenceThreshold: 0.1,
      },
    );

    expect(pattern).toMatchObject({
      name: 'single-motif',
      category: 'theme',
      avgSimilarity: 1,
      occurrences: [{ entityId: 'scene-1' }],
    });
  });
});
