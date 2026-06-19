import { describe, expect, it } from 'vitest';

import type { ReaderReaction } from '../../reader/DualEngine.js';
import { ConsensusEngine } from '../../reader/ConsensusEngine.js';
import { QualityDimension } from '../../quality/types.js';

function createReaction(
  personaId: string,
  personaName: string,
  overrides: Partial<ReaderReaction> = {},
): ReaderReaction {
  return {
    personaId,
    personaName,
    dimensions: {
      plotCoherence: 0.9,
      characterConsistency: 0.9,
      styleConsistency: 0.9,
      pacingTension: 0.9,
      ...overrides.dimensions,
    },
    highlights: overrides.highlights ?? [],
    overallScore: overrides.overallScore ?? 0.9,
  };
}

describe('reader/ConsensusEngine additional coverage', () => {
  it('returns a positive overall assessment when readers report no concrete issues', () => {
    const engine = new ConsensusEngine();
    const report = engine.buildConsensus([
      createReaction('p1', 'Atlas'),
      createReaction('p2', 'Beacon', {
        dimensions: {
          plotCoherence: 0.85,
          characterConsistency: 0.88,
          styleConsistency: 0.92,
          pacingTension: 0.9,
        },
      }),
    ]);

    expect(report.items).toEqual([]);
    expect(report.dimensionSummaries[QualityDimension.PLOT_COHERENCE]).toEqual({
      avgScore: 0.875,
      consensus: 0.95,
    });
    expect(report.overallAssessment.length).toBeGreaterThan(0);
  });

  it('falls back to highlight text and default descriptions when comments and locations are missing', () => {
    const engine = new ConsensusEngine();

    const textFallbackReport = engine.buildConsensus([
      createReaction('p1', 'Atlas', {
        highlights: [
          {
            text: 'Text fallback should become the merged description.',
            position: { chapter: '3', paragraph: 4 },
            reaction: 'negative',
            comment: '',
            dimension: QualityDimension.PLOT_COHERENCE,
          },
        ],
      }),
    ]);

    expect(textFallbackReport.items[0]).toMatchObject({
      description: 'Text fallback should become the merged description.',
      location: { chapter: '3', paragraph: 4 },
      severity: 'medium',
      consensusStrength: 1,
    });

    const emptyDescriptionReport = engine.buildConsensus([
      createReaction('p2', 'Beacon', {
        highlights: [
          {
            text: '',
            position: {} as never,
            reaction: 'negative',
            comment: '',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
        ],
      }),
    ]);

    expect(emptyDescriptionReport.items[0]).toMatchObject({
      description: '未描述的问题',
      location: {
        chapter: undefined,
        paragraph: undefined,
      },
      severity: 'medium',
    });
  });

  it('treats purely positive findings as low-severity notes and keeps high-score assessments positive', () => {
    const engine = new ConsensusEngine();
    const report = engine.buildConsensus([
      createReaction('p1', 'Atlas', {
        highlights: [
          {
            text: 'The style feels polished and stable.',
            position: { chapter: '1', paragraph: 0 },
            reaction: 'positive',
            comment: 'polished style',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
        ],
      }),
      createReaction('p2', 'Beacon', {
        dimensions: {
          plotCoherence: 0.82,
          characterConsistency: 0.83,
          styleConsistency: 0.91,
          pacingTension: 0.84,
        },
      }),
    ]);

    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({
      severity: 'low',
      agreeingPersonas: [],
      disagreeingPersonas: ['p1'],
      consensusStrength: 0,
      dimension: QualityDimension.STYLE_CONSISTENCY,
    });
    expect(report.criticalIssues).toEqual([]);
    expect(report.dissentItems).toEqual([report.items[0]]);
    expect(report.overallAssessment.length).toBeGreaterThan(0);
  });
});
