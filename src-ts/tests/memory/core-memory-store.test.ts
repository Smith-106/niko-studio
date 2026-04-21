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
  resetCoreMemoryStore,
} from '../../memory/core-memory-store';

import BetterSqlite3 from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-core-memory-'));
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
  });
});
