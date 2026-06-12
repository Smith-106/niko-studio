import { beforeEach, describe, expect, it } from 'vitest';

import type { StorageAdapter, SyncData } from '../../sync/storage-adapter.js';
import { SyncEngine } from '../../sync/sync-engine.js';

class MockStorage implements StorageAdapter {
  readonly type: 'local' | 'remote';
  private store = new Map<string, SyncData>();
  private meta = { lastSyncAt: 0, deviceId: 'test-device', snapshotVersions: {} };
  private counter = 0;

  constructor(type: 'local' | 'remote') {
    this.type = type;
  }

  async get(key: string): Promise<SyncData | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, data: unknown, deviceId: string): Promise<SyncData> {
    this.counter++;
    const entry: SyncData = {
      key,
      data,
      version: this.counter,
      updatedAt: Date.now(),
      deviceId,
    };
    this.store.set(key, entry);
    return entry;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(prefix?: string): Promise<SyncData[]> {
    const entries = Array.from(this.store.values());
    if (!prefix) return entries;
    return entries.filter((entry) => entry.key.startsWith(prefix));
  }

  async getMeta() {
    return this.meta;
  }

  async setMeta(partial: Record<string, unknown>) {
    this.meta = { ...this.meta, ...partial };
    return this.meta;
  }

  put(entry: SyncData): void {
    this.store.set(entry.key, entry);
  }
}

describe('SyncEngine branch-gap coverage', () => {
  let local: MockStorage;
  let remote: MockStorage;
  let engine: SyncEngine;

  beforeEach(() => {
    local = new MockStorage('local');
    remote = new MockStorage('remote');
    engine = new SyncEngine(local, remote);
  });

  it('does not count pending status changes when the remote version is newer', async () => {
    local.put({
      key: 'shared',
      data: { text: 'local stale' },
      version: 1,
      updatedAt: 100,
      deviceId: 'device-local',
    });
    remote.put({
      key: 'shared',
      data: { text: 'remote newer' },
      version: 2,
      updatedAt: 200,
      deviceId: 'device-remote',
    });

    const status = await engine.status();

    expect(status).toEqual({
      localCount: 1,
      remoteCount: 1,
      pendingChanges: 0,
    });
  });

  it('preserves explicitly requested keys even when both stores are empty', async () => {
    const result = await engine.push(['missing-key']);

    expect(result).toMatchObject({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      changes: [],
    });
    expect((await local.getMeta()).lastSyncAt).toBe(result.timestamp);
    expect((await remote.getMeta()).lastSyncAt).toBe(result.timestamp);
  });

  it('filters to the requested keys when both stores already contain data', async () => {
    local.put({
      key: 'keep-local',
      data: { text: 'push me' },
      version: 4,
      updatedAt: 400,
      deviceId: 'device-local',
    });
    local.put({
      key: 'skip-local',
      data: { text: 'do not push me' },
      version: 5,
      updatedAt: 500,
      deviceId: 'device-local',
    });
    remote.put({
      key: 'remote-existing',
      data: { text: 'already remote' },
      version: 2,
      updatedAt: 200,
      deviceId: 'device-remote',
    });

    const result = await engine.push(['keep-local']);

    expect(result).toMatchObject({
      pushed: 1,
      pulled: 0,
      conflicts: 0,
      changes: [
        expect.objectContaining({
          key: 'keep-local',
          action: 'push',
        }),
      ],
    });
    expect(await remote.get('keep-local')).not.toBeNull();
    expect(await remote.get('skip-local')).toBeNull();
    expect((await remote.get('remote-existing'))?.data).toEqual({ text: 'already remote' });
  });

  it('resolves equal-timestamp conflicts in favor of the higher remote version', async () => {
    local.put({
      key: 'same-time',
      data: { text: 'local loses by version' },
      version: 3,
      updatedAt: 500,
      deviceId: 'device-local',
    });
    remote.put({
      key: 'same-time',
      data: { text: 'remote wins by version' },
      version: 9,
      updatedAt: 500,
      deviceId: 'device-remote',
    });

    const result = await engine.syncFull();

    expect(result).toMatchObject({
      pushed: 0,
      pulled: 0,
      conflicts: 1,
      changes: [
        expect.objectContaining({
          key: 'same-time',
          action: 'conflict',
          resolved: expect.objectContaining({ data: { text: 'remote wins by version' } }),
        }),
      ],
    });
    expect((await local.get('same-time'))?.data).toEqual({ text: 'remote wins by version' });
    expect((await remote.get('same-time'))?.data).toEqual({ text: 'remote wins by version' });
  });
});
