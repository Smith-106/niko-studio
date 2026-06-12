import { describe, expect, it } from 'vitest';

import type { ReaderReaction } from '../../reader/DualEngine.js';
import { ConsensusEngine } from '../../reader/ConsensusEngine.js';
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
      plotCoherence: 0.4,
      characterConsistency: 0.45,
      styleConsistency: 0.35,
      pacingTension: 0.5,
      ...overrides.dimensions,
    },
    highlights: overrides.highlights ?? [],
    overallScore: overrides.overallScore ?? 0.4,
  };
}

describe('reader/ConsensusEngine branch gap coverage', () => {
  it('sorts equal-severity items by consensus strength and emits medium severity for two negative findings', () => {
    const engine = new ConsensusEngine();
    const report = engine.buildConsensus([
      createReaction('p1', 'Atlas', {
        highlights: [
          {
            text: 'Plot concern one',
            position: { chapter: '1', paragraph: 0 },
            reaction: 'negative',
            comment: 'plot issue',
            dimension: QualityDimension.PLOT_COHERENCE,
          },
          {
            text: 'Style concern one',
            position: { chapter: '2', paragraph: 0 },
            reaction: 'negative',
            comment: 'style issue',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
          {
            text: 'Character concern one',
            position: { chapter: '3', paragraph: 0 },
            reaction: 'negative',
            comment: 'character issue',
            dimension: QualityDimension.CHARACTER_CONSISTENCY,
          },
        ],
      }),
      createReaction('p2', 'Beacon', {
        highlights: [
          {
            text: 'Plot concern two',
            position: { chapter: '1', paragraph: 1 },
            reaction: 'negative',
            comment: 'plot issue',
            dimension: QualityDimension.PLOT_COHERENCE,
          },
          {
            text: 'Style neutral note',
            position: { chapter: '2', paragraph: 1 },
            reaction: 'neutral',
            comment: 'style issue',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
        ],
      }),
      createReaction('p3', 'Comet', {
        highlights: [
          {
            text: 'Style neutral note two',
            position: { chapter: '2', paragraph: 1 },
            reaction: 'neutral',
            comment: 'style issue',
            dimension: QualityDimension.STYLE_CONSISTENCY,
          },
        ],
      }),
      createReaction('p4', 'Drift', {
        highlights: [],
      }),
    ]);

    expect(report.items).toHaveLength(3);
    expect(report.items[0]).toMatchObject({
      dimension: QualityDimension.PLOT_COHERENCE,
      severity: 'medium',
      consensusStrength: 0.5,
    });
    const lowSeverityItems = report.items.filter((item) => item.severity === 'low');
    expect(lowSeverityItems).toEqual([
      expect.objectContaining({
        dimension: QualityDimension.STYLE_CONSISTENCY,
        consensusStrength: 0.75,
      }),
      expect.objectContaining({
        dimension: QualityDimension.CHARACTER_CONSISTENCY,
        consensusStrength: 0.25,
      }),
    ]);
  });

  it('reports high-priority findings without critical ones and falls back to low-quality overall guidance', () => {
    const engine = new ConsensusEngine();
    const report = engine.buildConsensus([
      createReaction('p1', 'Atlas', {
        dimensions: {
          plotCoherence: 0.25,
          characterConsistency: 0.3,
          styleConsistency: 0.35,
          pacingTension: 0.25,
        },
        highlights: [
          {
            text: 'Tension collapses',
            position: { chapter: '4', paragraph: 0 },
            reaction: 'negative',
            comment: 'tension collapses',
            dimension: QualityDimension.PACING_TENSION,
          },
        ],
      }),
      createReaction('p2', 'Beacon', {
        dimensions: {
          plotCoherence: 0.2,
          characterConsistency: 0.25,
          styleConsistency: 0.3,
          pacingTension: 0.2,
        },
        highlights: [
          {
            text: 'Tension collapses again',
            position: { chapter: '4', paragraph: 1 },
            reaction: 'negative',
            comment: 'tension collapses',
            dimension: QualityDimension.PACING_TENSION,
          },
        ],
      }),
      createReaction('p3', 'Comet', {
        dimensions: {
          plotCoherence: 0.3,
          characterConsistency: 0.35,
          styleConsistency: 0.28,
          pacingTension: 0.22,
        },
        highlights: [
          {
            text: 'Tension collapses once more',
            position: { chapter: '4', paragraph: 1 },
            reaction: 'negative',
            comment: 'tension collapses',
            dimension: QualityDimension.PACING_TENSION,
          },
        ],
      }),
      createReaction('p4', 'Drift', {
        dimensions: {
          plotCoherence: 0.2,
          characterConsistency: 0.2,
          styleConsistency: 0.25,
          pacingTension: 0.2,
        },
        highlights: [],
      }),
    ]);

    expect(report.criticalIssues).toEqual([
      expect.objectContaining({
        dimension: QualityDimension.PACING_TENSION,
        severity: 'high',
      }),
    ]);
    expect(report.criticalIssues.every((item) => item.severity !== 'critical')).toBe(true);
    expect(report.overallAssessment.length).toBeGreaterThan(0);
  });
});
