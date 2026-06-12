import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let SqliteMemoryStore: any;
let sqliteAvailable = false;
try {
  const mod = await import('../../memory/sqlite-memory-store.js');
  SqliteMemoryStore = mod.SqliteMemoryStore;
  sqliteAvailable = true;
} catch {
  sqliteAvailable = false;
}

describe.runIf(sqliteAvailable)('SqliteMemoryStore additional coverage', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: InstanceType<typeof SqliteMemoryStore>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-memory-store-additional-'));
    dbPath = path.join(tmpDir, 'test.db');
    store = new SqliteMemoryStore(dbPath);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('uses fallback defaults when synthetic rows omit optional persisted fields', () => {
    const entry = (store as any)._rowToEntry({
      id: 'row-fallbacks',
      content: 'fallback content',
      entity_id: null,
      topics: undefined,
      importance: undefined,
      source: undefined,
      valid_from: null,
      valid_until: null,
      supersedes: null,
      superseded_by: null,
      metadata: undefined,
      created_at: '2026-06-08T00:00:00.000Z',
      updated_at: '2026-06-08T00:00:01.000Z',
    });

    expect(entry.topics).toEqual([]);
    expect(entry.importance).toBe(0.5);
    expect(entry.source).toBe('user');
    expect(entry.metadata).toEqual({});
  });

  it('covers fallback branches for id generation, empty batches, partial updates, and missing count rows', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    vi.resetModules();
    vi.doMock('crypto', async () => {
      const actual = await vi.importActual<typeof import('crypto')>('crypto');
      return {
        ...actual,
        randomUUID: undefined,
      };
    });

    const { SqliteMemoryStore: FallbackIdStore } = await import('../../memory/sqlite-memory-store.js');
    const fallbackDbPath = path.join(tmpDir, 'fallback-id.db');
    const fallbackStore = new FallbackIdStore(fallbackDbPath);

    const fallbackId = await fallbackStore.add({ content: 'fallback-id' });
    expect(fallbackId).toBe(`1234567890-${(0.123456789).toString(36).slice(2, 8)}`);
    await fallbackStore.close();
    vi.doUnmock('crypto');
    vi.resetModules();

    await expect(store.getBatch([])).resolves.toEqual([]);

    const updatedId = await store.add({
      content: 'before-update',
      topics: ['old'],
      importance: 0.9,
      source: 'seed',
      metadata: { seeded: true },
    });
    await store.update(updatedId, { topics: ['new-topic'] });
    const updatedEntry = await store.get(updatedId);

    expect(updatedEntry).not.toBeNull();
    expect(updatedEntry!.content).toBe('');
    expect(updatedEntry!.topics).toEqual(['new-topic']);

    (store as any)._countStmt = {
      get: vi.fn().mockReturnValue(undefined),
    };
    await expect(store.count()).resolves.toBe(0);
  });
});
