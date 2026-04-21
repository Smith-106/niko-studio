/**
 * Temporal Memory Tests
 *
 * Tests ValidityWindow, TemporalFact, SupersessionChain,
 * TemporalMemoryTracker, and related functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ValidityWindow,
  TemporalFact,
  SupersessionChain,
  TemporalMemoryTracker,
  getTemporalTracker,
  resetTemporalTracker,
} from '../../memory/temporal-memory';
import type { TemporalDbConnection } from '../../memory/temporal-memory';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetTemporalTracker();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  resetTemporalTracker();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// ValidityWindow
// ---------------------------------------------------------------------------

describe('ValidityWindow', () => {
  it('constructs with validFrom and validUntil', () => {
    const from = new Date('2026-01-01');
    const until = new Date('2026-12-31');
    const window = new ValidityWindow({ validFrom: from, validUntil: until });
    expect(window.validFrom).toBe(from);
    expect(window.validUntil).toBe(until);
  });

  it('constructs with null validUntil (still valid)', () => {
    const from = new Date('2026-01-01');
    const window = new ValidityWindow({ validFrom: from });
    expect(window.validUntil).toBeNull();
  });

  it('isValidAt returns true for point within window', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-06-30'),
    });
    expect(window.isValidAt(new Date('2026-04-15'))).toBe(true);
  });

  it('isValidAt returns false before window', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-06-30'),
    });
    expect(window.isValidAt(new Date('2026-01-15'))).toBe(false);
  });

  it('isValidAt returns false after window ends', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-06-30'),
    });
    // Implementation: pointInTime >= validUntil => false
    expect(window.isValidAt(new Date('2026-07-01'))).toBe(false);
  });

  it('isValidAt returns false exactly at validUntil boundary', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-06-30'),
    });
    // Implementation: pointInTime >= this.validUntil => false
    // So the validUntil moment itself is NOT valid
    expect(window.isValidAt(new Date('2026-06-30'))).toBe(false);
  });

  it('isValidAt returns true for open-ended window', () => {
    const window = new ValidityWindow({ validFrom: new Date('2020-01-01') });
    expect(window.isValidAt(new Date('2099-01-01'))).toBe(true);
  });

  it('isCurrentlyValid returns true for open current window', () => {
    const window = new ValidityWindow({ validFrom: new Date('2020-01-01') });
    expect(window.isCurrentlyValid()).toBe(true);
  });

  it('isCurrentlyValid returns false for expired window', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2020-01-01'),
      validUntil: new Date('2020-12-31'),
    });
    expect(window.isCurrentlyValid()).toBe(false);
  });

  it('duration returns milliseconds for closed window', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-01-02'),
    });
    expect(window.duration()).toBe(86400000); // 1 day in ms
  });

  it('duration returns null for open-ended window', () => {
    const window = new ValidityWindow({ validFrom: new Date('2026-01-01') });
    expect(window.duration()).toBeNull();
  });

  it('overlaps returns true for overlapping windows', () => {
    const w1 = new ValidityWindow({
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-06-30'),
    });
    const w2 = new ValidityWindow({
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-12-31'),
    });
    expect(w1.overlaps(w2)).toBe(true);
  });

  it('overlaps returns false for non-overlapping windows', () => {
    const w1 = new ValidityWindow({
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-03-01'),
    });
    const w2 = new ValidityWindow({
      validFrom: new Date('2026-06-01'),
      validUntil: new Date('2026-12-31'),
    });
    expect(w1.overlaps(w2)).toBe(false);
  });

  it('overlaps returns true when both are open-ended', () => {
    const w1 = new ValidityWindow({ validFrom: new Date('2026-01-01') });
    const w2 = new ValidityWindow({ validFrom: new Date('2026-06-01') });
    expect(w1.overlaps(w2)).toBe(true);
  });

  it('overlaps handles one open-ended window', () => {
    const w1 = new ValidityWindow({ validFrom: new Date('2026-01-01') });
    const w2 = new ValidityWindow({
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-06-01'),
    });
    expect(w1.overlaps(w2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TemporalFact
// ---------------------------------------------------------------------------

describe('TemporalFact', () => {
  it('constructs with all parameters', () => {
    const window = new ValidityWindow({
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
    });
    const fact = new TemporalFact({
      id: 'tf-1',
      content: 'Alice is alive',
      entityId: 'alice',
      validity: window,
      supersedes: 'old-tf',
      supersededBy: null,
      importance: 0.9,
      dimension: 'character',
      metadata: { source: 'user' },
    });
    expect(fact.id).toBe('tf-1');
    expect(fact.content).toBe('Alice is alive');
    expect(fact.entityId).toBe('alice');
    expect(fact.importance).toBe(0.9);
    expect(fact.dimension).toBe('character');
  });

  it('isCurrent returns true when not superseded and currently valid', () => {
    const fact = new TemporalFact({
      id: 'tf-2',
      content: 'Current fact',
      entityId: 'e1',
      validity: new ValidityWindow({ validFrom: new Date('2020-01-01') }),
    });
    expect(fact.isCurrent()).toBe(true);
  });

  it('isCurrent returns false when superseded', () => {
    const fact = new TemporalFact({
      id: 'tf-3',
      content: 'Old fact',
      entityId: 'e1',
      validity: new ValidityWindow({ validFrom: new Date('2020-01-01') }),
      supersededBy: 'newer-fact',
    });
    expect(fact.isCurrent()).toBe(false);
  });

  it('isCurrent returns false when expired', () => {
    const fact = new TemporalFact({
      id: 'tf-4',
      content: 'Expired fact',
      entityId: 'e1',
      validity: new ValidityWindow({
        validFrom: new Date('2020-01-01'),
        validUntil: new Date('2020-12-31'),
      }),
    });
    expect(fact.isCurrent()).toBe(false);
  });

  it('isValidAt delegates to ValidityWindow', () => {
    const fact = new TemporalFact({
      id: 'tf-5',
      content: 'Test',
      entityId: 'e1',
      validity: new ValidityWindow({
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
      }),
    });
    expect(fact.isValidAt(new Date('2026-06-01'))).toBe(true);
    expect(fact.isValidAt(new Date('2027-01-01'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SupersessionChain
// ---------------------------------------------------------------------------

describe('SupersessionChain', () => {
  it('constructs with facts and currentFact', () => {
    const window = new ValidityWindow({ validFrom: new Date('2026-01-01') });
    const fact = new TemporalFact({
      id: 'sc-1',
      content: 'Current',
      entityId: 'e1',
      validity: window,
    });
    const chain = new SupersessionChain({
      entityId: 'e1',
      facts: [fact],
      currentFact: fact,
    });
    expect(chain.entityId).toBe('e1');
    expect(chain.facts).toHaveLength(1);
    expect(chain.currentFact).toBe(fact);
  });

  it('getAtTime finds the latest valid fact at a point in time', () => {
    const fact1 = new TemporalFact({
      id: 'sc-2',
      content: 'V1',
      entityId: 'e1',
      validity: new ValidityWindow({
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-06-01'),
      }),
    });
    const fact2 = new TemporalFact({
      id: 'sc-3',
      content: 'V2',
      entityId: 'e1',
      validity: new ValidityWindow({
        validFrom: new Date('2026-06-01'),
        validUntil: null,
      }),
    });
    const chain = new SupersessionChain({
      entityId: 'e1',
      facts: [fact1, fact2],
    });
    expect(chain.getAtTime(new Date('2026-03-01'))).toBe(fact1);
    expect(chain.getAtTime(new Date('2026-07-01'))).toBe(fact2);
  });

  it('getAtTime returns null when no fact is valid', () => {
    const fact = new TemporalFact({
      id: 'sc-4',
      content: 'V1',
      entityId: 'e1',
      validity: new ValidityWindow({
        validFrom: new Date('2026-06-01'),
        validUntil: new Date('2026-12-31'),
      }),
    });
    const chain = new SupersessionChain({ entityId: 'e1', facts: [fact] });
    expect(chain.getAtTime(new Date('2026-01-01'))).toBeNull();
  });

  it('getHistory returns facts sorted by validFrom', () => {
    const fact2 = new TemporalFact({
      id: 'sc-5',
      content: 'Later',
      entityId: 'e1',
      validity: new ValidityWindow({ validFrom: new Date('2026-06-01') }),
    });
    const fact1 = new TemporalFact({
      id: 'sc-6',
      content: 'Earlier',
      entityId: 'e1',
      validity: new ValidityWindow({ validFrom: new Date('2026-01-01') }),
    });
    const chain = new SupersessionChain({ entityId: 'e1', facts: [fact2, fact1] });
    const history = chain.getHistory();
    expect(history[0].id).toBe('sc-6'); // Earlier first
    expect(history[1].id).toBe('sc-5'); // Later second
  });
});

// ---------------------------------------------------------------------------
// TemporalMemoryTracker
// ---------------------------------------------------------------------------

describe('TemporalMemoryTracker', () => {
  let tracker: TemporalMemoryTracker;

  beforeEach(() => {
    tracker = new TemporalMemoryTracker();
  });

  it('addFact creates a temporal fact', async () => {
    const fact = await tracker.addFact({
      content: 'Alice is alive',
      entityId: 'alice',
    });
    expect(fact.id).toBeTruthy();
    expect(fact.content).toBe('Alice is alive');
    expect(fact.entityId).toBe('alice');
    expect(fact.isCurrent()).toBe(true);
  });

  it('addFact with explicit factId', async () => {
    const fact = await tracker.addFact({
      content: 'Test',
      entityId: 'e1',
      factId: 'explicit-id',
    });
    expect(fact.id).toBe('explicit-id');
  });

  it('addFact with custom validity window', async () => {
    const fact = await tracker.addFact({
      content: 'Historical event',
      entityId: 'history',
      validFrom: new Date('2020-01-01'),
      validUntil: new Date('2020-12-31'),
    });
    expect(fact.validity.validFrom).toEqual(new Date('2020-01-01'));
    expect(fact.validity.validUntil).toEqual(new Date('2020-12-31'));
  });

  it('addFact sets supersedes and updates old fact', async () => {
    const oldFact = await tracker.addFact({
      content: 'Alice is alive',
      entityId: 'alice',
      importance: 0.8,
    });

    const newFact = await tracker.addFact({
      content: 'Alice is dead',
      entityId: 'alice',
      supersedes: oldFact.id,
    });

    expect(oldFact.supersededBy).toBe(newFact.id);
    expect(newFact.supersedes).toBe(oldFact.id);
  });

  it('getCurrentFacts returns currently valid facts', async () => {
    await tracker.addFact({ content: 'Current fact 1', entityId: 'e1', importance: 0.9 });
    await tracker.addFact({ content: 'Current fact 2', entityId: 'e1', importance: 0.7 });

    const facts = await tracker.getCurrentFacts('e1');
    expect(facts).toHaveLength(2);
    expect(facts[0].importance).toBeGreaterThanOrEqual(facts[1].importance);
  });

  it('getCurrentFacts excludes superseded facts', async () => {
    const old = await tracker.addFact({ content: 'Old', entityId: 'e2' });
    await tracker.addFact({ content: 'New', entityId: 'e2', supersedes: old.id });

    const facts = await tracker.getCurrentFacts('e2');
    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe('New');
  });

  it('getCurrentFacts returns empty for unknown entity', async () => {
    const facts = await tracker.getCurrentFacts('nonexistent');
    expect(facts).toEqual([]);
  });

  it('getFactsAt returns facts valid at a specific time', async () => {
    await tracker.addFact({
      content: 'Fact in 2020',
      entityId: 'e3',
      validFrom: new Date('2020-01-01'),
      validUntil: new Date('2020-12-31'),
      importance: 0.5,
    });
    await tracker.addFact({
      content: 'Fact in 2026',
      entityId: 'e3',
      validFrom: new Date('2026-01-01'),
      validUntil: null,
      importance: 0.9,
    });

    const facts2020 = await tracker.getFactsAt('e3', new Date('2020-06-01'));
    expect(facts2020).toHaveLength(1);
    expect(facts2020[0].content).toBe('Fact in 2020');
  });

  it('supersede creates new fact and marks old', async () => {
    const oldFact = await tracker.addFact({
      content: 'Original state',
      entityId: 'e4',
      importance: 0.7,
    });

    const newFact = await tracker.supersede(oldFact.id, 'Updated state');
    expect(newFact.content).toBe('Updated state');
    expect(newFact.supersedes).toBe(oldFact.id);
    expect(oldFact.supersededBy).toBe(newFact.id);
  });

  it('supersede throws for non-existent fact', async () => {
    await expect(tracker.supersede('nonexistent', 'New content')).rejects.toThrow('Fact not found');
  });

  it('getChain returns full supersession chain', async () => {
    const f1 = await tracker.addFact({ content: 'V1', entityId: 'chain-e' });
    const f2 = await tracker.supersede(f1.id, 'V2');
    const f3 = await tracker.supersede(f2.id, 'V3');

    const chain = await tracker.getChain('chain-e');
    expect(chain.entityId).toBe('chain-e');
    expect(chain.facts).toHaveLength(3);
    expect(chain.currentFact!.content).toBe('V3');
  });

  it('getHistory returns facts within time range', async () => {
    await tracker.addFact({
      content: 'Early',
      entityId: 'hist-e',
      validFrom: new Date('2020-01-01'),
    });
    await tracker.addFact({
      content: 'Mid',
      entityId: 'hist-e',
      validFrom: new Date('2023-01-01'),
    });
    await tracker.addFact({
      content: 'Late',
      entityId: 'hist-e',
      validFrom: new Date('2026-01-01'),
    });

    const history = await tracker.getHistory(
      'hist-e',
      new Date('2023-01-01'),
      new Date('2026-06-01'),
    );
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Mid');
    expect(history[1].content).toBe('Late');
  });

  it('expireFact sets validUntil', async () => {
    const fact = await tracker.addFact({ content: 'To expire', entityId: 'exp-e' });
    const result = await tracker.expireFact(fact.id);
    expect(result).toBe(true);
    expect(fact.validity.validUntil).not.toBeNull();
    expect(fact.isCurrent()).toBe(false);
  });

  it('expireFact returns false for non-existent fact', async () => {
    expect(await tracker.expireFact('nonexistent')).toBe(false);
  });

  it('deleteFact removes fact and repairs chain', async () => {
    const f1 = await tracker.addFact({ content: 'First', entityId: 'del-e' });
    const f2 = await tracker.supersede(f1.id, 'Second');
    const f3 = await tracker.supersede(f2.id, 'Third');

    await tracker.deleteFact(f2.id);

    // f1 should now point to f3, f3 should point to f1
    expect(f1.supersededBy).toBe(f3.id);
    expect(f3.supersedes).toBe(f1.id);

    // getChain should have 2 facts
    const chain = await tracker.getChain('del-e');
    expect(chain.facts).toHaveLength(2);
  });

  it('deleteFact returns false for non-existent fact', async () => {
    expect(await tracker.deleteFact('nonexistent')).toBe(false);
  });

  it('queryTemporal filters by entity and dimension', async () => {
    await tracker.addFact({
      content: 'Character fact',
      entityId: 'q-e',
      dimension: 'character',
      importance: 0.9,
    });
    await tracker.addFact({
      content: 'Timeline fact',
      entityId: 'q-e',
      dimension: 'timeline',
      importance: 0.7,
    });

    const charFacts = await tracker.queryTemporal({
      entityId: 'q-e',
      dimension: 'character',
    });
    expect(charFacts).toHaveLength(1);
    expect(charFacts[0].content).toBe('Character fact');
  });

  it('queryTemporal filters by validAt', async () => {
    await tracker.addFact({
      content: 'Past event',
      entityId: 'q-e2',
      validFrom: new Date('2020-01-01'),
      validUntil: new Date('2020-12-31'),
    });
    await tracker.addFact({
      content: 'Current event',
      entityId: 'q-e2',
      validFrom: new Date('2020-01-01'),
      validUntil: null,
    });

    const pastFacts = await tracker.queryTemporal({
      entityId: 'q-e2',
      validAt: new Date('2020-06-01'),
    });
    expect(pastFacts.length).toBeGreaterThanOrEqual(1);
  });

  it('queryTemporal includes superseded when flag is set', async () => {
    const old = await tracker.addFact({ content: 'Old', entityId: 'q-e3' });
    await tracker.supersede(old.id, 'New');

    const withoutSuperseded = await tracker.queryTemporal({
      entityId: 'q-e3',
      includeSuperseded: false,
    });
    expect(withoutSuperseded).toHaveLength(1);

    const withSuperseded = await tracker.queryTemporal({
      entityId: 'q-e3',
      includeSuperseded: true,
    });
    expect(withSuperseded).toHaveLength(2);
  });

  it('queryTemporal respects limit', async () => {
    for (let i = 0; i < 10; i++) {
      await tracker.addFact({ content: `Fact ${i}`, entityId: 'q-e4', importance: 0.5 });
    }
    const results = await tracker.queryTemporal({ entityId: 'q-e4', limit: 3 });
    expect(results).toHaveLength(3);
  });

  it('stats returns correct counts', async () => {
    await tracker.addFact({ content: 'Active', entityId: 's-e' });
    const old = await tracker.addFact({ content: 'Superseded', entityId: 's-e' });
    await tracker.supersede(old.id, 'Replacement');
    await tracker.expireFact(old.id);

    const stats = tracker.stats();
    expect(stats.total_facts).toBe(3);
    // Both 'Active' and 'Replacement' are current (not superseded, currently valid)
    expect(stats.current_facts).toBe(2);
    expect(stats.superseded_facts).toBe(1);
    // 'Superseded' is both superseded and expired
    expect(stats.expired_facts).toBeGreaterThanOrEqual(1);
    expect(stats.entities_tracked).toBe(1);
  });

  it('persists to database when connection is set', async () => {
    const mockDb: TemporalDbConnection = {
      execute: vi.fn(),
      commit: vi.fn(),
    };
    tracker.setDbConnection(mockDb);

    await tracker.addFact({ content: 'Persisted', entityId: 'db-e' });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(mockDb.commit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('singleton functions', () => {
  it('getTemporalTracker returns same instance', () => {
    const t1 = getTemporalTracker();
    const t2 = getTemporalTracker();
    expect(t1).toBe(t2);
  });

  it('resetTemporalTracker creates new instance', () => {
    const t1 = getTemporalTracker();
    resetTemporalTracker();
    const t2 = getTemporalTracker();
    expect(t1).not.toBe(t2);
  });
});
