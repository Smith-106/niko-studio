import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Skip entire suite if better-sqlite3 is not available
let SqliteMemoryStore: any;
let sqliteAvailable = false;
try {
  const mod = await import('../../memory/sqlite-memory-store.js');
  SqliteMemoryStore = mod.SqliteMemoryStore;
  sqliteAvailable = true;
} catch {
  sqliteAvailable = false;
}

describe.runIf(sqliteAvailable)('SqliteMemoryStore', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: InstanceType<typeof SqliteMemoryStore>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-memory-store-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    store = new SqliteMemoryStore(dbPath);
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds an entry and retrieves it', async () => {
    const id = await store.add({ content: 'hello sqlite' });
    expect(id).toBeTruthy();
    const entry = await store.get(id);
    expect(entry).not.toBeNull();
    expect(entry!.content).toBe('hello sqlite');
  });

  it('returns null for non-existent entry', async () => {
    const entry = await store.get('nonexistent');
    expect(entry).toBeNull();
  });

  it('adds entry with all fields', async () => {
    const id = await store.add({
      content: 'full entry',
      topics: ['ai', 'ml'],
      entityId: 'entity-1',
      importance: 0.9,
      source: 'test',
      metadata: { key: 'value' },
    });
    const entry = await store.get(id);
    expect(entry!.topics).toEqual(['ai', 'ml']);
    expect(entry!.importance).toBe(0.9);
  });

  it('updates an entry', async () => {
    const id = await store.add({ content: 'original' });
    await store.update(id, { content: 'updated' });
    const entry = await store.get(id);
    expect(entry!.content).toBe('updated');
  });

  it('deletes an entry', async () => {
    const id = await store.add({ content: 'to delete' });
    await store.delete(id);
    expect(await store.get(id)).toBeNull();
  });

  it('retrieves batch', async () => {
    const id1 = await store.add({ content: 'a' });
    const id2 = await store.add({ content: 'b' });
    const entries = await store.getBatch([id1, id2]);
    expect(entries).toHaveLength(2);
  });

  it('counts entries', async () => {
    await store.add({ content: 'a' });
    await store.add({ content: 'b' });
    await store.add({ content: 'c' });
    expect(await store.count()).toBe(3);
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.add({ content: 'machine learning basics', topics: ['ai'], importance: 0.8, entityId: 'e1' });
      await store.add({ content: 'deep learning advanced', topics: ['ai', 'dl'], importance: 0.9, entityId: 'e2' });
      await store.add({ content: 'web development guide', topics: ['web'], importance: 0.5, entityId: 'e3' });
    });

    it('searches by entityId', async () => {
      const result = await store.search({ entityId: 'e1' });
      expect(result.memories).toHaveLength(1);
    });

    it('searches by topics', async () => {
      const result = await store.search({ topics: ['ai'] });
      expect(result.memories.length).toBeGreaterThanOrEqual(2);
    });

    it('searches by text via FTS5', async () => {
      const result = await store.search({ query: 'learning' });
      expect(result.memories.length).toBeGreaterThanOrEqual(2);
    });

    it('searches by date range', async () => {
      const result = await store.search({
        startDate: '2020-01-01',
        endDate: '2030-12-31',
      });
      expect(result.memories.length).toBeGreaterThanOrEqual(3);
    });

    it('applies limit', async () => {
      const result = await store.search({ limit: 1 });
      expect(result.memories.length).toBeLessThanOrEqual(1);
    });
  });

  it('rebuilds FTS index', async () => {
    await store.add({ content: 'test rebuild' });
    await expect(store.rebuildIndex()).resolves.toBeUndefined();
  });
});