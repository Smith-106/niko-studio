import { afterEach, describe, expect, it, vi } from 'vitest';

import { RuleEvolver } from '../../learning/rule-evolver';
import type { FeedbackEvidence, StyleFeatureVector } from '../../learning/learning-types';

function makeEvidence(dimension: string, action: FeedbackEvidence['action'], value: number): FeedbackEvidence {
  return { dimension, action, value, timestamp: new Date().toISOString(), source: 'test' };
}

describe('learning/rule-evolver branch gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats missing current dimensions as zero and reports low drift', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.4 });
    evolver.addEvidence(makeEvidence('x', 'accept', 0.1));
    evolver.addEvidence(makeEvidence('x', 'accept', 0.1));

    const report = evolver.detectDrift({ dimensions: {} } as StyleFeatureVector);

    expect(report.overallDrift).toBeCloseTo(0.1, 6);
    expect(report.severity).toBe('low');
    expect(report.suggestions).toEqual([]);
  });

  it('reports medium drift when deviation stays below the configured high threshold', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.5 });
    evolver.addEvidence(makeEvidence('x', 'accept', 0.9));
    evolver.addEvidence(makeEvidence('x', 'accept', 0.9));

    const report = evolver.detectDrift({
      dimensions: { x: 0.55 },
    } as StyleFeatureVector);

    expect(report.overallDrift).toBeCloseTo(0.35, 6);
    expect(report.severity).toBe('medium');
    expect(report.suggestions).toEqual([]);
  });

  it('falls back to zero for missing actual values and labels the drift as lower', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.05 });
    evolver.addEvidence(makeEvidence('x', 'accept', 0.3));
    evolver.addEvidence(makeEvidence('x', 'accept', 0.3));

    const report = evolver.detectDrift({ dimensions: {} } as StyleFeatureVector);

    expect(report.severity).toBe('high');
    expect(report.suggestions).toEqual([
      'x drifted lower than expected (drift: 0.300)',
    ]);
  });

  it('falls back to zero expected values when the rule lookup cannot find a matching dimension', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.1 });
    evolver.addEvidence(makeEvidence('x', 'accept', 0.1));
    evolver.addEvidence(makeEvidence('x', 'accept', 0.1));

    const originalFind = Array.prototype.find;
    const findSpy = vi.spyOn(Array.prototype, 'find').mockImplementation(function (
      this: unknown[],
      predicate: (value: unknown, index: number, obj: unknown[]) => boolean,
      thisArg?: unknown,
    ) {
      if (
        this.length > 0 &&
        typeof this[0] === 'object' &&
        this[0] !== null &&
        'dimensions' in (this[0] as Record<string, unknown>)
      ) {
        return undefined;
      }
      return originalFind.call(this, predicate as never, thisArg as never);
    });

    try {
      const report = evolver.detectDrift({
        dimensions: { x: 0.9 },
      } as StyleFeatureVector);

      expect(report.severity).toBe('high');
      expect(report.suggestions).toEqual([
        'x drifted higher than expected (drift: 0.800)',
      ]);
    } finally {
      findSpy.mockRestore();
    }
  });
});
