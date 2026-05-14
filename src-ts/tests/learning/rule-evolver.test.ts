import { describe, expect, it } from 'vitest';

import { RuleEvolver } from '../../learning/rule-evolver';
import type { FeedbackEvidence, StyleFeatureVector } from '../../learning/learning-types';

function makeEvidence(dimension: string, action: FeedbackEvidence['action'], value: number): FeedbackEvidence {
  return { dimension, action, value, timestamp: new Date().toISOString(), source: 'test' };
}

describe('RuleEvolver', () => {
  it('does not create rule below threshold', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 3 });
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.8));
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.7));
    expect(evolver.getActiveRules().length).toBe(0);
  });

  it('creates rule at threshold with majority accept', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 3 });
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.7));
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.8));
    evolver.addEvidence(makeEvidence('dim-a', 'reject', 0.2));

    const rules = evolver.getActiveRules();
    expect(rules.length).toBe(1);
    expect(rules[0].dimensions['dim-a']).toBeCloseTo(0.75, 1);
    expect(rules[0].version).toBe(1);
  });

  it('deactivates rule when reject reaches threshold', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2 });
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.8));
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.7));
    expect(evolver.getActiveRules().length).toBe(1);

    evolver.addEvidence(makeEvidence('dim-a', 'reject', 0.1));
    evolver.addEvidence(makeEvidence('dim-a', 'reject', 0.2));
    expect(evolver.getActiveRules().length).toBe(0);
  });

  it('updates existing rule with new evidence', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2 });
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.6));
    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.7));
    expect(evolver.getActiveRules()[0].version).toBe(1);

    evolver.addEvidence(makeEvidence('dim-a', 'accept', 0.8));
    expect(evolver.getActiveRules()[0].version).toBe(2);
  });

  it('detects no drift with no active rules', () => {
    const evolver = new RuleEvolver();
    const vector: StyleFeatureVector = { dimensions: { x: 0.5 } };
    const report = evolver.detectDrift(vector);
    expect(report.severity).toBe('none');
    expect(report.overallDrift).toBe(0);
  });

  it('detects high drift when actual deviates from rule', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.3 });
    evolver.addEvidence(makeEvidence('x', 'accept', 0.8));
    evolver.addEvidence(makeEvidence('x', 'accept', 0.8));

    const report = evolver.detectDrift({ dimensions: { x: 0.1 } });
    expect(report.severity).toBe('high');
    expect(report.suggestions.length).toBeGreaterThan(0);
  });

  it('reports low drift for small deviations', () => {
    const evolver = new RuleEvolver({ evidenceThreshold: 2, driftThreshold: 0.3 });
    evolver.addEvidence(makeEvidence('x', 'accept', 0.5));
    evolver.addEvidence(makeEvidence('x', 'accept', 0.5));

    const report = evolver.detectDrift({ dimensions: { x: 0.55 } });
    expect(report.severity).toBe('none');
  });

  it('tracks evidence count', () => {
    const evolver = new RuleEvolver();
    evolver.addEvidence(makeEvidence('a', 'accept', 0.5));
    evolver.addEvidence(makeEvidence('b', 'reject', 0.2));
    expect(evolver.getEvidenceCount()).toBe(2);
  });
});
