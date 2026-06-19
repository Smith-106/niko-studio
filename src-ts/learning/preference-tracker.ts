/**
 * Preference Tracker — CAP-002 component
 *
 * Records user preference signals (accept/reject/modify) per style dimension.
 * Provides aggregated preference profiles for the rule evolver.
 */

import type { PreferenceSignal, FeedbackEvidence } from './learning-types';

export class PreferenceTracker {
  private signals: PreferenceSignal[] = [];
  private readonly maxSignals: number;

  constructor(config?: { maxSignals?: number }) {
    this.maxSignals = config?.maxSignals ?? 10000;
  }

  recordFeedback(evidence: FeedbackEvidence): void {
    const signal: PreferenceSignal = {
      userId: 'default',
      action: evidence.action,
      dimension: evidence.dimension,
      value: evidence.value,
      timestamp: evidence.timestamp,
      context: evidence.source,
    };
    this.addSignal(signal);
  }

  addSignal(signal: PreferenceSignal): void {
    this.signals.push(signal);
    if (this.signals.length > this.maxSignals) {
      this.signals = this.signals.slice(-this.maxSignals);
    }
  }

  getSignalsForDimension(dimension: string): PreferenceSignal[] {
    return this.signals.filter(s => s.dimension === dimension);
  }

  getPreferenceProfile(): Record<string, { accept: number; reject: number; modify: number; avgValue: number }> {
    const profile: Record<string, { accept: number; reject: number; modify: number; total: number; sum: number }> = {};

    for (const signal of this.signals) {
      if (!profile[signal.dimension]) {
        profile[signal.dimension] = { accept: 0, reject: 0, modify: 0, total: 0, sum: 0 };
      }
      const entry = profile[signal.dimension];
      entry[signal.action]++;
      entry.total++;
      entry.sum += signal.value;
    }

    const result: Record<string, { accept: number; reject: number; modify: number; avgValue: number }> = {};
    for (const [dim, entry] of Object.entries(profile)) {
      result[dim] = {
        accept: entry.accept,
        reject: entry.reject,
        modify: entry.modify,
        avgValue: entry.sum / entry.total,
      };
    }
    return result;
  }

  getRecentSignals(limit: number = 100): PreferenceSignal[] {
    return this.signals.slice(-limit);
  }

  clear(): void {
    this.signals = [];
  }

  getSignalCount(): number {
    return this.signals.length;
  }
}
