import { describe, expect, it } from 'vitest';

import { PreferenceTracker } from '../../learning/preference-tracker';
import type { PreferenceSignal } from '../../learning/learning-types';

describe('PreferenceTracker', () => {
  it('records and counts signals', () => {
    const tracker = new PreferenceTracker();
    tracker.addSignal({
      userId: 'u1',
      action: 'accept',
      dimension: 'vocabulary_richness',
      value: 0.8,
      timestamp: new Date().toISOString(),
      context: 'test',
    });
    expect(tracker.getSignalCount()).toBe(1);
  });

  it('filters signals by dimension', () => {
    const tracker = new PreferenceTracker();
    tracker.addSignal({ userId: 'u1', action: 'accept', dimension: 'a', value: 0.5, timestamp: '', context: '' });
    tracker.addSignal({ userId: 'u1', action: 'reject', dimension: 'b', value: 0.3, timestamp: '', context: '' });
    tracker.addSignal({ userId: 'u1', action: 'accept', dimension: 'a', value: 0.7, timestamp: '', context: '' });

    expect(tracker.getSignalsForDimension('a').length).toBe(2);
    expect(tracker.getSignalsForDimension('b').length).toBe(1);
    expect(tracker.getSignalsForDimension('c').length).toBe(0);
  });

  it('computes preference profile', () => {
    const tracker = new PreferenceTracker();
    tracker.addSignal({ userId: 'u1', action: 'accept', dimension: 'x', value: 0.8, timestamp: '', context: '' });
    tracker.addSignal({ userId: 'u1', action: 'accept', dimension: 'x', value: 0.6, timestamp: '', context: '' });
    tracker.addSignal({ userId: 'u1', action: 'reject', dimension: 'x', value: 0.2, timestamp: '', context: '' });

    const profile = tracker.getPreferenceProfile();
    expect(profile.x.accept).toBe(2);
    expect(profile.x.reject).toBe(1);
    expect(profile.x.avgValue).toBeCloseTo((0.8 + 0.6 + 0.2) / 3, 4);
  });

  it('trims signals beyond maxSignals', () => {
    const tracker = new PreferenceTracker({ maxSignals: 5 });
    for (let i = 0; i < 10; i++) {
      tracker.addSignal({
        userId: 'u1', action: 'accept', dimension: 'd', value: i,
        timestamp: '', context: '',
      });
    }
    expect(tracker.getSignalCount()).toBe(5);
    const recent = tracker.getRecentSignals(5);
    expect(recent[0].value).toBe(5);
  });

  it('clears all signals', () => {
    const tracker = new PreferenceTracker();
    tracker.addSignal({ userId: 'u1', action: 'accept', dimension: 'a', value: 0.5, timestamp: '', context: '' });
    tracker.clear();
    expect(tracker.getSignalCount()).toBe(0);
  });

  it('returns recent signals with limit', () => {
    const tracker = new PreferenceTracker();
    for (let i = 0; i < 50; i++) {
      tracker.addSignal({ userId: 'u1', action: 'accept', dimension: 'a', value: i, timestamp: '', context: '' });
    }
    const recent = tracker.getRecentSignals(10);
    expect(recent.length).toBe(10);
    expect(recent[9].value).toBe(49);
  });
});
