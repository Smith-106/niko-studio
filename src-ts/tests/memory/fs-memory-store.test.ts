import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FsMemoryStore } from '../../memory/fs-memory-store.js';
import type { MemorySearchQuery } from '../../memory/imemory-store.js';

describe('FsMemoryStore', () => {
  let tmpDir: string;
  let store: FsMemoryStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-memory-store-test-'));
    store = new FsMemoryStore(tmpDir);
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('adds an entry and retrieves it', async () => {
    const id = await store.add({ content: 'hello world' });
    expect(id).toBeTruthy();
    const entry = await store.get(id);
    expect(entry).not.toBeNull();
    expect(entry!.content).toBe('hello world');
    expect(entry!.id).toBe(id);
  });

  it('returns null for non-existent entry', async () => {
    const entry = await store.get('nonexistent');
    expect(entry).toBeNull();
  });

  it('adds entry with all optional fields', async () => {
    const id = await store.add({
      content: 'full entry',
      topics: ['ai', 'ml'],
      entityId: 'entity-1',
      importance: 0.9,
      source: 'test',
      validFrom: '2024-01-01',
      validUntil: '2024-12-31',
      supersedes: null,
      supersededBy: null,
      metadata: { key: 'value' },
    });
    const entry = await store.get(id);
    expect(entry!.topics).toEqual(['ai', 'ml']);
    expect(entry!.entityId).toBe('entity-1');
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
    const entry = await store.get(id);
    expect(entry).toBeNull();
  });

  it('retrieves batch of entries', async () => {
    const id1 = await store.add({ content: 'entry 1' });
    const id2 = await store.add({ content: 'entry 2' });
    const entries = await store.getBatch([id1, id2]);
    expect(entries).toHaveLength(2);
  });

  it('counts entries', async () => {
    await store.add({ content: 'a' });
    await store.add({ content: 'b' });
    expect(await store.count()).toBe(2);
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.add({ content: 'machine learning basics', topics: ['ai'], importance: 0.8, entityId: 'e1' });
      await store.add({ content: 'deep learning advanced', topics: ['ai', 'dl'], importance: 0.9, entityId: 'e2' });
      await store.add({ content: 'web development guide', topics: ['web'], importance: 0.5, entityId: 'e3' });
    });

    it('searches by text query', async () => {
      const result = await store.search({ query: 'learning' });
      expect(result.memories.length).toBe(2);
    });

    it('searches by entityId', async () => {
      const result = await store.search({ entityId: 'e1' });
      expect(result.memories.length).toBe(1);
      expect(result.memories[0].entityId).toBe('e1');
    });

    it('searches by topics', async () => {
      const result = await store.search({ topics: ['ai'] });
      expect(result.memories.length).toBe(2);
    });

    it('applies limit', async () => {
      const result = await store.search({ limit: 1 });
      expect(result.memories.length).toBe(1);
    });
  });

  it('rebuilds index', async () => {
    await store.add({ content: 'test' });
    await store.rebuildIndex();
    expect(await store.count()).toBe(1);
  });
});