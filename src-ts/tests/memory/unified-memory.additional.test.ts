import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as memory from '../../memory';
import {
  EmbeddingEngine,
  EngineConflictResolver,
  MemoryDimension,
  MemoryLayer,
  UnifiedMemory,
  UnifiedMemoryEngine,
  type UnifiedDbConnection,
} from '../../memory/unified-memory';

function createDbPath(label: string): { basePath: string; dbPath: string } {
  const basePath = join(tmpdir(), `niko-unified-memory-additional-${label}-${randomUUID()}`);
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
    MemoryLayer.SESSION,
    MemoryDimension.CONTEXT,
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

afterEach(() => {
  memory.resetUnifiedMemoryEngine();
  memory.setConfigProvider((_key, defaultValue) => defaultValue);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('UnifiedMemory additional branch coverage', () => {
  it('expires and evicts query-cache entries, then lazily recreates a missing cache', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const engine = new EmbeddingEngine();
    const key = `ttl-${randomUUID()}`;

    (engine as unknown as { _cache: null })._cache = null;
    const first = engine.embed(key, true);
    const afterPrime = { ...engine.cacheStats };

    vi.advanceTimersByTime(3_600_001);
    const second = engine.embed(key, true);
    const afterExpiry = { ...engine.cacheStats };

    for (let index = 0; index < 1_005; index += 1) {
      engine.embed(`evict-${randomUUID()}-${index}`, true);
    }

    expect(second).toEqual(first);
    expect(afterExpiry.misses).toBeGreaterThan(afterPrime.misses);
    expect(engine.cacheStats.size).toBeLessThanOrEqual(1_000);
  });

  it('unpacks empty and short embedding blobs while tolerating corrupted serialized fields', () => {
    const emptyBlobMemory = UnifiedMemory.fromDict({
      id: 'empty-blob',
      content: 'empty blob',
      layer: MemoryLayer.SESSION,
      tags: 'not json',
      embedding: 'not json',
      embedding_blob: Buffer.alloc(0),
    });
    const shortBlobMemory = UnifiedMemory.fromDict({
      id: 'short-blob',
      content: 'short blob',
      layer: MemoryLayer.SESSION,
      tags: '[]',
      embedding: [],
      embedding_blob: Buffer.from([1, 2]),
    });

    expect(emptyBlobMemory.tags).toEqual([]);
    expect(emptyBlobMemory.embedding).toEqual([]);
    expect(shortBlobMemory.embedding).toEqual([]);
  });

  it('covers conflict resolver reverse negations and empty merge conflicts', async () => {
    const db: UnifiedDbConnection = {
      execute: vi.fn().mockReturnValue({
        fetchAll: () => [['old-1', 'The hero is dead', null, null]],
      }),
    };
    const resolver = new EngineConflictResolver(db);

    await expect(resolver.check('The hero is alive', 'hero-1')).resolves.toEqual([
      expect.objectContaining({ id: 'old-1' }),
    ]);
    await expect(resolver.resolve('new info', [], 'merge')).resolves.toEqual({
      action: 'update',
      obsolete_ids: [],
    });
  });

  it('uses data_dir fallback in the constructor and supports null singleton reset', () => {
    const { basePath, dbPath } = createDbPath('constructor-config');
    const dataDir = join(basePath, 'data-dir');
    memory.setConfigProvider((key, defaultValue) => {
      if (key === 'memory.db_path') return null;
      if (key === 'data_dir') return dataDir;
      return defaultValue;
    });

    const engine = new UnifiedMemoryEngine();

    try {
      expect(engine.dbPath).toBe(join(dataDir, 'memory.db'));
      memory.resetUnifiedMemoryEngine();
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }

    expect(dbPath.endsWith('memory.db')).toBe(true);
  });

  it('maps array and object rows through the private database adapter', () => {
    const { basePath, dbPath } = createDbPath('db-adapter');
    const engine = new UnifiedMemoryEngine({ dbPath });
    const runtime = engine as unknown as {
      _db: unknown;
      _createDbAdapter(): UnifiedDbConnection;
    };
    const realDb = runtime._db;
    const statement = {
      columns: vi.fn(() => [{ name: 'id' }, { name: 'content' }]),
      all: vi.fn(() => [
        ['array-id', 'array content'],
        { id: 'object-id', content: 'object content' },
      ]),
    };

    try {
      runtime._db = {
        prepare: vi.fn(() => statement),
      };

      expect(runtime._createDbAdapter().execute('SELECT id, content FROM memories').fetchAll()).toEqual([
        ['array-id', 'array content'],
        ['object-id', 'object content'],
      ]);
    } finally {
      runtime._db = realDb;
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('handles array-row search, temporal lookup, memory lookup, and duplicate conflict pairs', async () => {
    const { basePath, dbPath } = createDbPath('array-rows');
    const engine = new UnifiedMemoryEngine({ dbPath });
    const runtime = engine as unknown as {
      _db: unknown;
      _getMemoryById(memoryId: string): UnifiedMemory | null;
    };
    const realDb = runtime._db;
    const updateStatement = { run: vi.fn() };
    const memorySelectStatement = {
      columns: vi.fn(fullMemoryColumns),
      all: vi.fn(() => [
        fullMemoryRow('search-a', 'Array search result A'),
        fullMemoryRow('search-b', 'Array search result B'),
        fullMemoryRow('search-c', 'Array search result C short blob fallback', Buffer.from([1, 2])),
      ]),
      get: vi.fn(() => fullMemoryRow('lookup-id', 'Lookup content')),
    };
    const temporalStatement = {
      all: vi.fn(() => [['temporal-id', 'Temporal content', MemoryDimension.CONTEXT, null, null, 0.7]]),
    };
    const conflictStatement = {
      all: vi.fn(() => [
        ['conflict-a', 'Alice is dead and false.', null, null],
        ['conflict-b', 'Alice is alive and true but also false.', null, null],
      ]),
    };

    try {
      vi.spyOn(engine.embedder, 'embedCached').mockReturnValue([1, 0, 0]);
      vi.spyOn(engine.embedder, 'similarity').mockReturnValueOnce(0.9).mockReturnValueOnce(0.5);
      runtime._db = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('UPDATE memories SET last_accessed_at')) return updateStatement;
          if (sql.includes('SELECT * FROM memories')) return memorySelectStatement;
          if (sql.includes('SELECT id, content, dimension')) return temporalStatement;
          if (sql.includes('SELECT id, content, valid_from, valid_until')) return conflictStatement;
          if (sql.includes('WHERE id = ?')) return memorySelectStatement;
          return updateStatement;
        }),
      };

      await expect(engine.search({ query: 'array query', limit: 2, minScore: 0.1 })).resolves.toEqual([
        expect.objectContaining({ id: 'search-a', score: 0.9 }),
        expect.objectContaining({ id: 'search-b', score: 0.5 }),
      ]);
      await expect(engine.getTemporalFacts({ entityId: 'entity-array-row' })).resolves.toEqual([
        {
          id: 'temporal-id',
          content: 'Temporal content',
          dimension: MemoryDimension.CONTEXT,
          valid_from: null,
          valid_until: null,
          importance: 0.7,
        },
      ]);
      expect(runtime._getMemoryById('lookup-id')).toEqual(expect.objectContaining({
        id: 'lookup-id',
        content: 'Lookup content',
      }));
      await expect(engine.detectConflicts('entity-array-row')).resolves.toHaveLength(1);
    } finally {
      runtime._db = realDb;
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers keep-a and keep-b conflict resolution strategies', async () => {
    const { basePath, dbPath } = createDbPath('keep-a-b');
    const engine = new UnifiedMemoryEngine({ dbPath });

    try {
      const first = await engine.add({
        content: 'First conflict memory.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'keep-a-b',
      });
      const second = await engine.add({
        content: 'Second conflict memory.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'keep-a-b',
      });
      const third = await engine.add({
        content: 'Third conflict memory.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'keep-a-b',
      });

      await expect(engine.resolveConflict({
        memoryIdA: first.id as string,
        memoryIdB: second.id as string,
        resolution: 'keep_a',
      })).resolves.toEqual({
        status: 'resolved',
        kept: first.id,
        removed: second.id,
      });
      await expect(engine.resolveConflict({
        memoryIdA: first.id as string,
        memoryIdB: third.id as string,
        resolution: 'keep_b',
      })).resolves.toEqual({
        status: 'resolved',
        kept: third.id,
        removed: first.id,
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('tolerates corrupted profile and cache JSON and maps array cache status rows', () => {
    const { basePath, dbPath } = createDbPath('profile-cache');
    const engine = new UnifiedMemoryEngine({ dbPath });
    const runtime = engine as unknown as { _db: { prepare(sql: string): { run?: (...params: unknown[]) => unknown } } };

    try {
      engine.upsertRetrievalProfile({
        profileName: 'corrupt-profile',
        sourceWeights: null as unknown as Record<string, unknown>,
        thresholds: null as unknown as Record<string, unknown>,
        budget: null as unknown as Record<string, unknown>,
        enabled: false,
      });
      runtime._db
        .prepare('UPDATE retrieval_profiles SET source_weights_json = ?, thresholds_json = ?, budget_json = ? WHERE profile_name = ?')
        .run?.('bad-source', 'bad-thresholds', 'bad-budget', 'corrupt-profile');

      engine.cachePack({ cacheKey: 'corrupt-cache', payload: null as unknown as Record<string, unknown>, ttlSeconds: 1, status: 'pending' });
      runtime._db
        .prepare('UPDATE retrieval_cache SET payload_json = ?, hit_count = NULL WHERE cache_key = ?')
        .run?.('bad-cache', 'corrupt-cache');

      expect(engine.getRetrievalProfile('corrupt-profile')).toMatchObject({
        profile_name: 'corrupt-profile',
        source_weights_json: {},
        thresholds_json: {},
        budget_json: {},
        enabled: false,
      });
      expect(engine.cacheRead('corrupt-cache')).toMatchObject({
        payload: {},
        status: 'pending',
        hit_count: 1,
      });

      const realDb = runtime._db;
      try {
        runtime._db = {
          prepare: vi.fn((sql: string) => {
            if (sql.includes('SELECT profile_name')) {
              return { get: vi.fn(() => ['array-profile', '{}', '{}', '{}', 1, 'updated']) };
            }
            if (sql.includes('SELECT payload_json')) {
              return { get: vi.fn(() => ['{}', 'ready', null, 2]) };
            }
            if (sql.includes('SELECT status')) {
              return { get: vi.fn(() => ['array-ready']) };
            }
            return { run: vi.fn() };
          }),
        } as unknown as typeof realDb;

        expect(engine.getRetrievalProfile('array-profile')).toMatchObject({
          profile_name: 'array-profile',
          enabled: true,
        });
        expect(engine.cacheRead('array-cache')).toMatchObject({
          status: 'ready',
          hit_count: 3,
        });
        expect(engine.cacheStatus('array-cache')).toBe('array-ready');
      } finally {
        runtime._db = realDb;
      }
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers cache overwrite, empty embeddings, missing profiles, and singleton reuse', async () => {
    const { basePath, dbPath } = createDbPath('cache-empty-singleton');
    const engine = new UnifiedMemoryEngine({ dbPath });

    try {
      const cacheOwner = new EmbeddingEngine();
      const cache = (cacheOwner as unknown as { _cache: {
        constructor: new (maxSize: number, ttlSeconds: number) => {
          put(query: string, embedding: number[]): void;
          get(query: string): number[] | null;
        };
        put(query: string, embedding: number[]): void;
        get(query: string): number[] | null;
      } })._cache;
      cache.put('duplicate-query', [1]);
      cache.put('duplicate-query', [2]);
      expect(cache.get('duplicate-query')).toEqual([2]);

      const zeroCapacityCache = new cache.constructor(0, 3600);
      zeroCapacityCache.put('cannot-store-before-break', [3]);
      expect(zeroCapacityCache.get('cannot-store-before-break')).toEqual([3]);

      const lazyStatsOwner = new EmbeddingEngine();
      (lazyStatsOwner as unknown as { _cache: null })._cache = null;
      expect(lazyStatsOwner.cacheStats.max_size).toBe(1_000);

      vi.spyOn(engine.embedder, 'embed').mockReturnValueOnce([]);
      await expect(engine.add({
        content: 'Empty embedding still stores a valid memory.',
        layer: MemoryLayer.SESSION,
        entityId: 'empty-embedding',
      })).resolves.toMatchObject({ status: 'created' });

      expect(engine.getRetrievalProfile('missing-profile')).toBeNull();

      const firstSingleton = memory.getUnifiedMemoryEngine({ dbPath: join(basePath, 'singleton-a.db') });
      const secondSingleton = memory.getUnifiedMemoryEngine({ dbPath: join(basePath, 'singleton-b.db') });
      expect(secondSingleton).toBe(firstSingleton);
    } finally {
      memory.resetUnifiedMemoryEngine();
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('rejects additions when the conflict resolver keeps existing information', async () => {
    const { basePath, dbPath } = createDbPath('reject-conflict');
    const engine = new UnifiedMemoryEngine({ dbPath });

    try {
      vi.spyOn(engine.conflictResolver, 'check').mockResolvedValueOnce([
        { id: 'existing-memory', content: 'Alice is alive.' },
      ]);
      vi.spyOn(engine.conflictResolver, 'resolve').mockResolvedValueOnce({
        action: 'reject',
        reason: 'Keeping existing information',
      });

      await expect(engine.add({
        content: 'Alice is dead.',
        entityId: 'alice-reject',
      })).resolves.toEqual({
        status: 'rejected',
        reason: 'Keeping existing information',
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('uses homedir fallback when no configured memory paths are available', async () => {
    const { basePath } = createDbPath('home-fallback');

    vi.resetModules();
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        homedir: () => basePath,
      };
    });

    const isolated = await import('../../memory/unified-memory');
    isolated.setConfigProvider((_key, defaultValue) => defaultValue);
    const engine = new isolated.UnifiedMemoryEngine();

    try {
      expect(engine.dbPath).toBe(join(basePath, '.niko', 'memory.db'));
    } finally {
      engine.close();
      isolated.resetUnifiedMemoryEngine();
      vi.doUnmock('node:os');
      vi.resetModules();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers object-row cache status and blank serialized retrieval fields', () => {
    const { basePath, dbPath } = createDbPath('blank-profile-cache');
    const engine = new UnifiedMemoryEngine({ dbPath });
    const runtime = engine as unknown as { _db: unknown };
    const realDb = runtime._db;

    try {
      runtime._db = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT profile_name')) {
            return { get: vi.fn(() => ['blank-profile', '', '', '', 0, 'updated']) };
          }
          if (sql.includes('SELECT payload_json')) {
            return { get: vi.fn(() => ['', 'blank', null, null]) };
          }
          if (sql.includes('SELECT status')) {
            return { get: vi.fn(() => ({ status: 'object-ready' })) };
          }
          return { run: vi.fn() };
        }),
      };

      expect(engine.getRetrievalProfile('blank-profile')).toMatchObject({
        profile_name: 'blank-profile',
        source_weights_json: {},
        thresholds_json: {},
        budget_json: {},
        enabled: false,
      });
      expect(engine.cacheRead('blank-cache')).toMatchObject({
        payload: {},
        status: 'blank',
        hit_count: 1,
      });
      expect(engine.cacheStatus('object-cache')).toBe('object-ready');

      runtime._db = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT status')) {
            return { get: vi.fn(() => [null]) };
          }
          return { run: vi.fn() };
        }),
      };
      expect(engine.cacheStatus('null-array-cache')).toBeNull();

      runtime._db = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT status')) {
            return { get: vi.fn(() => ({ status: null })) };
          }
          return { run: vi.fn() };
        }),
      };
      expect(engine.cacheStatus('null-object-cache')).toBeNull();
    } finally {
      runtime._db = realDb;
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('covers non-candidate conflicts, missing both memories, and merge fallback metadata', async () => {
    const { basePath, dbPath } = createDbPath('conflict-merge-branches');
    const engine = new UnifiedMemoryEngine({ dbPath });
    const runtime = engine as unknown as {
      _db: unknown;
      _getMemoryById(memoryId: string): UnifiedMemory | null;
      _store(memory: UnifiedMemory): void;
      _runPostgresShadowWrite(memory: UnifiedMemory): Promise<void>;
      _notifyPlugins(memory: UnifiedMemory): Promise<void>;
      _markSuperseded(memoryId: string, supersededBy?: string | null): Promise<void>;
    };
    const realDb = runtime._db;
    let storedMerged: UnifiedMemory | null = null;

    try {
      runtime._db = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT id, content, valid_from, valid_until')) {
            return {
              all: vi.fn(() => [
                { id: 'plain-a', content: 'Alice visits the archive.', valid_from: null, valid_until: null },
                { id: 'plain-b', content: 'Bob writes a note.', valid_from: null, valid_until: null },
              ]),
            };
          }
          return { run: vi.fn(), get: vi.fn(), columns: vi.fn(fullMemoryColumns), all: vi.fn(() => []) };
        }),
      };

      await expect(engine.detectConflicts('plain-entity')).resolves.toEqual([]);

      runtime._db = realDb;
      await expect(engine.resolveConflict({
        memoryIdA: 'missing-a',
        memoryIdB: 'missing-b',
      })).resolves.toEqual({
        status: 'error',
        error: 'Memory not found',
        missing: ['missing-a', 'missing-b'],
      });

      const older = new UnifiedMemory({
        id: 'older-memory',
        content: 'Older content has fallback metadata.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'older-entity',
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T00:00:00.000Z',
        userId: 'older-user',
        projectId: 'older-project',
        sessionId: 'older-session',
        importance: 0.8,
        confidence: 0.7,
        tags: ['older'],
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const newer = new UnifiedMemory({
        id: 'newer-memory',
        content: 'Newer content leaves metadata sparse.',
        layer: MemoryLayer.USER,
        dimension: null,
        entityId: null,
        validFrom: null,
        validUntil: null,
        userId: null,
        projectId: null,
        sessionId: null,
        importance: 0.4,
        confidence: 0.9,
        tags: ['newer'],
        createdAt: '2026-02-01T00:00:00.000Z',
      });

      vi.spyOn(runtime, '_getMemoryById').mockImplementation((memoryId: string) => {
        if (memoryId === older.id) return older;
        if (memoryId === newer.id) return newer;
        return null;
      });
      vi.spyOn(runtime, '_store').mockImplementation((memoryToStore: UnifiedMemory) => {
        storedMerged = memoryToStore;
      });
      vi.spyOn(runtime, '_runPostgresShadowWrite').mockResolvedValue();
      vi.spyOn(runtime, '_notifyPlugins').mockResolvedValue();
      vi.spyOn(runtime, '_markSuperseded').mockResolvedValue();

      await expect(engine.resolveConflict({
        memoryIdA: older.id,
        memoryIdB: newer.id,
        resolution: 'merge',
      })).resolves.toMatchObject({
        status: 'resolved',
        removed: [older.id, newer.id],
      });

      expect(storedMerged).toMatchObject({
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'older-entity',
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T00:00:00.000Z',
        userId: 'older-user',
        projectId: 'older-project',
        sessionId: 'older-session',
        importance: 0.8,
        confidence: 0.9,
        source: 'user',
        tags: ['older', 'newer'],
      });

      const sparseOlder = new UnifiedMemory({
        id: 'sparse-older',
        content: 'Sparse older content.',
        layer: MemoryLayer.PROJECT,
        validFrom: null,
        validUntil: null,
        createdAt: '2026-03-01T00:00:00.000Z',
      });
      const sparseNewer = new UnifiedMemory({
        id: 'sparse-newer',
        content: 'Sparse newer content.',
        layer: MemoryLayer.USER,
        validFrom: null,
        validUntil: null,
        createdAt: '2026-04-01T00:00:00.000Z',
      });

      vi.mocked(runtime._getMemoryById).mockImplementation((memoryId: string) => {
        if (memoryId === sparseOlder.id) return sparseOlder;
        if (memoryId === sparseNewer.id) return sparseNewer;
        return null;
      });

      await engine.resolveConflict({
        memoryIdA: sparseOlder.id,
        memoryIdB: sparseNewer.id,
        resolution: 'merge',
      });

      expect(storedMerged?.validFrom).toEqual(expect.any(String));
    } finally {
      runtime._db = realDb;
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});
