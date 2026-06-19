import { describe, expect, it, vi } from 'vitest';

import {
  TemporalMemoryTracker,
  ValidityWindow,
  type TemporalDbConnection,
} from '../../memory/temporal-memory';

describe('temporal-memory branch-gap coverage', () => {
  it('returns empty fact and chain results for unknown entities', async () => {
    const tracker = new TemporalMemoryTracker();

    await expect(
      tracker.getFactsAt('missing-entity', new Date('2026-07-01T00:00:00.000Z')),
    ).resolves.toEqual([]);

    const chain = await tracker.getChain('missing-entity');
    expect(chain.facts).toEqual([]);
    expect(chain.currentFact).toBeNull();
  });

  it('persists and updates open-ended validity windows with null db values', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker(db);

    const fact = await tracker.addFact({
      content: 'Open-ended fact',
      entityId: 'entity-open',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(vi.mocked(db.execute).mock.calls[0]?.[1]?.[4]).toBeNull();
    expect(db.commit).toHaveBeenCalledTimes(1);

    vi.mocked(db.execute).mockClear();
    vi.mocked(db.commit).mockClear();

    await (tracker as unknown as {
      _updateValidity: (factId: string, validity: ValidityWindow) => Promise<void>;
    })._updateValidity(
      fact.id,
      new ValidityWindow({
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: null,
      }),
    );

    expect(vi.mocked(db.execute).mock.calls[0]?.[1]?.[0]).toBeNull();
    expect(db.commit).toHaveBeenCalledTimes(1);
  });

  it('persists explicit validUntil timestamps as iso strings', async () => {
    const db: TemporalDbConnection = {
      execute: vi.fn(),
      commit: vi.fn(),
    };
    const tracker = new TemporalMemoryTracker(db);
    const validUntil = new Date('2026-12-31T00:00:00.000Z');

    await tracker.addFact({
      content: 'Closed fact',
      entityId: 'entity-closed',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil,
    });

    expect(vi.mocked(db.execute).mock.calls[0]?.[1]?.[4]).toBe(validUntil.toISOString());
    expect(db.commit).toHaveBeenCalledTimes(1);
  });
});
