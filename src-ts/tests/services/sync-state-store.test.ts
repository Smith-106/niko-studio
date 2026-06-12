import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SyncStateStore, type SyncStateEntry } from '../../services/sync-state-store.js';

describe('services/sync-state-store', () => {
  let tempDir: string;
  let dbPath: string;
  let store: SyncStateStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-sync-state-'));
    dbPath = path.join(tempDir, 'sync-state.db');
    store = new SyncStateStore(dbPath);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('upserts and reloads sync state entries', () => {
    const entry: SyncStateEntry = {
      vault_path: '/vault',
      note_path: 'chapter-01.md',
      entity_id: 'entity-1',
      vault_mtime: 10,
      vault_hash: 'hash-a',
      knowledge_mtime: 20,
      knowledge_hash: 'hash-b',
      last_sync_at: 30,
      sync_direction: 'vault-to-knowledge',
    };

    store.upsertSyncState(entry);
    expect(store.getSyncState('/vault', 'chapter-01.md')).toEqual(entry);

    store.upsertSyncState({ ...entry, vault_mtime: 11, vault_hash: 'hash-c', sync_direction: 'knowledge-to-vault' });
    expect(store.getSyncState('/vault', 'chapter-01.md')).toMatchObject({
      vault_mtime: 11,
      vault_hash: 'hash-c',
      sync_direction: 'knowledge-to-vault',
    });
  });

  it('detects created, modified, and deleted notes within a vault', () => {
    store.upsertSyncState({
      vault_path: '/vault',
      note_path: 'modified.md',
      entity_id: null,
      vault_mtime: 10,
      vault_hash: store.computeHash('old body'),
      knowledge_mtime: null,
      knowledge_hash: null,
      last_sync_at: 15,
      sync_direction: null,
    });
    store.upsertSyncState({
      vault_path: '/vault',
      note_path: 'deleted.md',
      entity_id: null,
      vault_mtime: 10,
      vault_hash: store.computeHash('to delete'),
      knowledge_mtime: null,
      knowledge_hash: null,
      last_sync_at: 15,
      sync_direction: null,
    });

    const changes = store
      .detectChanges('/vault', [
        { path: 'created.md', mtime: 40, content: 'brand new' },
        { path: 'modified.md', mtime: 50, content: 'new body' },
        { path: 'unchanged.md', mtime: 50, content: 'same body' },
      ])
      .sort((a, b) => a.path.localeCompare(b.path));

    expect(changes).toEqual([
      { path: 'created.md', type: 'created' },
      { path: 'deleted.md', type: 'deleted' },
      { path: 'modified.md', type: 'modified' },
      { path: 'unchanged.md', type: 'created' },
    ]);
  });

  it('tracks unresolved conflicts and marks them resolved', () => {
    const conflictId = store.addConflict({
      vault_path: '/vault',
      note_path: 'chapter-02.md',
      entity_id: 'entity-2',
      vault_content: 'vault copy',
      knowledge_content: 'knowledge copy',
      detected_at: 100,
      resolved_at: null,
      resolution: null,
    });

    expect(store.getUnresolvedConflicts('/vault')).toEqual([
      expect.objectContaining({
        id: conflictId,
        note_path: 'chapter-02.md',
        resolution: null,
      }),
    ]);

    store.resolveConflict(conflictId, 'manual-merge');

    expect(store.getUnresolvedConflicts('/vault')).toEqual([]);
  });

  it('produces short stable content hashes', () => {
    const first = store.computeHash('same content');
    const second = store.computeHash('same content');
    const third = store.computeHash('different content');

    expect(first).toBe(second);
    expect(first).not.toBe(third);
    expect(first).toHaveLength(16);
  });
});
