import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SupersessionChain,
  TemporalFact,
  TemporalMemoryTracker,
  ValidityWindow,
  getTemporalTracker,
  resetTemporalTracker,
} from '../../memory/temporal-memory';
import type { TemporalDbConnection } from '../../memory/temporal-memory';

beforeEach(() => {
  resetTemporalTracker();
  vi.restoreAllMocks();
});

afterEach(() => {
  resetTemporalTracker();
  vi.restoreAllMocks();
});

function createFact(id: string, validFrom: string, validUntil?: string | null): TemporalFact {
  return new TemporalFact({
    id,
    content: id,
    entityId: 'entity',
    validity: new ValidityWindow({
      validFrom: new Date(validFrom),
      validUntil: validUntil ? new Date(validUntil) : validUntil ?? null,
    }),
  });
}

describe('temporal-memory additional coverage', () => {
  it('handles overlap checks when only the other window is open-ended', () => {
    const closed = new ValidityWindow({
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(
      closed.overlaps(
        new ValidityWindow({
          validFrom: new Date('2026-03-01T00:00:00.000Z'),
          validUntil: null,
        }),
      ),
    ).toBe(true);

    expect(
      closed.overlaps(
        new ValidityWindow({
          validFrom: new Date('2026-07-01T00:00:00.000Z'),
          validUntil: null,
        }),
      ),
    ).toBe(false);
  });

  it('skips superseded facts in point-in-time queries once the successor becomes active', async () => {
    const tracker = new TemporalMemoryTracker();
    const oldFact = await tracker.addFact({
      content: 'Old version',
      entityId: 'hero',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      importance: 0.2,
    });
    const newFact = await tracker.addFact({
      content: 'New version',
      entityId: 'hero',
      validFrom: new Date('2026-06-01T00:00:00.000Z'),
      supersedes: oldFact.id,
      importance: 0.9,
    });

    oldFact.validity.validUntil = null;

    const facts = await tracker.getFactsAt('hero', new Date('2026-07-01T00:00:00.000Z'));

    expect(facts).toEqual([newFact]);
  });

  it('updates validity in the database when expiring a fact', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker(db);
    const fact = await tracker.addFact({ content: 'Expire me', entityId: 'expire-db' });

    vi.mocked(db.execute).mockClear();
    vi.mocked(db.commit).mockClear();

    const validUntil = new Date('2026-12-31T00:00:00.000Z');
    await expect(tracker.expireFact(fact.id, validUntil)).resolves.toBe(true);

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(db.execute).mock.calls[0]?.[0])).toContain('UPDATE memories');
    expect(db.commit).toHaveBeenCalledTimes(1);
  });

  it('swallows update failures during expiration and still returns success', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(() => {
        throw new Error('update failed');
      }),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker();
    tracker.setDbConnection(db);
    const fact = await tracker.addFact({ content: 'Fail softly', entityId: 'expire-soft' });

    await expect(tracker.expireFact(fact.id)).resolves.toBe(true);
    expect(db.commit).not.toHaveBeenCalled();
  });

  it('deletes persisted facts through the database layer', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker(db);
    const fact = await tracker.addFact({ content: 'Delete me', entityId: 'delete-db' });

    vi.mocked(db.execute).mockClear();
    vi.mocked(db.commit).mockClear();

    await expect(tracker.deleteFact(fact.id)).resolves.toBe(true);

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(db.execute).mock.calls[0]?.[0])).toContain('DELETE FROM memories');
    expect(db.commit).toHaveBeenCalledTimes(1);
  });

  it('swallows delete failures after removing the fact from in-memory indexes', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(() => {
        throw new Error('delete failed');
      }),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker();
    tracker.setDbConnection(db);
    const fact = await tracker.addFact({ content: 'Delete softly', entityId: 'delete-soft' });

    await expect(tracker.deleteFact(fact.id)).resolves.toBe(true);
    await expect(tracker.getCurrentFacts('delete-soft')).resolves.toEqual([]);
    expect(db.commit).not.toHaveBeenCalled();
  });

  it('filters queryTemporal results before sorting by importance', async () => {
    const tracker = new TemporalMemoryTracker();
    await tracker.addFact({
      content: 'Wrong entity',
      entityId: 'other-entity',
      dimension: 'character',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      importance: 0.99,
    });
    await tracker.addFact({
      content: 'Wrong dimension',
      entityId: 'target-entity',
      dimension: 'timeline',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      importance: 0.95,
    });
    await tracker.addFact({
      content: 'Expired before target time',
      entityId: 'target-entity',
      dimension: 'character',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: new Date('2026-03-01T00:00:00.000Z'),
      importance: 0.9,
    });
    const superseded = await tracker.addFact({
      content: 'Superseded but still valid',
      entityId: 'target-entity',
      dimension: 'character',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      importance: 0.1,
    });
    const current = await tracker.addFact({
      content: 'Current replacement',
      entityId: 'target-entity',
      dimension: 'character',
      validFrom: new Date('2026-04-01T00:00:00.000Z'),
      supersedes: superseded.id,
      importance: 0.85,
    });
    superseded.validity.validUntil = null;

    const higher = await tracker.addFact({
      content: 'Higher priority',
      entityId: 'target-entity',
      dimension: 'character',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      importance: 0.9,
    });
    const lower = await tracker.addFact({
      content: 'Lower priority',
      entityId: 'target-entity',
      dimension: 'character',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      importance: 0.4,
    });

    const results = await tracker.queryTemporal({
      entityId: 'target-entity',
      dimension: 'character',
      validAt: new Date('2026-07-01T00:00:00.000Z'),
      includeSuperseded: false,
      limit: 10,
    });

    expect(results).toEqual([higher, current, lower]);
  });

  it('returns early from private db helpers when no connection is available', async () => {
    const tracker = new TemporalMemoryTracker();
    const fact = createFact('private-no-db', '2026-01-01T00:00:00.000Z');

    await expect((tracker as any)._persistFact(fact)).resolves.toBeUndefined();
    await expect(
      (tracker as any)._updateValidity(
        'private-no-db',
        new ValidityWindow({ validFrom: new Date('2026-01-01T00:00:00.000Z') }),
      ),
    ).resolves.toBeUndefined();
    await expect((tracker as any)._deleteFromDb('private-no-db')).resolves.toBeUndefined();
  });

  it('swallows persistence failures during fact creation', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(() => {
        throw new Error('persist failed');
      }),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker(db);

    const fact = await tracker.addFact({ content: 'Persist softly', entityId: 'persist-soft' });

    expect(fact.content).toBe('Persist softly');
    expect(db.commit).not.toHaveBeenCalled();
  });

  it('attaches a provided db connection to an existing singleton tracker', () => {
    const first = getTemporalTracker();
    const db: TemporalDbConnection = {
      execute: vi.fn(),
      commit: vi.fn(),
    };

    const second = getTemporalTracker(db);

    expect(second).toBe(first);
    expect(second.db).toBe(db);
  });
});
