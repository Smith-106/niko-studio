import { describe, expect, it } from 'vitest';

import type { ReaderReaction } from '../../reader/DualEngine.js';
import {
  ConsensusEngine,
  createConsensusEngine,
} from '../../reader/ConsensusEngine.js';
import { QualityDimension } from '../../quality/types.js';

function createReaction(
  personaId: string,
  personaName: string,
  overrides: Partial<ReaderReaction>,
): ReaderReaction {
  return {
    personaId,
    personaName,
    dimensions: {
      plotCoherence: 0.7,
      characterConsistency: 0.7,
      styleConsistency: 0.7,
      pacingTension: 0.7,
      ...overrides.dimensions,
    },
    highlights: overrides.highlights ?? [],
    overallScore: overrides.overallScore ?? 0.7,
  };
}

describe('reader/ConsensusEngine', () => {
  it('returns the empty report when no persona reactions are available', () => {
    const report = createConsensusEngine().buildConsensus([]);

    expect(report.items).toEqual([]);
    expect(report.criticalIssues).toEqual([]);
    expect(report.dissentItems).toEqual([]);
    expect(report.dimensionSummaries).toEqual({});
    expect(report.overallAssessment.length).toBeGreaterThan(0);
  });

  it('builds escalated consensus items, dissent items, and rounded summaries', () => {
    const engine = new ConsensusEngine();
    const reactions: ReaderReaction[] = [
      createReaction('p1', 'Atlas', {
        dimensions: {
          plotCoherence: 0.2,
          characterConsistency: 0.8,
          styleConsistency: 0.55,
          pacingTension: 0.6,
        },
        highlights: [
          {
            text: 'The causal chain snaps.',
            position: { chapter: '1', paragraph: 0 },
            reaction: 'negative',
            comment: 'plot logic breaks',
            dimension: QualityDimension.PLOT_COHERENCE,
          },
          {
            text: 'The narration changes voice.',
            position: { chapter: '2', paragraph: 10 },
            reaction: 'negative',
            comment: 'style drift',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
        ],
      }),
      createReaction('p2', 'Beacon', {
        dimensions: {
          plotCoherence: 0.4,
          characterConsistency: 0.8,
          styleConsistency: 0.65,
          pacingTension: 0.6,
        },
        highlights: [
          {
            text: 'Cause and effect never lands.',
            position: { chapter: '1', paragraph: 1 },
            reaction: 'negative',
            comment: 'cause and effect fails',
            dimension: QualityDimension.PLOT_COHERENCE,
          },
          {
            text: 'The diction still fits.',
            position: { chapter: '2', paragraph: 11 },
            reaction: 'positive',
            comment: 'style still works',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
        ],
      }),
      createReaction('p3', 'Comet', {
        dimensions: {
          plotCoherence: 0.6,
          characterConsistency: 0.8,
          styleConsistency: 0.75,
          pacingTension: 0.6,
        },
        highlights: [
          {
            text: 'The same break appears again.',
            position: { chapter: '1', paragraph: 1 },
            reaction: 'negative',
            comment: 'plot logic breaks',
            dimension: QualityDimension.PLOT_COHERENCE,
          },
        ],
      }),
    ];

    const report = engine.buildConsensus(reactions);

    expect(report.items).toHaveLength(2);

    const plotIssue = report.items.find(
      (item) => item.dimension === QualityDimension.PLOT_COHERENCE,
    );
    expect(plotIssue).toMatchObject({
      dimension: QualityDimension.PLOT_COHERENCE,
      severity: 'critical',
      consensusStrength: 1,
      agreeingPersonas: ['p1', 'p2', 'p3'],
      disagreeingPersonas: [],
      location: { chapter: '1', paragraph: 0 },
    });
    expect(plotIssue?.description).toContain('plot logic breaks');
    expect(plotIssue?.description).toContain('cause and effect fails');

    const dissentIssue = report.dissentItems[0];
    expect(dissentIssue).toMatchObject({
      dimension: QualityDimension.STYLE_CONSISTENCY,
      severity: 'low',
      agreeingPersonas: ['p1'],
      disagreeingPersonas: ['p2'],
    });
    expect(dissentIssue?.consensusStrength).toBeCloseTo(1 / 3, 5);

    expect(report.criticalIssues).toEqual([plotIssue]);
    expect(report.dimensionSummaries[QualityDimension.PLOT_COHERENCE]).toEqual({
      avgScore: 0.4,
      consensus: 0.673,
    });
    expect(report.dimensionSummaries[QualityDimension.CHARACTER_CONSISTENCY]).toEqual({
      avgScore: 0.8,
      consensus: 1,
    });
    expect(report.overallAssessment.length).toBeGreaterThan(0);
  });
});
