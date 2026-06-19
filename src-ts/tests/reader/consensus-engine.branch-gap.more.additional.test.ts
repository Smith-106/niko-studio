import { describe, expect, it } from 'vitest';

import type { ConsensusReport } from '../../reader/ConsensusEngine.js';
import { ConsensusEngine } from '../../reader/ConsensusEngine.js';
import type { ReaderReaction } from '../../reader/DualEngine.js';
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
      plotCoherence: 0.5,
      characterConsistency: 0.5,
      styleConsistency: 0.5,
      pacingTension: 0.5,
      ...overrides.dimensions,
    },
    highlights: overrides.highlights ?? [],
    overallScore: overrides.overallScore ?? 0.5,
  };
}

describe('reader/ConsensusEngine branch-gap additional coverage', () => {
  it('compareConsensus uses nullish coalescing when a dimension is missing from reportB (lines 478-479)', () => {
    const engine = new ConsensusEngine();

    // Build reportA with all dimension summaries
    const reportA = engine.buildConsensus([
      createReaction('p1', 'Alpha', {
        dimensions: { plotCoherence: 0.9, characterConsistency: 0.8, styleConsistency: 0.7, pacingTension: 0.6 },
      }),
      createReaction('p2', 'Beta', {
        dimensions: { plotCoherence: 0.85, characterConsistency: 0.75, styleConsistency: 0.65, pacingTension: 0.55 },
      }),
    ]);

    // Manually create reportB with a missing dimension to trigger the nullish coalescing.
    // The compareConsensus method uses allDimensions = union of keys from both reports.
    // When a dimension is in reportA but not reportB, summaryB is undefined,
    // so versionBScore = summaryB?.avgScore ?? 0 fires the ?? 0 branch.
    const reportB: ConsensusReport = {
      items: [],
      overallAssessment: 'Test',
      criticalIssues: [],
      dissentItems: [],
      // Missing plot-coherence to trigger the ?? 0 fallback for versionBScore
      dimensionSummaries: {
        [QualityDimension.CHARACTER_CONSISTENCY]: { avgScore: 0.3, consensus: 0.9 },
        [QualityDimension.STYLE_CONSISTENCY]: { avgScore: 0.4, consensus: 0.8 },
        [QualityDimension.PACING_TENSION]: { avgScore: 0.5, consensus: 0.7 },
      },
    };

    const comparison = engine.compareConsensus(reportA, reportB);

    // Find the plot-coherence item — it should exist because it's in
    // reportA's dimensionSummaries but not reportB's
    const plotItem = comparison.find((c) => c.dimension === QualityDimension.PLOT_COHERENCE);
    expect(plotItem).toBeDefined();
    expect(plotItem!.versionAScore).toBeGreaterThan(0); // from reportA
    expect(plotItem!.versionBScore).toBe(0); // ?? 0 fallback
    expect(plotItem!.winner).toBe('A');
  });

  it('compareConsensus uses nullish coalescing when a dimension is missing from reportA', () => {
    const engine = new ConsensusEngine();

    // Create reportA missing pacing-tension
    const reportA: ConsensusReport = {
      items: [],
      overallAssessment: 'Test',
      criticalIssues: [],
      dissentItems: [],
      dimensionSummaries: {
        [QualityDimension.PLOT_COHERENCE]: { avgScore: 0.5, consensus: 0.9 },
        [QualityDimension.CHARACTER_CONSISTENCY]: { avgScore: 0.5, consensus: 0.9 },
        [QualityDimension.STYLE_CONSISTENCY]: { avgScore: 0.5, consensus: 0.9 },
      },
    };

    // Build reportB with all dimensions
    const reportB = engine.buildConsensus([
      createReaction('p1', 'Alpha', {
        dimensions: { plotCoherence: 0.6, characterConsistency: 0.7, styleConsistency: 0.8, pacingTension: 0.9 },
      }),
      createReaction('p2', 'Beta', {
        dimensions: { plotCoherence: 0.55, characterConsistency: 0.65, styleConsistency: 0.75, pacingTension: 0.85 },
      }),
    ]);

    const comparison = engine.compareConsensus(reportA, reportB);

    const pacingItem = comparison.find((c) => c.dimension === QualityDimension.PACING_TENSION);
    expect(pacingItem).toBeDefined();
    expect(pacingItem!.versionAScore).toBe(0); // ?? 0 fallback
    expect(pacingItem!.versionBScore).toBeGreaterThan(0); // from reportB
    expect(pacingItem!.winner).toBe('B');
  });
});
