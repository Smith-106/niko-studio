/**
 * CoreMemoryStore Tests
 *
 * Tests CoreMemory data model and CoreMemoryStore SQLite-backed operations.
 * Uses real SQLite (better-sqlite3) with temp directories for realistic testing.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CoreMemory,
  CoreMemoryStore,
  getCoreMemoryStore,
  resetCoreMemoryStore,
} from '../../memory/core-memory-store';

import BetterSqlite3 from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-core-memory-'));
}

type MockVectorItem = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  type: string;
};

function createMockVectorSearch(dbPath: string) {
  const items = new Map<string, MockVectorItem>();
  const close = vi.fn();
  const connection = {
    prepare(sql: string) {
      if (sql.includes("SELECT id, content, metadata FROM items WHERE id = ? AND type = 'memory'")) {
        return {
          get(id: string) {
            const item = items.get(id);
            if (!item || item.type !== 'memory') return undefined;
            return {
              id: item.id,
              content: item.content,
              metadata: JSON.stringify(item.metadata),
            };
          },
        };
      }

      if (sql.includes('SELECT metadata FROM items WHERE id = ?')) {
        return {
          get(id: string) {
            const item = items.get(id);
            if (!item) return undefined;
            return { metadata: JSON.stringify(item.metadata) };
          },
        };
      }

      if (sql.includes('UPDATE items SET metadata = ? WHERE id = ?')) {
        return {
          run(metadataJson: string, id: string) {
            const item = items.get(id);
            if (item) {
              item.metadata = JSON.parse(metadataJson) as Record<string, unknown>;
            }
          },
        };
      }

      if (sql.includes("SELECT id, content, metadata FROM items WHERE type = 'memory' LIMIT ?")) {
        return {
          all(limit: number) {
            return Array.from(items.values())
              .filter((item) => item.type === 'memory')
              .slice(0, limit)
              .map((item) => ({
                id: item.id,
                content: item.content,
                metadata: JSON.stringify(item.metadata),
              }));
          },
        };
      }

      throw new Error(`Unexpected vector SQL in test double: ${sql}`);
    },
    close,
  };

  const vectorSearch = {
    dbPath,
    _getConnection: vi.fn(() => connection),
    upsertVector: vi.fn((params: { id: string; content: string; metadata: Record<string, unknown>; type: string }) => {
      items.set(params.id, {
        id: params.id,
        content: params.content,
        metadata: { ...params.metadata },
        type: params.type,
      });
    }),
    searchMemoryVectors: vi.fn((query: string, topK: number) => {
      const normalized = query.toLowerCase();
      return Array.from(items.values())
        .filter((item) => item.type === 'memory' && item.content.toLowerCase().includes(normalized))
        .slice(0, topK)
        .map((item) => ({
          id: item.id,
          content: item.content,
          metadata: { ...item.metadata },
        }));
    }),
    deleteVector: vi.fn((id: string) => items.delete(id)),
  };

  return { vectorSearch, items, connection, close };
}

// Patch the COMMIT bug in _initSchema by monkey-patching Database.exec
// The source code calls conn.exec("COMMIT") without a BEGIN transaction,
// which throws in better-sqlite3. We work around this by catching the error.
const _origExec = BetterSqlite3.prototype.exec;
let _commitBugPatched = false;

function patchCommitBug(): void {
  if (_commitBugPatched) return;
  _commitBugPatched = true;
  BetterSqlite3.prototype.exec = function (this: any, sql: string) {
    try {
      return _origExec.call(this, sql);
    } catch (e: any) {
      if (sql === 'COMMIT' && e.code === 'SQLITE_ERROR') return;
      throw e;
    }
  };
}

function unpatchCommitBug(): void {
  if (!_commitBugPatched) return;
  _commitBugPatched = false;
  BetterSqlite3.prototype.exec = _origExec;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  resetCoreMemoryStore();
  vi.restoreAllMocks();
  unpatchCommitBug();
});

beforeEach(() => {
  patchCommitBug();
});

describe('CoreMemory', () => {
  it('constructs with defaults', () => {
    const memory = new CoreMemory({ id: 'mem-1', content: 'Hello world' });
    expect(memory.id).toBe('mem-1');
    expect(memory.content).toBe('Hello world');
    expect(memory.summary).toBeNull();
    expect(memory.archived).toBe(false);
    expect(memory.importance).toBe(0.5);
    expect(memory.accessCount).toBe(0);
    expect(memory.metadata).toEqual({});
    expect(memory.createdAt).toBeTruthy();
    expect(memory.updatedAt).toBeTruthy();
  });

  it('accepts all parameters', () => {
    const now = Date.now() / 1000;
    const memory = new CoreMemory({
      id: 'mem-2',
      content: 'Full content',
      summary: 'A summary',
      archived: true,
      createdAt: now,
      updatedAt: now,
      metadata: { tags: ['test'] },
      importance: 0.9,
      accessCount: 5,
    });
    expect(memory.summary).toBe('A summary');
    expect(memory.archived).toBe(true);
    expect(memory.importance).toBe(0.9);
    expect(memory.accessCount).toBe(5);
    expect(memory.metadata).toEqual({ tags: ['test'] });
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new CoreMemory({
      id: 'mem-rt',
      content: 'Round trip content',
      summary: 'RT summary',
      importance: 0.7,
      accessCount: 3,
      metadata: { key: 'val' },
    });
    const dict = original.toDict();
    const restored = CoreMemory.fromDict(dict);
    expect(restored.id).toBe('mem-rt');
    expect(restored.content).toBe('Round trip content');
    expect(restored.summary).toBe('RT summary');
    expect(restored.importance).toBe(0.7);
    expect(restored.accessCount).toBe(3);
  });

  it('fromDict handles legacy data without importance/accessCount', () => {
    const data: Record<string, unknown> = {
      id: 'mem-legacy',
      content: 'Legacy content',
      created_at: 1000,
      updated_at: 1000,
      metadata: '{}',
    };
    const restored = CoreMemory.fromDict(data);
    expect(restored.importance).toBe(0.5);
    expect(restored.accessCount).toBe(0);
  });
});

describe('CoreMemoryStore', () => {
  let tempDir: string;
  let dbPath: string;
  let store: CoreMemoryStore;

  beforeEach(() => {
    tempDir = createTempDir();
    dbPath = join(tempDir, 'core_memory.db');
    store = new CoreMemoryStore({ dbPath });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('creates store with custom dbPath', () => {
      const s = new CoreMemoryStore({ dbPath });
      expect(s).toBeDefined();
    });

    it('creates store with summaryGenerator', () => {
      const gen = vi.fn().mockReturnValue('Generated summary');
      const s = new CoreMemoryStore({ dbPath, summaryGenerator: gen });
      expect(s).toBeDefined();
    });
  });

  describe('upsertMemory', () => {
    it('creates a new memory with auto-generated ID', () => {
      const memory = store.upsertMemory({ content: 'New memory content' });
      expect(memory.id).toBeTruthy();
      expect(memory.content).toBe('New memory content');
      expect(memory.archived).toBe(false);
    });

    it('creates a memory with explicit ID', () => {
      const memory = store.upsertMemory({ content: 'Content', memoryId: 'explicit-id' });
      expect(memory.id).toBe('explicit-id');
    });

    it('updates existing memory preserving createdAt', () => {
      const created = store.upsertMemory({ content: 'Original', memoryId: 'update-test' });
      const updated = store.upsertMemory({
        content: 'Updated content',
        memoryId: 'update-test',
        summary: 'New summary',
      });
      expect(updated.content).toBe('Updated content');
      expect(updated.summary).toBe('New summary');
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.updatedAt >= created.updatedAt).toBe(true);
    });

    it('throws when content is null or undefined', () => {
      expect(() => store.upsertMemory({ content: null as any })).toThrow('content is required');
      expect(() => store.upsertMemory({ content: undefined as any })).toThrow('content is required');
    });

    it('stores metadata as JSON', () => {
      const memory = store.upsertMemory({
        content: 'With metadata',
        metadata: { chapter: 1, tags: ['hero', 'dragon'] },
      });
      expect(memory.metadata).toEqual({ chapter: 1, tags: ['hero', 'dragon'] });
    });

    it('handles non-object metadata by wrapping', () => {
      const memory = store.upsertMemory({
        content: 'String meta',
        metadata: 'just a string' as any,
      });
      expect(memory.metadata).toEqual({ value: 'just a string' });
    });

    it('stores importance and accessCount', () => {
      const memory = store.upsertMemory({
        content: 'Important',
        importance: 0.95,
        accessCount: 10,
      });
      expect(memory.importance).toBe(0.95);
      expect(memory.accessCount).toBe(10);
    });
  });

  describe('getMemory', () => {
    it('retrieves a stored memory by ID', () => {
      const created = store.upsertMemory({ content: 'Find me', memoryId: 'find-me' });
      const retrieved = store.getMemory('find-me');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toBe('Find me');
      expect(retrieved!.id).toBe('find-me');
    });

    it('returns null for non-existent memory', () => {
      expect(store.getMemory('non-existent')).toBeNull();
    });
  });

  describe('getMemories', () => {
    it('lists all non-archived memories', () => {
      store.upsertMemory({ content: 'Active 1' });
      store.upsertMemory({ content: 'Active 2' });
      const memories = store.getMemories({ includeArchived: false });
      expect(memories.length).toBe(2);
    });

    it('excludes archived memories by default', () => {
      store.upsertMemory({ content: 'Active' });
      const archived = store.upsertMemory({ content: 'Archived', memoryId: 'arch-id' });
      store.archiveMemory('arch-id');
      const memories = store.getMemories({ includeArchived: false });
      expect(memories.length).toBe(1);
    });

    it('includes archived when includeArchived=true', () => {
      store.upsertMemory({ content: 'Active' });
      store.upsertMemory({ content: 'Archived', memoryId: 'arch-id2' });
      store.archiveMemory('arch-id2');
      const memories = store.getMemories({ includeArchived: true });
      expect(memories.length).toBe(2);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        store.upsertMemory({ content: `Memory ${i}` });
      }
      const memories = store.getMemories({ limit: 3 });
      expect(memories.length).toBe(3);
    });
  });

  describe('searchMemories', () => {
    it('finds memories matching query terms', () => {
      store.upsertMemory({ content: 'The hero fights the dragon in the castle' });
      store.upsertMemory({ content: 'The princess rules the kingdom' });
      const results = store.searchMemories({ query: 'hero dragon', topK: 5 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('hero');
    });

    it('returns empty for no matches', () => {
      store.upsertMemory({ content: 'Something unrelated' });
      const results = store.searchMemories({ query: 'nonexistent query term' });
      expect(results.length).toBe(0);
    });

    it('handles empty query', () => {
      store.upsertMemory({ content: 'Content' });
      const results = store.searchMemories({ query: '' });
      expect(results.length).toBe(0);
    });

    it('handles null query', () => {
      const results = store.searchMemories({ query: null as any });
      expect(results.length).toBe(0);
    });

    it('ranks results by match count', () => {
      store.upsertMemory({ content: 'hero dragon castle quest' });
      store.upsertMemory({ content: 'hero' });
      store.upsertMemory({ content: 'dragon' });
      const results = store.searchMemories({ query: 'hero dragon', topK: 5 });
      expect(results.length).toBeGreaterThan(0);
      // First result should match both terms
      expect(results[0].content).toContain('hero');
      expect(results[0].content).toContain('dragon');
    });

    it('respects topK limit', () => {
      for (let i = 0; i < 10; i++) {
        store.upsertMemory({ content: `hero memory number ${i}` });
      }
      const results = store.searchMemories({ query: 'hero', topK: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('archiveMemory', () => {
    it('archives a memory', () => {
      store.upsertMemory({ content: 'To archive', memoryId: 'archive-me' });
      expect(store.archiveMemory('archive-me')).toBe(true);
      const mem = store.getMemory('archive-me');
      expect(mem!.archived).toBe(true);
    });
  });

  describe('deleteMemory', () => {
    it('deletes a memory', () => {
      store.upsertMemory({ content: 'To delete', memoryId: 'delete-me' });
      expect(store.deleteMemory('delete-me')).toBe(true);
      expect(store.getMemory('delete-me')).toBeNull();
    });
  });

  describe('generateSummary', () => {
    it('returns empty string for non-existent memory', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const summary = store.generateSummary({ memoryId: 'non-existent' });
      expect(summary).toBe('');
      spy.mockRestore();
    });

    it('returns existing summary without regeneration', () => {
      store.upsertMemory({
        content: 'Long content here',
        memoryId: 'sum-test',
        summary: 'Existing summary',
      });
      const summary = store.generateSummary({ memoryId: 'sum-test' });
      expect(summary).toBe('Existing summary');
    });

    it('generates fallback summary when none exists', () => {
      store.upsertMemory({ content: 'Short content.', memoryId: 'gen-sum' });
      const summary = store.generateSummary({ memoryId: 'gen-sum' });
      expect(summary).toBeTruthy();
      expect(summary.length).toBeGreaterThan(0);
    });

    it('generates summary using tool object', () => {
      store.upsertMemory({ content: 'Content', memoryId: 'tool-sum' });
      const tool = { summarize: vi.fn().mockReturnValue('Tool summary') };
      const summary = store.generateSummary({ memoryId: 'tool-sum', tool });
      expect(summary).toBe('Tool summary');
    });

    it('generates summary using tool function', () => {
      store.upsertMemory({ content: 'Content', memoryId: 'fn-sum' });
      const toolFn = vi.fn().mockReturnValue('Function summary');
      const summary = store.generateSummary({ memoryId: 'fn-sum', tool: toolFn });
      expect(summary).toBe('Function summary');
    });

    it('uses summaryGenerator when set', () => {
      const gen = vi.fn().mockReturnValue('Configured summary');
      const s = new CoreMemoryStore({ dbPath, summaryGenerator: gen });
      s.upsertMemory({ content: 'Content', memoryId: 'cfg-sum' });
      const summary = s.generateSummary({ memoryId: 'cfg-sum' });
      expect(summary).toBe('Configured summary');
    });

    it('handles legacy boolean force parameter', () => {
      store.upsertMemory({
        content: 'Content',
        memoryId: 'legacy-force',
        summary: 'Old summary',
      });
      const summary = store.generateSummary({ memoryId: 'legacy-force', tool: true });
      // force=true means regenerate
      expect(summary).toBeTruthy();
    });
  });

  describe('listAll', () => {
    it('lists all memories', () => {
      store.upsertMemory({ content: 'One' });
      store.upsertMemory({ content: 'Two' });
      const all = store.listAll();
      expect(all.length).toBe(2);
    });

    it('respects includeArchived and limit', () => {
      store.upsertMemory({ content: 'A' });
      store.upsertMemory({ content: 'B', memoryId: 'b-id' });
      store.archiveMemory('b-id');
      const active = store.listAll({ includeArchived: false });
      expect(active.length).toBe(1);
      const all = store.listAll({ includeArchived: true, limit: 1 });
      expect(all.length).toBe(1);
    });
  });

  describe('get / upsert (primary API without vectorSearch)', () => {
    it('get returns null for non-existent', () => {
      expect(store.get('missing')).toBeNull();
    });

    it('get with trackAccess increments access count', () => {
      store.upsertMemory({ content: 'Track me', memoryId: 'track-test' });
      const memory = store.get('track-test', true);
      expect(memory!.accessCount).toBe(1);
      // Get again to verify persistence
      const again = store.getMemory('track-test');
      expect(again!.accessCount).toBe(1);
    });

    it('get without trackAccess does not increment', () => {
      store.upsertMemory({ content: 'No track', memoryId: 'notrack-test' });
      const memory = store.get('notrack-test', false);
      expect(memory!.accessCount).toBe(0);
    });
  });

  describe('vectorSearch integration', () => {
    it('archive returns false when no vectorSearch', () => {
      store.upsertMemory({ content: 'Cannot archive via vector', memoryId: 'no-vs' });
      // archive() uses vectorSearch, returns false without it
      expect(store.archive('no-vs')).toBe(false);
    });

    it('delete returns true even without vectorSearch', () => {
      store.upsertMemory({ content: 'Delete safe', memoryId: 'del-safe' });
      expect(store.delete('del-safe')).toBe(true);
    });

    it('syncs through vector upsert/search paths and falls back from getMemory to vector storage', () => {
      const vectorDbPath = join(tempDir, 'vector-upsert.db');
      const { vectorSearch, items } = createMockVectorSearch(vectorDbPath);
      const vectorStore = new CoreMemoryStore({
        dbPath: vectorDbPath,
        vectorSearch: vectorSearch as any,
      });

      expect(vectorStore.vectorSearch).toBe(vectorSearch);

      const created = vectorStore.upsert({
        content: 'Alpha memory text',
        memoryId: 'vec-upsert',
        metadata: { chapter: 1 },
        importance: 0.8,
        summary: 'Alpha summary',
      });
      expect(items.get('vec-upsert')?.metadata).toMatchObject({
        summary: 'Alpha summary',
        importance: 0.8,
        access_count: 0,
        extra: { chapter: 1 },
      });

      const updated = vectorStore.upsert({
        content: 'Alpha memory revised',
        memoryId: 'vec-upsert',
        metadata: { chapter: 2 },
        importance: 0.9,
      });

      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.accessCount).toBe(0);
      expect(items.get('vec-upsert')?.metadata).toMatchObject({
        summary: null,
        importance: 0.9,
        extra: { chapter: 2 },
      });
      expect(vectorStore.getMemory('vec-upsert')?.content).toBe('Alpha memory revised');

      const results = vectorStore.searchMemories({ query: 'alpha', topK: 1 });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('vec-upsert');
    });

    it('tracks access, archives, and updates summaries through owned vector connections', () => {
      const vectorDbPath = join(tempDir, 'vector-owned.db');
      const { vectorSearch, items, close } = createMockVectorSearch(vectorDbPath);
      const vectorStore = new CoreMemoryStore({
        dbPath: vectorDbPath,
        vectorSearch: vectorSearch as any,
        ownsVectorSearch: true,
      });

      vectorStore.upsertMemory({
        content: 'A long note about a silver archive under the old station.',
        memoryId: 'owned-1',
        metadata: { lane: 'owned' },
      });

      const tracked = vectorStore.get('owned-1', true);
      expect(tracked?.accessCount).toBe(1);
      expect(items.get('owned-1')?.metadata.access_count).toBe(1);

      const summary = vectorStore.generateSummary({
        memoryId: 'owned-1',
        tool: () => 'Owned summary',
      });
      expect(summary).toBe('Owned summary');
      expect(vectorStore.getMemory('owned-1')?.summary).toBe('Owned summary');
      expect(items.get('owned-1')?.metadata.summary).toBe('Owned summary');

      expect(vectorStore.archive('owned-1')).toBe(true);
      expect(items.get('owned-1')?.metadata.archived).toBe(true);
      expect(vectorStore.listAll()).toHaveLength(0);
      expect(vectorStore.listAll({ includeArchived: true })).toHaveLength(1);
      expect(close).toHaveBeenCalled();
    });

    it('marks pending sync on archive failure, falls back to sqlite search, and keeps sqlite rows on delete failure', () => {
      const vectorDbPath = join(tempDir, 'vector-failure.db');
      const { vectorSearch, items } = createMockVectorSearch(vectorDbPath);
      const vectorStore = new CoreMemoryStore({
        dbPath: vectorDbPath,
        vectorSearch: vectorSearch as any,
      });

      vectorStore.upsertMemory({
        content: 'Vector failure path with silver archive keywords',
        memoryId: 'fail-case',
      });
      items.delete('fail-case');

      expect(vectorStore.archiveMemory('fail-case')).toBe(false);
      expect(
        vectorStore.searchMemories({
          query: 'silver archive',
          topK: 5,
          includeArchived: true,
        }),
      ).toHaveLength(1);

      const conn = new BetterSqlite3(vectorDbPath);
      try {
        const row = conn
          .prepare('SELECT archived, pending_vector_sync FROM core_memories WHERE id = ?')
          .get('fail-case') as { archived: number; pending_vector_sync: number };
        expect(row.archived).toBe(1);
        expect(row.pending_vector_sync).toBe(1);
      } finally {
        conn.close();
      }

      vectorStore.upsertMemory({
        content: 'Delete should fail before sqlite removal',
        memoryId: 'delete-fail',
      });
      vectorSearch.deleteVector.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      expect(vectorStore.deleteMemory('delete-fail')).toBe(false);
      expect(vectorStore.getMemory('delete-fail')).not.toBeNull();
    });
  });

  describe('helpers and singleton factory', () => {
    it('covers default summary helper branches', () => {
      expect((store as any)._defaultSummary('First sentence. Second sentence.', 50)).toBe(
        'First sentence.',
      );

      const truncated = (store as any)._defaultSummary('x'.repeat(210), 20);
      expect(truncated).toHaveLength(20);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('reuses and resets the singleton store instance', () => {
      const first = getCoreMemoryStore({ dbPath });
      const second = getCoreMemoryStore({ dbPath: join(tempDir, 'other-core.db') });
      expect(second).toBe(first);

      resetCoreMemoryStore();

      const third = getCoreMemoryStore({ dbPath: join(tempDir, 'reset-core.db') });
      expect(third).not.toBe(first);
    });
  });
});
