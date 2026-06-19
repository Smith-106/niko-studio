import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FsMemoryStore } from '../../memory/fs-memory-store.js';

describe('FsMemoryStore branch gap coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-memory-store-branch-gap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('treats missing directories as empty and skips non-json or corrupted files', async () => {
    const missingStore = new FsMemoryStore(path.join(tmpDir, 'missing-store'));
    await expect(missingStore.count()).resolves.toBe(0);
    await missingStore.close();

    const validEntry = {
      id: 'mem-valid',
      content: 'valid entry',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      topics: ['atlas'],
    };

    fs.writeFileSync(path.join(tmpDir, 'valid.json'), JSON.stringify(validEntry), 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'broken.json'), '{bad', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'ignore me', 'utf8');

    const store = new FsMemoryStore(tmpDir);
    await expect(store.count()).resolves.toBe(1);
    await expect(store.get('mem-valid')).resolves.toMatchObject({
      id: 'mem-valid',
      content: 'valid entry',
    });
    await store.close();
  });

  it('applies start and end date filters and treats missing importance as zero', async () => {
    const store = new FsMemoryStore(tmpDir);

    await store.add({
      content: 'old memory',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.add({
      content: 'middle memory',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      importance: 5,
    });
    await store.add({
      content: 'late memory',
      createdAt: '2026-12-01T00:00:00.000Z',
      updatedAt: '2026-12-01T00:00:00.000Z',
      importance: 1,
    });

    const filtered = await store.search({
      startDate: '2026-02-01T00:00:00.000Z',
      endDate: '2026-11-01T00:00:00.000Z',
    });
    expect(filtered.memories).toHaveLength(1);
    expect(filtered.memories[0].content).toBe('middle memory');

    const sorted = await store.search({});
    expect(sorted.memories.map((entry) => entry.content)).toEqual([
      'middle memory',
      'late memory',
      'old memory',
    ]);

    const fallbackOnlyDir = path.join(tmpDir, 'fallback-only');
    fs.mkdirSync(fallbackOnlyDir, { recursive: true });
    fs.writeFileSync(path.join(fallbackOnlyDir, 'first.json'), JSON.stringify({
      id: 'first-fallback',
      content: 'first fallback',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    }), 'utf8');
    fs.writeFileSync(path.join(fallbackOnlyDir, 'second.json'), JSON.stringify({
      id: 'second-fallback',
      content: 'second fallback',
      createdAt: '2026-03-02T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
    }), 'utf8');
    const fallbackOnlyStore = new FsMemoryStore(fallbackOnlyDir);
    const fallbackSorted = await fallbackOnlyStore.search({});
    expect(fallbackSorted.memories).toHaveLength(2);
    expect(fallbackSorted.memories.map((entry) => entry.content).sort()).toEqual([
      'first fallback',
      'second fallback',
    ]);

    await store.close();
    await fallbackOnlyStore.close();
  });

  it('returns early for missing updates and swallows delete errors for absent files', async () => {
    const store = new FsMemoryStore(tmpDir);

    await expect(store.update('missing-id', { content: 'ignored' })).resolves.toBeUndefined();
    await expect(store.delete('missing-id')).resolves.toBeUndefined();
    await expect(store.count()).resolves.toBe(0);

    const id = await store.add({
      content: 'delete me',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
    });
    fs.rmSync(path.join(tmpDir, `${id}.json`), { force: true });

    await expect(store.delete(id)).resolves.toBeUndefined();
    await expect(store.get(id)).resolves.toBeNull();

    await store.close();
  });
});
