import { describe, expect, it } from 'vitest';

import { ForeshadowTracker } from '../../services/foreshadow-tracker.js';

describe('services/foreshadow-tracker additional coverage', () => {
  it('returns only unresolved and unexpired records from getPending', () => {
    const tracker = new ForeshadowTracker();

    tracker.plant('pending-planted', 'char-1', 'silent bell', 1, 20, 5);
    tracker.plant('pending-due', 'char-2', 'broken seal', 2, 10, 3);
    tracker.plant('resolved', 'char-3', 'revealed code', 1, 20, 5);
    tracker.plant('expired', 'char-4', 'missed omen', 1, 2, 1);

    tracker.getAlerts(9);
    tracker.resolve('resolved', 6, 'The code is decoded.');
    tracker.markExpired(5);

    expect(tracker.getPending().map((item) => item.id)).toEqual([
      'pending-planted',
      'pending-due',
    ]);
  });

  it('returns false when resolving an unknown foreshadow id', () => {
    const tracker = new ForeshadowTracker();

    expect(tracker.resolve('missing-id', 3, 'nothing happens')).toBe(false);
  });
});
