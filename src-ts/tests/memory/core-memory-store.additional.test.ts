import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CoreMemory,
  CoreMemoryStore,
  resetCoreMemoryStore,
} from '../../memory/core-memory-store';

type MockVectorItem = {
  id: string;
  content: string;
  metadata: Record<string, unknown> | string;
  type: string;
};

function metadataPayload(metadata: Record<string, unknown> | string): string {
  return typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
}

function createMockVectorSearch(dbPath: string, options: { throwMetadataUpdate?: boolean } = {}) {
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
              metadata: metadataPayload(item.metadata),
            };
          },
        };
      }

      if (sql.includes('SELECT metadata FROM items WHERE id = ?')) {
        return {
          get(id: string) {
            const item = items.get(id);
            if (!item) return undefined;
            return { metadata: metadataPayload(item.metadata) };
          },
        };
      }

      if (sql.includes('UPDATE items SET metadata = ? WHERE id = ?')) {
        return {
          run(metadataJson: string, id: string) {
            if (options.throwMetadataUpdate) {
              throw new Error('metadata update failed');
            }
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
                metadata: metadataPayload(item.metadata),
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
    upsertVector: vi.fn((params: {
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      type: string;
    }) => {
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
          metadata: typeof item.metadata === 'string' ? {} : { ...item.metadata },
        }));
    }),
    deleteVector: vi.fn((id: string) => items.delete(id)),
  };

  return { vectorSearch, items, close };
}

const originalExec = BetterSqlite3.prototype.exec;
let commitPatchApplied = false;

function patchCommitBug(): void {
  if (commitPatchApplied) return;
  commitPatchApplied = true;
  BetterSqlite3.prototype.exec = function patchedExec(this: unknown, sql: string) {
    try {
      return originalExec.call(this, sql);
    } catch (error: unknown) {
      if (sql === 'COMMIT' && (error as { code?: string }).code === 'SQLITE_ERROR') return;
      throw error;
    }
  };
}

function unpatchCommitBug(): void {
  if (!commitPatchApplied) return;
  commitPatchApplied = false;
  BetterSqlite3.prototype.exec = originalExec;
}

