import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

function createDbPath(label: string): { basePath: string; dbPath: string } {
  const basePath = join(tmpdir(), `niko-unified-memory-branch-gap-${label}-${randomUUID()}`);
  return { basePath, dbPath: join(basePath, 'memory.db') };
}

function fullMemoryColumns(): Array<{ name: string }> {
  return [
    'id',
    'content',
    'layer',
    'dimension',
    'entity_id',
    'valid_from',
    'valid_until',
    'supersedes',
    'superseded_by',
    'user_id',
    'project_id',
    'session_id',
    'embedding',
    'embedding_blob',
    'embedding_model',
    'embedding_dim',
    'content_hash',
    'last_accessed_at',
    'importance',
    'confidence',
    'source',
    'tags',
    'created_at',
    'updated_at',
  ].map((name) => ({ name }));
}

function fullMemoryRow(id: string, content: string, embeddingBlob: Buffer = Buffer.from([0, 0, 0, 0])): unknown[] {
  return [
    id,
    content,
    'session',
    'context',
    'entity-array-row',
    '2026-01-01T00:00:00.000Z',
    null,
    null,
    null,
    null,
    null,
    null,
    '[]',
    embeddingBlob,
    'test-model',
    1,
    'hash',
    null,
    0.5,
    1,
    'test',
    '[]',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
  ];
}

