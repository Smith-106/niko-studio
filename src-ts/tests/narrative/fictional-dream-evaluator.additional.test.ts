import { describe, expect, it, vi } from 'vitest';

import { DreamEvaluator } from '../../narrative/fictional_dream/evaluator';
import { DreamStrength, type FictionalDreamResult } from '../../narrative/fictional_dream/engine';

function createResult(
  overrides: Partial<FictionalDreamResult> = {},
): FictionalDreamResult {
  return {
    overallScore: 42,
    dreamStrength: DreamStrength.WEAK,
    sympathy: {
      overallScore: 42,
      triggersDetected: [],
      vulnerabilityDisplay: 0.2,
      universalPredicament: false,
      suggestions: [],
    } as never,
    identification: {
      overallScore: 42,
      goalClarity: 0.2,
      goalWorthiness: 0.2,
      godfatherTechnique: { isDetected: false },
      suggestions: [],
    } as never,
    empathy: {
      overallScore: 42,
      sensoryDetails: [],
      bodyPlantScore: 0.2,
      carrieTechnique: { isDetected: false },
      suggestions: [],
    } as never,
    immersion: {
      overallScore: 42,
      internalConflicts: [],
      readerParticipation: 0.2,
      choiceUrgency: 0.2,
      suggestions: [],
    } as never,
    layerScores: [],
    masterSuggestions: [],
    dreamBreakers: [],
    ...overrides,
  };
}

describe('narrative/fictional_dream/evaluator additional coverage', () => {
  it('reports all quick issues and quick wins when every layer score is low', async () => {
    const evaluator = new DreamEvaluator();
    vi.spyOn((evaluator as never).engine, 'quickEvaluate').mockResolvedValue({
      sympathy: 10,
      identification: 20,
      empathy: 30,
      immersion: 35,
    });

    const report = await evaluator.quickScan('low-score content');

    expect(report.top3Issues).toHaveLength(3);
    expect(report.quickWins).toHaveLength(3);
    expect(report.weakestLayer).toBe('sympathy');
    expect(report.strength).toBe(DreamStrength.BROKEN);
  });

  it('covers high-threshold strength and health labels', () => {
    const evaluator = new DreamEvaluator() as unknown as {
      determineStrength: (score: number) => string;
      assessHealth: (result: FictionalDreamResult) => string;
    };

    expect(evaluator.determineStrength(95)).toBe(DreamStrength.HYPNOTIC);
    expect(evaluator.determineStrength(80)).toBe(DreamStrength.STRONG);
    expect(evaluator.determineStrength(65)).toBe(DreamStrength.MODERATE);
    expect(evaluator.determineStrength(45)).toBe(DreamStrength.WEAK);

    expect(evaluator.assessHealth(createResult({ dreamStrength: DreamStrength.HYPNOTIC }))).toContain('优秀');
    expect(evaluator.assessHealth(createResult({ dreamStrength: DreamStrength.STRONG }))).toContain('良好');
    expect(evaluator.assessHealth(createResult({ dreamStrength: DreamStrength.MODERATE }))).toContain('一般');
  });

  it('creates low-priority improvement items and medium-effort fallbacks for near-target layers', () => {
    const evaluator = new DreamEvaluator() as unknown as {
      createImprovementPlan: (result: FictionalDreamResult) => Array<Record<string, unknown>>;
    };

    const plan = evaluator.createImprovementPlan(createResult({
      layerScores: [
        {
          layerName: 'Identification',
          score: 65,
          isEffective: true,
          keyFindings: [],
          suggestions: ['clarify goal', 'raise stakes', 'trim abstraction'],
        },
        {
          layerName: 'Immersion',
          score: 75,
          isEffective: true,
          keyFindings: [],
          suggestions: ['tighten dilemma', 'raise urgency', 'trim exposition'],
        },
        {
          layerName: 'Empathy',
          score: 82,
          isEffective: true,
          keyFindings: [],
          suggestions: ['already good'],
        },
      ],
    }));

    expect(plan).toEqual([
      {
        priority: 2,
        layer: 'Identification',
        currentScore: 65,
        targetScore: 80,
        actions: ['clarify goal', 'raise stakes'],
        estimatedEffort: 'MEDIUM',
      },
      {
        priority: 3,
        layer: 'Immersion',
        currentScore: 75,
        targetScore: 80,
        actions: ['tighten dilemma', 'raise urgency'],
        estimatedEffort: 'MEDIUM',
      },
    ]);
  });

  it('marks strong layers as low priority in layer diagnosis', () => {
    const evaluator = new DreamEvaluator() as unknown as {
      diagnoseLayers: (result: FictionalDreamResult) => Array<Record<string, unknown>>;
    };

    const diagnosis = evaluator.diagnoseLayers(
      createResult({
        layerScores: [
          {
            layerName: 'Immersion',
            score: 78,
            isEffective: true,
            keyFindings: ['reader remains inside the character perspective'],
            suggestions: [],
          },
        ],
      }),
    );

    expect(diagnosis).toEqual([
      {
        layer: 'Immersion',
        status: 'PASS',
        score: 78,
        keyFindings: ['reader remains inside the character perspective'],
        priority: 'LOW',
      },
    ]);
  });
});
