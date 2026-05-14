/**
 * Rule Evolver — CAP-002 component
 *
 * Accumulates feedback evidence and evolves style rules when evidence
 * reaches the configured threshold (default: 3).
 */

import type {
  StyleFeatureVector,
  StyleRule,
  FeedbackEvidence,
  StyleDriftReport,
} from './learning-types';

export class RuleEvolver {
  private rules = new Map<string, StyleRule>();
  private evidence: FeedbackEvidence[] = [];
  private latestDrift: StyleDriftReport | null = null;
  private readonly threshold: number;
  private readonly driftThreshold: number;

  constructor(config?: { evidenceThreshold?: number; driftThreshold?: number }) {
    this.threshold = config?.evidenceThreshold ?? 3;
    this.driftThreshold = config?.driftThreshold ?? 0.3;
  }

  addEvidence(evidence: FeedbackEvidence): void {
    this.evidence.push(evidence);
    this.tryEvolveRule(evidence.dimension);
  }

  private tryEvolveRule(dimension: string): void {
    const relevantEvidence = this.evidence.filter(e => e.dimension === dimension);
    if (relevantEvidence.length < this.threshold) return;

    // Compute consensus value from evidence
    const acceptEvidence = relevantEvidence.filter(e => e.action === 'accept');
    const rejectEvidence = relevantEvidence.filter(e => e.action === 'reject');

    if (acceptEvidence.length > rejectEvidence.length) {
      const avgValue = acceptEvidence.reduce((s, e) => s + e.value, 0) / acceptEvidence.length;
      this.upsertRule(dimension, avgValue, relevantEvidence.length);
    } else if (rejectEvidence.length >= this.threshold) {
      this.deactivateRule(dimension);
    }
  }

  private upsertRule(dimension: string, value: number, evidenceCount: number): void {
    const existing = this.rules.get(dimension);
    const now = new Date().toISOString();

    if (existing) {
      existing.dimensions[dimension] = value;
      existing.evidenceCount = evidenceCount;
      existing.version++;
      existing.updatedAt = now;
    } else {
      this.rules.set(dimension, {
        id: `rule-${dimension}-${Date.now()}`,
        name: `Style rule: ${dimension}`,
        description: `Evolved from ${evidenceCount} evidence items`,
        dimensions: { [dimension]: value },
        evidenceCount,
        version: 1,
        createdAt: now,
        updatedAt: now,
        active: true,
      });
    }
  }

  private deactivateRule(dimension: string): void {
    const rule = this.rules.get(dimension);
    if (rule) {
      rule.active = false;
      rule.updatedAt = new Date().toISOString();
    }
  }

  detectDrift(current: StyleFeatureVector): StyleDriftReport {
    const activeRules = [...this.rules.values()].filter(r => r.active);
    if (activeRules.length === 0) {
      const report: StyleDriftReport = {
        baselineDate: new Date().toISOString(),
        currentDate: new Date().toISOString(),
        overallDrift: 0,
        dimensionDrifts: {},
        severity: 'none',
        suggestions: [],
      };
      this.latestDrift = report;
      return report;
    }

    const dimensionDrifts: Record<string, number> = {};
    let totalDrift = 0;

    for (const rule of activeRules) {
      for (const [dim, expected] of Object.entries(rule.dimensions)) {
        const actual = current.dimensions[dim] ?? 0;
        const drift = Math.abs(actual - expected);
        dimensionDrifts[dim] = drift;
        totalDrift += drift;
      }
    }

    const overallDrift = totalDrift / activeRules.length;
    let severity: StyleDriftReport['severity'];
    if (overallDrift < 0.1) severity = 'none';
    else if (overallDrift < 0.2) severity = 'low';
    else if (overallDrift < this.driftThreshold) severity = 'medium';
    else severity = 'high';

    const suggestions: string[] = [];
    for (const [dim, drift] of Object.entries(dimensionDrifts)) {
      if (drift > this.driftThreshold) {
        const expected = activeRules.find(r => dim in r.dimensions)?.dimensions[dim] ?? 0;
        const actual = current.dimensions[dim] ?? 0;
        const direction = actual > expected ? 'higher' : 'lower';
        suggestions.push(`${dim} drifted ${direction} than expected (drift: ${drift.toFixed(3)})`);
      }
    }

    const report: StyleDriftReport = {
      baselineDate: activeRules[0].createdAt,
      currentDate: new Date().toISOString(),
      overallDrift,
      dimensionDrifts,
      severity,
      suggestions,
    };
    this.latestDrift = report;
    return report;
  }

  getActiveRules(): StyleRule[] {
    return [...this.rules.values()].filter(r => r.active);
  }

  getEvidenceCount(): number {
    return this.evidence.length;
  }

  getLatestDriftReport(): StyleDriftReport | null {
    return this.latestDrift;
  }
}
