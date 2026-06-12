import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IncrementalSyncEngine } from '../../services/sync/incremental-sync-engine.js';

describe('services/sync/incremental-sync-engine', () => {
  let workspace: string;
  let dbPath: string;
  let engine: IncrementalSyncEngine | undefined;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-sync-engine-'));
    dbPath = join(workspace, 'sync-state.db');
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    try {
      engine?.close();
    } catch {
      // ignore double-close cleanup
    }

    await rm(workspace, { recursive: true, force: true });
  });

  it('hashes content deterministically into a short digest', () => {
    engine = new IncrementalSyncEngine(dbPath);

    const first = engine.hashContent('same content');
    const second = engine.hashContent('same content');
    const third = engine.hashContent('different content');

    expect(first).toBe(second);
    expect(first).not.toBe(third);
    expect(first).toMatch(/^[a-f0-9]{16}$/);
  });

  it('tracks changed entities and exposes stored mappings', () => {
    engine = new IncrementalSyncEngine(dbPath);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    expect(engine.hasChanged('local-1', 'alpha body')).toBe(true);

    engine.recordSync('local-1', 'remote-1', 'alpha body');

    expect(engine.hasChanged('local-1', 'alpha body')).toBe(false);
    expect(engine.hasChanged('local-1', 'beta body')).toBe(true);
    expect(engine.getRemoteId('local-1')).toBe('remote-1');
    expect(engine.getLocalId('remote-1')).toBe('local-1');

    const stale = engine.getStaleEntities(1_700_000_000_001);

    expect(stale).toHaveLength(1);
    expect(stale[0]).toEqual(
      expect.objectContaining({
        local_id: 'local-1',
        remote_id: 'remote-1',
        direction: 'bidirectional',
      }),
    );
  });

  it('supports explicit sync directions and removing mappings', () => {
    engine = new IncrementalSyncEngine(dbPath);
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_100_000);

    engine.recordSync('local-2', 'remote-2', 'gamma body', 'push');
    engine.recordSync('local-3', 'remote-3', 'delta body', 'pull');

    const stale = engine.getStaleEntities(1_700_000_100_001);

    expect(stale).toHaveLength(2);
    expect(stale).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          local_id: 'local-2',
          remote_id: 'remote-2',
          direction: 'push',
        }),
        expect.objectContaining({
          local_id: 'local-3',
          remote_id: 'remote-3',
          direction: 'pull',
        }),
      ]),
    );

    engine.removeMapping('local-2');

    expect(engine.getRemoteId('local-2')).toBeNull();
    expect(engine.getLocalId('remote-2')).toBeNull();
  });

  it('closes the database cleanly', () => {
    engine = new IncrementalSyncEngine(dbPath);

    expect(() => engine?.close()).not.toThrow();
    engine = undefined;
  });
});