async function loadUnifiedMemoryModule() {
  vi.resetModules();
  return import('../../memory/unified-memory');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('UnifiedMemory branch-gap coverage', () => {
  it('reports zero hit rate on a fresh cache and creates the singleton from empty params', async () => {
    const { basePath, dbPath } = createDbPath('fresh-cache');
    const memory = await loadUnifiedMemoryModule();
    memory.setConfigProvider((key, defaultValue) => (key === 'memory.db_path' ? dbPath : defaultValue));

    try {
      const embedder = new memory.EmbeddingEngine();
      expect(embedder.cacheStats.hit_rate).toBe(0);

      const singleton = memory.getUnifiedMemoryEngine();
      expect(singleton.dbPath).toBe(dbPath);
    } finally {
      memory.resetUnifiedMemoryEngine();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('falls back to unknown for nameless plugin failures during load, health checks, and callbacks', async () => {
    const { basePath, dbPath } = createDbPath('nameless-plugin');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const memory = await loadUnifiedMemoryModule();
    const namelessPlugin = {
      load: vi.fn(async () => {
        throw new Error('load failed');
      }),
      healthCheck: vi.fn(async () => {
        throw new Error('health failed');
      }),
      onMemoryAdded: vi.fn(async () => {
        throw new Error('callback failed');
      }),
    };
    const engine = new memory.UnifiedMemoryEngine({
      dbPath,
      plugins: [namelessPlugin],
    });

    try {
      await engine.initialize();
      const health = await engine.healthCheck();

      expect(health).toMatchObject({
        plugins: {
          unknown: {
            status: 'error',
            error: 'Error: health failed',
          },
        },
      });

      await expect(
        engine.add({
          content: 'Nameless plugin fallback memory.',
          entityId: 'nameless-plugin',
        }),
      ).resolves.toMatchObject({ status: 'created' });
      expect(namelessPlugin.onMemoryAdded).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('adds memory when conflict resolution omits obsolete ids and tolerates empty conflict content rows', async () => {
    const { basePath, dbPath } = createDbPath('obsolete-ids-fallback');
    const memory = await loadUnifiedMemoryModule();
    const engine = new memory.UnifiedMemoryEngine({ dbPath });

    try {
      const markSupersededSpy = vi.spyOn(engine as unknown as { _markSuperseded(memoryId: string): Promise<void> }, '_markSuperseded');
      vi.spyOn(engine.conflictResolver, 'check').mockResolvedValueOnce([
        { id: 'existing-memory', content: 'Existing memory.' },
      ] as never);
      vi.spyOn(engine.conflictResolver, 'resolve').mockResolvedValueOnce({
        action: 'update',
      } as never);

      await expect(
        engine.add({
          content: 'Fresh memory without obsolete ids.',
          entityId: 'entity-fallback',
        }),
      ).resolves.toMatchObject({ status: 'created' });
      expect(markSupersededSpy).not.toHaveBeenCalled();

      const runtime = engine as unknown as { _db: unknown };
      const realDb = runtime._db;
      runtime._db = {
        prepare: vi.fn(() => ({
          all: vi.fn(() => [
            ['memory-empty', undefined, null, null],
            ['memory-plain', 'plain note', null, null],
          ]),
        })),
      };

      await expect(engine.detectConflicts('entity-fallback')).resolves.toEqual([]);
      runtime._db = realDb;
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers missing-second-memory and newer-first conflict ordering branches', async () => {
    const { basePath, dbPath } = createDbPath('conflict-ordering');
    const memory = await loadUnifiedMemoryModule();
    const engine = new memory.UnifiedMemoryEngine({ dbPath });

    try {
      const older = await engine.add({
        content: 'Older memory content.',
        layer: memory.MemoryLayer.USER,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'ordering-test',
      });
      const newer = await engine.add({
        content: 'Newer memory content.',
        layer: memory.MemoryLayer.USER,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'ordering-test',
      });

      const db = (
        engine as unknown as {
          _db: {
            prepare: (sql: string) => { run: (...args: unknown[]) => unknown };
          };
        }
      )._db;

      await expect(
        engine.resolveConflict({
          memoryIdA: newer.id as string,
          memoryIdB: 'missing-memory',
        }),
      ).resolves.toEqual({
        status: 'error',
        error: 'Memory not found',
        missing: ['missing-memory'],
      });

      db.prepare('UPDATE memories SET superseded_by = NULL WHERE id IN (?, ?)').run(older.id, newer.id);

      await expect(
        engine.resolveConflict({
          memoryIdA: newer.id as string,
          memoryIdB: older.id as string,
          resolution: 'keep_old',
        }),
      ).resolves.toEqual({
        status: 'resolved',
        kept: older.id,
        removed: newer.id,
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('sorts search results even when injected result objects drop their score field', async () => {
    const { basePath, dbPath } = createDbPath('search-score-fallback');
    const memory = await loadUnifiedMemoryModule();
    const engine = new memory.UnifiedMemoryEngine({ dbPath });
    const runtime = engine as unknown as { _db: unknown };
    const realDb = runtime._db;
    const updateStatement = { run: vi.fn() };
    const memorySelectStatement = {
      columns: vi.fn(fullMemoryColumns),
      all: vi.fn(() => [
        fullMemoryRow('search-a', 'Array search result A'),
        fullMemoryRow('search-b', 'Array search result B'),
      ]),
    };
    const originalSort = Array.prototype.sort;

    try {
      vi.spyOn(engine.embedder, 'embedCached').mockReturnValue([1, 0, 0]);
      vi.spyOn(engine.embedder, 'similarity').mockReturnValue(0.9);

      runtime._db = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('UPDATE memories SET last_accessed_at')) return updateStatement;
          return memorySelectStatement;
        }),
      };

      let patchedResults = false;
      const sortSpy = vi.spyOn(Array.prototype, 'sort').mockImplementation(function (compareFn) {
        if (
          !patchedResults &&
          this.length > 0 &&
          this.every(
            (item) =>
              typeof item === 'object' &&
              item !== null &&
              'created_at' in (item as Record<string, unknown>) &&
              'content' in (item as Record<string, unknown>),
          )
        ) {
          patchedResults = true;
          for (const item of this as Array<Record<string, unknown>>) {
            delete item['score'];
          }
        }
        return originalSort.call(this, compareFn as typeof Array.prototype.sort) as typeof this;
      });

      const result = await engine.search({
        query: 'search fallback query',
        limit: 2,
        minScore: 0.1,
      });
      sortSpy.mockRestore();

      expect(result).toEqual([
        expect.not.objectContaining({ score: expect.anything() }),
        expect.not.objectContaining({ score: expect.anything() }),
      ]);
    } finally {
      runtime._db = realDb;
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});
