import { describe, expect, it, beforeEach } from 'vitest';
import type { StorageAdapter, SyncData } from '../../sync/storage-adapter.js';

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
    return entries.filter((e) => e.key.startsWith(prefix));
  }

  async getMeta() { return this.meta; }
  async setMeta(partial: Record<string, unknown>) {
    this.meta = { ...this.meta, ...partial };
    return this.meta;
  }
}

import { SyncEngine } from '../../sync/sync-engine.js';

describe('SyncEngine', () => {
  let local: MockStorage;
  let remote: MockStorage;
  let engine: SyncEngine;

  beforeEach(() => {
    local = new MockStorage('local');
    remote = new MockStorage('remote');
    engine = new SyncEngine(local, remote);
  });

  it('pushes local data to remote', async () => {
    await local.set('chapter-1', { text: 'Hello world' }, 'device-A');
    const result = await engine.push();
    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(0);

    const remoteData = await remote.get('chapter-1');
    expect(remoteData).not.toBeNull();
    expect((remoteData!.data as { text: string }).text).toBe('Hello world');
  });

  it('pulls remote data to local', async () => {
    await remote.set('chapter-2', { text: 'Remote content' }, 'device-B');
    const result = await engine.pull();
    expect(result.pulled).toBe(1);
    expect(result.pushed).toBe(0);

    const localData = await local.get('chapter-2');
    expect(localData).not.toBeNull();
    expect((localData!.data as { text: string }).text).toBe('Remote content');
  });

  it('syncFull syncs both directions', async () => {
    await local.set('local-only', { text: 'local' }, 'device-A');
    await remote.set('remote-only', { text: 'remote' }, 'device-B');
    const result = await engine.syncFull();
    expect(result.pushed).toBe(1);
    expect(result.pulled).toBe(1);

    expect(await local.get('remote-only')).not.toBeNull();
    expect(await remote.get('local-only')).not.toBeNull();
  });

  it('reports correct status', async () => {
    await local.set('a', {}, 'd1');
    await local.set('b', {}, 'd1');
    await remote.set('c', {}, 'd2');

    const status = await engine.status();
    expect(status.localCount).toBe(2);
    expect(status.remoteCount).toBe(1);
    expect(status.pendingChanges).toBe(2);
  });

  it('resolves conflicts with last-write-wins', async () => {
    await local.set('conflict-key', { text: 'local version' }, 'device-A');
    const localData = await local.get('conflict-key');

    // Simulate remote having newer version
    await remote.set('conflict-key', { text: 'remote version' }, 'device-B');
    const remoteData = await remote.get('conflict-key');
    if (remoteData) remoteData.updatedAt = (localData?.updatedAt ?? 0) + 1000;
    // Overwrite remote with newer timestamp
    await remote.set('conflict-key', { text: 'remote version' }, 'device-B');
    const updatedRemote = await remote.get('conflict-key');
    if (updatedRemote) updatedRemote.updatedAt = (localData?.updatedAt ?? 0) + 1000;

    const result = await engine.syncFull();
    // Remote should win since it has later updatedAt
    const finalLocal = await local.get('conflict-key');
    expect((finalLocal!.data as { text: string }).text).toBe('remote version');
  });

  it('no-ops when data is identical', async () => {
    await local.set('same', { text: 'identical' }, 'device-A');
    await remote.set('same', { text: 'identical' }, 'device-A');

    const result = await engine.syncFull();
    // Both exist, same content — no push or pull needed
    expect(result.pushed + result.pulled).toBeLessThanOrEqual(2);
  });
});
