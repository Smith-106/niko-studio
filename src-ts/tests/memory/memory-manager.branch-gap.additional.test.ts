import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MemoryEntry,
  MemoryManager,
  MemoryManagerAdapter,
  resetMemoryManager,
} from '../../memory/memory-manager';

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-mm-gap-'));
}

function createMockStore() {
  return {
    add: vi.fn().mockResolvedValue('store-id'),
    get: vi.fn().mockResolvedValue(null),
    getBatch: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockResolvedValue({ memories: [], total: 0 }),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rebuildIndex: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
  resetMemoryManager();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  resetMemoryManager();
  rmSync(tempDir, { recursive: true, force: true });
  vi.doUnmock('fs');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('memory-manager branch gap coverage', () => {
  it('routes nullish frontmatter fields through yamlDump and fills parsing defaults', () => {
    const entry = new MemoryEntry({
      id: 'yaml-nullish',
      content: 'Body text here.',
      topics: [],
      entityId: null,
      validFrom: null,
      validUntil: null,
      supersedes: null,
      supersededBy: null,
      metadata: {},
    });

    const output = entry.toYamlFrontmatter();
    expect(output).toContain('topics: []');
    expect(output).not.toContain('entity_id:');
    expect(output).not.toContain('valid_from:');
    expect(output).not.toContain('superseded_by:');

    const parsed = MemoryEntry.fromYamlContent(`---
created_at: 2026-03-15T10:00:00Z
updated_at: 2026-03-15T10:00:00Z

source: user
---

Default body.`);

    expect(parsed.id).toBe('');
    expect(parsed.topics).toEqual([]);
    expect(parsed.entityId).toBeNull();
    expect(parsed.content).toBe('Default body.');
  });

  it('rebuilds indexes around non-directory nodes and can early-return when by_date appears unavailable', async () => {
    vi.useFakeTimers();
    try {
      const fixedDate = new Date('2026-04-12T08:30:00.000Z');
      vi.setSystemTime(fixedDate);

      const manager = new MemoryManager(tempDir);
      const original = manager.add('Indexed content', ['rebuild-topic'], 'rebuild-entity');
      const yearPath = join(manager.byDateDir, '2026');
      const monthPath = join(yearPath, '04');
      writeFileSync(join(manager.byDateDir, 'notes.txt'), 'skip root file', 'utf-8');
      writeFileSync(join(yearPath, 'not-a-month.txt'), 'skip month file', 'utf-8');
      writeFileSync(join(monthPath, 'not-a-day.txt'), 'skip day file', 'utf-8');
      writeFileSync(manager.indexPath, '{broken-json', 'utf-8');

      const rebuilt = new MemoryManager(tempDir);
      expect(rebuilt.get(original.id)?.content).toBe('Indexed content');
      expect(rebuilt.getByTopic('rebuild-topic')).toHaveLength(1);
      expect(rebuilt.getByEntity('rebuild-entity')).toHaveLength(1);

      const isolatedTempDir = createTempDir();
      const isolatedMemoriesDir = join(isolatedTempDir, 'memories');
      const isolatedByDateDir = join(isolatedMemoriesDir, 'by_date');
      const isolatedIndexPath = join(isolatedMemoriesDir, 'index.json');
      mkdirSync(isolatedMemoriesDir, { recursive: true });
      writeFileSync(isolatedIndexPath, '{broken-json', 'utf-8');

      vi.resetModules();
      vi.doMock('fs', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs')>();
        return {
          ...actual,
          existsSync: vi.fn((target: import('fs').PathLike) => {
            if (String(target) === isolatedByDateDir) {
              return false;
            }
            return actual.existsSync(target);
          }),
        };
      });

      const isolatedModule = await import('../../memory/memory-manager');
      const isolatedManager = new isolatedModule.MemoryManager(isolatedTempDir);

      expect(isolatedManager.getBatch([])).toEqual([]);
      expect(existsSync(isolatedManager.indexPath)).toBe(true);

      rmSync(isolatedTempDir, { recursive: true, force: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('covers temporal, dated, and search exclusion branches', () => {
    vi.useFakeTimers();
    try {
      const fixedDate = new Date('2026-04-13T09:00:00.000Z');
      vi.setSystemTime(fixedDate);

      const manager = new MemoryManager(tempDir);
      const first = manager.add('Needle alpha', ['needle-topic'], 'entity-a', undefined, undefined, 0.7);
      const second = manager.add('Needle beta', ['needle-topic'], 'entity-a', undefined, undefined, 0.6);
      const superseded = manager.supersede(first.id, 'Replacement alpha', ['needle-topic']);

      expect(superseded).not.toBeNull();
      expect(manager.get(first.id)?.supersededBy).toBe(superseded?.id);
      expect(manager.get(superseded!.id)?.supersedes).toBe(first.id);
      expect(manager.getByEntity('missing-entity')).toEqual([]);

      const datedDefault = manager.getByDate(new Date('2026-04-13T09:00:00.000Z'));
      const datedWithSuperseded = manager.getByDate('2026-04-13T09:00:00.000Z', true);
      expect(datedDefault.some((item) => item.id === first.id)).toBe(false);
      expect(datedWithSuperseded.some((item) => item.id === first.id)).toBe(true);

      const facts = manager.getTemporalFacts('entity-a');
      expect(facts.some((item) => item.id === first.id)).toBe(false);
      expect(facts.some((item) => item.id === second.id)).toBe(true);

      const searchResults = manager.search('Needle', null, null, 1);
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]?.id).toBe(second.id);

      const helper = manager as unknown as {
        _getDatePath(dt?: Date): string;
      };
      expect(helper._getDatePath()).toContain(join('2026', '04', '13'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('covers async and hybrid fallback branches with null filters and missing vector metadata', async () => {
    const manager = new MemoryManager(tempDir);
    const noStoreResults = await manager.searchAsync('anything', null, null, 3);
    expect(noStoreResults).toEqual([]);

    const store = createMockStore();
    const storedManager = new MemoryManager(tempDir, store as never);
    const storedEntry = storedManager.add('Async branch memory', ['async-topic'], 'async-entity');
    store.search.mockResolvedValueOnce({
      memories: [{ id: storedEntry.id }],
      total: 1,
    });

    const asyncResults = await storedManager.searchAsync('Async', null, null, 2);
    expect(asyncResults.map((item) => item.id)).toEqual([storedEntry.id]);
    expect(store.search).toHaveBeenCalledWith({
      query: 'Async',
      topics: undefined,
      entityId: undefined,
      limit: 2,
    });

    const vectorService = {
      add: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([
        {
          id: 'vector-empty-score',
          content: 'Vector no score',
          metadata: undefined,
        },
        {
          id: 'vector-scored',
          content: 'Vector scored',
          score: 0.9,
          metadata: { tags: ['vector'] },
        },
      ]),
    };
    const adapter = new MemoryManagerAdapter(storedManager, vectorService, tempDir);

    await adapter.save('Vector save branch', null, null, 0.4, 'user', null, true);
    expect(vectorService.add).toHaveBeenCalledWith(
      [{ role: 'memory', content: 'Vector save branch' }],
      { namespace: 'memories', tags: [], importance: 0.4 },
    );

    const hybridResults = await adapter.searchHybrid('Vector', null, 5);
    expect(hybridResults[0]).toMatchObject({ id: 'vector-scored', source: 'vector', topics: ['vector'] });
    expect(hybridResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'vector-empty-score', source: 'vector', topics: [] }),
    ]));
  });

  it('returns early when persisting an entry that is not indexed', () => {
    const manager = new MemoryManager(tempDir);
    const ghost = new MemoryEntry({
      id: 'ghost-entry',
      content: 'Ghost content',
    });

    expect(() =>
      (manager as unknown as {
        _persistEntry(entry: MemoryEntry): void;
      })._persistEntry(ghost),
    ).not.toThrow();
  });
});
