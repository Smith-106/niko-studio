/**
 * Sync Engine — incremental sync with conflict resolution.
 *
 * Compares local and remote data snapshots, detects changes,
 * applies last-write-wins conflict resolution, and produces
 * a sync result with push/pull operations.
 */

import type { StorageAdapter, SyncData, SyncMeta } from './storage-adapter';

export interface SyncChange {
  key: string;
  action: 'push' | 'pull' | 'conflict';
  local?: SyncData;
  remote?: SyncData;
  resolved?: SyncData;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  changes: SyncChange[];
  timestamp: number;
}

export class SyncEngine {
  constructor(
    private local: StorageAdapter,
    private remote: StorageAdapter,
  ) {}

  async status(): Promise<{ localCount: number; remoteCount: number; pendingChanges: number }> {
    const [localItems, remoteItems] = await Promise.all([
      this.local.list(),
      this.remote.list(),
    ]);
    const remoteMap = new Map(remoteItems.map((r) => [r.key, r]));
    let pending = 0;
    for (const local of localItems) {
      const remote = remoteMap.get(local.key);
      if (!remote || local.updatedAt > remote.updatedAt) pending++;
    }
    return { localCount: localItems.length, remoteCount: remoteItems.length, pendingChanges: pending };
  }

  async push(keys?: string[]): Promise<SyncResult> {
    return this.sync('push', keys);
  }

  async pull(keys?: string[]): Promise<SyncResult> {
    return this.sync('pull', keys);
  }

  async syncFull(): Promise<SyncResult> {
    return this.sync('both');
  }

  private async sync(direction: 'push' | 'pull' | 'both', keys?: string[]): Promise<SyncResult> {
    const [localItems, remoteItems] = await Promise.all([
      this.local.list(),
      this.remote.list(),
    ]);

    const localMap = new Map(localItems.map((i) => [i.key, i]));
    const remoteMap = new Map(remoteItems.map((i) => [i.key, i]));
    const allKeys = new Set([...localMap.keys(), ...remoteMap.keys()]);

    const filteredKeys = keys ? allKeys.size > 0 ? new Set([...allKeys].filter((k) => keys.includes(k))) : new Set(keys) : allKeys;

    const changes: SyncChange[] = [];
    let pushed = 0;
    let pulled = 0;
    let conflicts = 0;

    for (const key of filteredKeys) {
      const local = localMap.get(key) ?? undefined;
      const remote = remoteMap.get(key) ?? undefined;

      if (!local && remote) {
        if (direction !== 'push') {
          await this.local.set(key, remote.data, remote.deviceId);
          changes.push({ key, action: 'pull', remote, resolved: remote });
          pulled++;
        }
      } else if (local && !remote) {
        if (direction !== 'pull') {
          await this.remote.set(key, local.data, local.deviceId);
          changes.push({ key, action: 'push', local, resolved: local });
          pushed++;
        }
      } else if (local && remote) {
        if (local.version === remote.version && local.updatedAt === remote.updatedAt) continue;

        if (local.updatedAt > remote.updatedAt) {
          if (direction !== 'pull') {
            await this.remote.set(key, local.data, local.deviceId);
            changes.push({ key, action: 'push', local, remote, resolved: local });
            pushed++;
          }
        } else if (remote.updatedAt > local.updatedAt) {
          if (direction !== 'push') {
            await this.local.set(key, remote.data, remote.deviceId);
            changes.push({ key, action: 'pull', local, remote, resolved: remote });
            pulled++;
          }
        } else {
          // Same timestamp but different versions — conflict
          const resolved = local.version >= remote.version ? local : remote;
          await Promise.all([
            this.local.set(key, resolved.data, resolved.deviceId),
            this.remote.set(key, resolved.data, resolved.deviceId),
          ]);
          changes.push({ key, action: 'conflict', local, remote, resolved });
          conflicts++;
        }
      }
    }

    const timestamp = Date.now();
    await Promise.all([
      this.local.setMeta({ lastSyncAt: timestamp }),
      this.remote.setMeta({ lastSyncAt: timestamp }),
    ]);

    return { pushed, pulled, conflicts, changes, timestamp };
  }
}