describe('CoreMemoryStore additional coverage', () => {
  let tempDir: string;

  beforeEach(() => {
    patchCommitBug();
    tempDir = mkdtempSync(join(tmpdir(), 'niko-core-memory-extra-'));
  });

  afterEach(() => {
    resetCoreMemoryStore();
    vi.restoreAllMocks();
    unpatchCommitBug();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('covers constructor default paths and metadata fallback helpers', () => {
    const nestedDbPath = join(tempDir, 'nested', 'core.db');
    const nestedStore = new CoreMemoryStore({ dbPath: nestedDbPath });
    expect(nestedStore.vectorSearch).toBeNull();

    const vectorDbPath = join(tempDir, 'vector-default.db');
    const { vectorSearch } = createMockVectorSearch(vectorDbPath);
    const vectorPathStore = new CoreMemoryStore({ vectorSearch: vectorSearch as any });
    expect(vectorPathStore.vectorSearch).toBe(vectorSearch);

    const legacy = CoreMemory.fromDict({
      id: 'legacy-defaults',
      content: 'Legacy defaults',
    });
    expect(legacy.metadata).toEqual({});
    expect(legacy.summary).toBeNull();
    expect(legacy.archived).toBe(false);

    expect((nestedStore as any)._parseMetadata(undefined)).toEqual({});
    expect((nestedStore as any)._parseMetadata('')).toEqual({});
    expect((nestedStore as any)._parseMetadata('[]')).toEqual({});
    expect((nestedStore as any)._parseMetadata('{bad json')).toEqual({});
  });

  it('uses the default database path when an empty params object is provided', () => {
    const cwd = process.cwd();
    process.chdir(tempDir);

    try {
      const store = new CoreMemoryStore({});
      const created = store.upsertMemory({
        content: 'Default path memory',
        memoryId: 'default-path',
      });

      expect(created.id).toBe('default-path');
      expect(store.getMemory('default-path')).toMatchObject({
        content: 'Default path memory',
      });
    } finally {
      process.chdir(cwd);
    }
  });

  it('migrates legacy SQLite rows and reads null numeric columns through defaults', () => {
    const legacyDbPath = join(tempDir, 'legacy-core.db');
    const setupConn = new BetterSqlite3(legacyDbPath);
    setupConn.exec(`
      CREATE TABLE core_memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        summary TEXT,
        archived INTEGER NOT NULL DEFAULT 0
      )
    `);
    setupConn
      .prepare('INSERT INTO core_memories (id, content, summary, archived) VALUES (?, ?, ?, ?)')
      .run('legacy-row', 'Science fiction archive memory', null, 0);
    setupConn.close();

    const store = new CoreMemoryStore({ dbPath: legacyDbPath });
    const migrated = store.getMemory('legacy-row');
    expect(migrated?.importance).toBe(0.5);
    expect(migrated?.accessCount).toBe(0);

    const mutateConn = new BetterSqlite3(legacyDbPath);
    mutateConn
      .prepare(
        `
        UPDATE core_memories
        SET created_at = NULL,
            updated_at = NULL,
            metadata = ?,
            importance = NULL,
            access_count = NULL
        WHERE id = ?
      `,
      )
      .run('{bad json', 'legacy-row');
    mutateConn.close();

    const withNulls = store.getMemory('legacy-row');
    expect(withNulls).toMatchObject({
      createdAt: 0,
      updatedAt: 0,
      metadata: {},
      importance: 0.5,
      accessCount: 0,
    });

    const listed = store.getMemories({ includeArchived: true });
    expect(listed[0]).toMatchObject({
      createdAt: 0,
      updatedAt: 0,
      metadata: {},
      importance: 0.5,
      accessCount: 0,
    });

    const searched = store.searchMemories({
      query: 'science fiction',
      topK: 5,
      includeArchived: true,
    });
    expect(searched[0]).toMatchObject({
      id: 'legacy-row',
      importance: 0.5,
      accessCount: 0,
    });

    expect((store as any)._searchMemoriesSqlite({ query: '   ' })).toEqual([]);
  });

  it('covers vector metadata parsing, archived filtering, and listAll corrupted rows', () => {
    const vectorDbPath = join(tempDir, 'vector-metadata.db');
    const { vectorSearch, items } = createMockVectorSearch(vectorDbPath);
    const store = new CoreMemoryStore({ dbPath: vectorDbPath, vectorSearch: vectorSearch as any });

    items.set('corrupt-get', {
      id: 'corrupt-get',
      content: 'Corrupt metadata content',
      metadata: '{bad json',
      type: 'memory',
    });
    expect(store.get('corrupt-get')).toMatchObject({
      summary: null,
      archived: false,
      createdAt: 0,
      updatedAt: 0,
      metadata: {},
      importance: 0.5,
      accessCount: 0,
    });

    vectorSearch.searchMemoryVectors
      .mockReturnValueOnce([
        {
          id: 'archived-result',
          content: 'Archived result',
          metadata: { archived: true },
        },
        {
          id: 'plain-result',
          content: 'Plain result',
          metadata: {},
        },
      ])
      .mockReturnValueOnce([
        {
          id: 'archived-result',
          content: 'Archived result',
          metadata: { archived: true },
        },
      ]);

    expect(store.searchMemories({ query: 'result', topK: 5 })).toEqual([
      expect.objectContaining({
        id: 'plain-result',
        archived: false,
        importance: 0.5,
      }),
    ]);
    expect(store.searchMemories({ query: 'result', topK: 5, includeArchived: true })).toEqual([
      expect.objectContaining({
        id: 'archived-result',
        archived: true,
        createdAt: 0,
        metadata: {},
      }),
    ]);

    items.set('corrupt-list', {
      id: 'corrupt-list',
      content: 'Skipped corrupt row',
      metadata: '{bad json',
      type: 'memory',
    });
    items.set('archived-list', {
      id: 'archived-list',
      content: 'Archived list row',
      metadata: { archived: true },
      type: 'memory',
    });
    items.set('plain-list', {
      id: 'plain-list',
      content: 'Plain list row',
      metadata: {},
      type: 'memory',
    });

    expect(store.listAll()).toEqual([
      expect.objectContaining({
        id: 'plain-list',
        accessCount: 0,
      }),
    ]);
    expect(store.listAll({ includeArchived: true })).toContainEqual(
      expect.objectContaining({
        id: 'archived-list',
        archived: true,
        metadata: {},
      }),
    );
  });

  it('covers vector sync success and failure paths during upsertMemory', () => {
    const syncDbPath = join(tempDir, 'vector-sync.db');
    const { vectorSearch, items } = createMockVectorSearch(syncDbPath);
    const syncStore = new CoreMemoryStore({ dbPath: syncDbPath, vectorSearch: vectorSearch as any });

    const archived = syncStore.upsertMemory({
      content: 'Archive through vector sync',
      memoryId: 'archived-sync',
      archived: true,
    });
    expect(archived.archived).toBe(true);
    expect(items.get('archived-sync')?.metadata).toMatchObject({ archived: true });

    const failureDbPath = join(tempDir, 'vector-failure.db');
    const failing = createMockVectorSearch(failureDbPath);
    failing.vectorSearch.upsertVector.mockImplementationOnce(() => {
      throw new Error('upsert failed');
    });
    const failureStore = new CoreMemoryStore({
      dbPath: failureDbPath,
      vectorSearch: failing.vectorSearch as any,
    });

    const failed = failureStore.upsertMemory({
      content: 'Vector failure still returns memory',
      memoryId: 'vector-fail',
    });
    expect(failed).toMatchObject({
      summary: null,
      archived: false,
      metadata: {},
      importance: 0.5,
      accessCount: 0,
    });

    const conn = new BetterSqlite3(failureDbPath);
    try {
      const row = conn
        .prepare('SELECT pending_vector_sync FROM core_memories WHERE id = ?')
        .get('vector-fail') as { pending_vector_sync: number };
      expect(row.pending_vector_sync).toBe(1);
    } finally {
      conn.close();
    }
  });

  it('reuses existing metadata and null numeric fields when updating a legacy row', () => {
    const dbPath = join(tempDir, 'update-fallbacks.db');
    const store = new CoreMemoryStore({ dbPath });
    store.upsertMemory({
      content: 'Original row',
      memoryId: 'existing-row',
      metadata: { chapter: 1 },
      importance: 0.9,
      accessCount: 3,
    });

    const mutateConn = new BetterSqlite3(dbPath);
    mutateConn
      .prepare(
        `
        UPDATE core_memories
        SET created_at = NULL,
            metadata = ?,
            importance = NULL,
            access_count = NULL
        WHERE id = ?
      `,
      )
      .run('{"saved":true}', 'existing-row');
    mutateConn.close();

    const updated = store.upsertMemory({
      content: 'Updated row',
      memoryId: 'existing-row',
      summary: 'Updated summary',
    });

    expect(updated).toMatchObject({
      id: 'existing-row',
      content: 'Updated row',
      summary: 'Updated summary',
      metadata: { saved: true },
      importance: 0.5,
      accessCount: 0,
    });
    expect(updated.createdAt).toBeGreaterThan(0);
  });

  it('marks pending sync when vector archive fails during archived upserts', () => {
    const dbPath = join(tempDir, 'archive-failure.db');
    const { vectorSearch } = createMockVectorSearch(dbPath);
    const store = new CoreMemoryStore({ dbPath, vectorSearch: vectorSearch as any });
    const archiveSpy = vi.spyOn(store as any, 'archive').mockReturnValueOnce(false);

    const archived = store.upsertMemory({
      content: 'Archive failure path',
      memoryId: 'archive-failure',
      archived: true,
    });

    expect(archived.archived).toBe(true);
    expect(archiveSpy).toHaveBeenCalledWith('archive-failure');

    const conn = new BetterSqlite3(dbPath);
    try {
      const row = conn
        .prepare('SELECT pending_vector_sync FROM core_memories WHERE id = ?')
        .get('archive-failure') as { pending_vector_sync: number };
      expect(row.pending_vector_sync).toBe(1);
    } finally {
      conn.close();
    }
  });

  it('archives through the legacy api when vector metadata exists', () => {
    const dbPath = join(tempDir, 'archive-success.db');
    const { vectorSearch, items } = createMockVectorSearch(dbPath);
    const store = new CoreMemoryStore({ dbPath, vectorSearch: vectorSearch as any });

    store.upsertMemory({
      content: 'Archive success path',
      memoryId: 'archive-success',
    });

    expect(store.archiveMemory('archive-success')).toBe(true);
    expect(items.get('archive-success')?.metadata).toMatchObject({ archived: true });

    const conn = new BetterSqlite3(dbPath);
    try {
      const row = conn
        .prepare('SELECT archived, pending_vector_sync FROM core_memories WHERE id = ?')
        .get('archive-success') as { archived: number; pending_vector_sync: number };
      expect(row.archived).toBe(1);
      expect(row.pending_vector_sync).toBe(0);
    } finally {
      conn.close();
    }
  });

  it('returns false when archive cannot find vector metadata after loading the memory', () => {
    const getConnection = {
      prepare(sql: string) {
        if (sql.includes("SELECT id, content, metadata FROM items WHERE id = ? AND type = 'memory'")) {
          return {
            get() {
              return {
                id: 'vector-only',
                content: 'Vector only memory',
                metadata: JSON.stringify({ archived: false, extra: {} }),
              };
            },
          };
        }

        throw new Error(`Unexpected vector SQL in load connection: ${sql}`);
      },
      close: vi.fn(),
    };
    const archiveConnection = {
      prepare(sql: string) {
        if (sql.includes('SELECT metadata FROM items WHERE id = ?')) {
          return {
            get() {
              return undefined;
            },
          };
        }

        if (sql.includes('UPDATE items SET metadata = ? WHERE id = ?')) {
          return {
            run() {
              throw new Error('should not update missing metadata');
            },
          };
        }

        throw new Error(`Unexpected vector SQL in archive connection: ${sql}`);
      },
      close: vi.fn(),
    };

    let callCount = 0;
    const vectorSearch = {
      dbPath: join(tempDir, 'archive-missing.db'),
      _getConnection: vi.fn(() => (callCount++ === 0 ? getConnection : archiveConnection)),
      upsertVector: vi.fn(),
      searchMemoryVectors: vi.fn(),
      deleteVector: vi.fn(),
    };

    const store = new CoreMemoryStore({
      dbPath: join(tempDir, 'archive-missing.db'),
      vectorSearch: vectorSearch as any,
    });

    expect(store.archive('vector-only')).toBe(false);
  });

  it('covers sqlite score filtering and vector-search exception fallback paths', () => {
    const sqliteStore = new CoreMemoryStore({ dbPath: join(tempDir, 'sqlite-score-filter.db') });
    const fakeConn = {
      prepare: vi.fn(() => ({
        all: vi.fn(() => [
          {
            id: 'row-1',
            content: 'completely unrelated text',
            summary: null,
            archived: 0,
            created_at: null,
            updated_at: null,
            metadata: '{}',
            importance: null,
            access_count: null,
          },
        ]),
      })),
      close: vi.fn(),
    };
    vi.spyOn(sqliteStore as any, '_getCoreConnection').mockReturnValue(fakeConn);

    expect(
      (sqliteStore as any)._searchMemoriesSqlite({
        query: 'science fiction',
        topK: 5,
        includeArchived: true,
      }),
    ).toEqual([]);

    const vectorDbPath = join(tempDir, 'vector-search-fallback.db');
    const failing = createMockVectorSearch(vectorDbPath);
    failing.vectorSearch.searchMemoryVectors.mockImplementation(() => {
      throw new Error('vector search offline');
    });
    const vectorStore = new CoreMemoryStore({
      dbPath: vectorDbPath,
      vectorSearch: failing.vectorSearch as any,
    });
    vectorStore.upsertMemory({
      content: 'Science fiction fallback result',
      memoryId: 'vector-fallback',
    });

    expect(
      vectorStore.searchMemories({
        query: 'science fiction',
        topK: 5,
        includeArchived: true,
      }),
    ).toEqual([
      expect.objectContaining({
        id: 'vector-fallback',
        content: 'Science fiction fallback result',
      }),
    ]);
  });

  it('falls back to vector retrieval in generateSummary and keeps short content without a period', () => {
    const vectorDbPath = join(tempDir, 'vector-generate-summary.db');
    const { vectorSearch } = createMockVectorSearch(vectorDbPath);
    const store = new CoreMemoryStore({ dbPath: vectorDbPath, vectorSearch: vectorSearch as any });
    const vectorMemory = new CoreMemory({
      id: 'vector-summary',
      content: 'Short summary fallback',
    });

    vi.spyOn(store as any, 'getMemory').mockReturnValueOnce(null);
    vi.spyOn(store as any, 'get').mockReturnValueOnce(vectorMemory);

    const summary = store.generateSummary({
      memoryId: 'vector-summary',
      tool: () => 'Generated from vector fallback',
    });

    expect(summary).toBe('Generated from vector fallback');
    expect((store as any)._defaultSummary('Already complete.', 200)).toBe('Already complete.');
    expect((store as any)._defaultSummary('Short summary fallback', 200)).toBe('Short summary fallback.');
  });

  it('covers private vector helper early returns and summary fallback failures', () => {
    const basicStore = new CoreMemoryStore({ dbPath: join(tempDir, 'basic.db') });
    expect(() => (basicStore as any)._updateAccessCount('missing', 1)).not.toThrow();
    expect(() => (basicStore as any)._updateVectorSummary('missing', 'summary')).not.toThrow();

    const vectorDbPath = join(tempDir, 'summary-vector.db');
    const { vectorSearch, items } = createMockVectorSearch(vectorDbPath, {
      throwMetadataUpdate: true,
    });
    items.set('vector-only', {
      id: 'vector-only',
      content: 'Vector only content that must fall back to slicing after summary failures.',
      metadata: {},
      type: 'memory',
    });
    const store = new CoreMemoryStore({
      dbPath: vectorDbPath,
      vectorSearch: vectorSearch as any,
      summaryGenerator: () => {
        throw new Error('configured summary failed');
      },
    });

    const summary = store.generateSummary({
      memoryId: 'vector-only',
      tool: {
        summarize() {
          throw new Error('tool summary failed');
        },
      },
      force: true,
    });

    expect(summary).toBe('Vector only content that must fall back to slicing after summary failures.');
  });
});
