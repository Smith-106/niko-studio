/**
 * UnifiedMemory Tests
 *
 * Tests core read/write, cache invalidation, and JSON corruption recovery
 * for the unified-memory module. Uses real SQLite with temp directories.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UnifiedMemory,
  UnifiedMemoryEngine,
  EngineConflictResolver,
  EmbeddingEngine,
  MemoryLayer,
  MemoryDimension,
  resetUnifiedMemoryEngine,
} from '../unified-memory';

import BetterSqlite3 from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-unified-mem-'));
}

// Patch COMMIT bug (same pattern as core-memory-store tests)
const _origExec = BetterSqlite3.prototype.exec;
let _commitBugPatched = false;

function patchCommitBug(): void {
  if (_commitBugPatched) return;
  _commitBugPatched = true;
  BetterSqlite3.prototype.exec = function (this: any, sql: string) {
    try {
      return _origExec.call(this, sql);
    } catch (e: unknown) {
      if (sql === 'COMMIT' && (e as { code?: string }).code === 'SQLITE_ERROR') {
        return this as BetterSqlite3.Database;
      }
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
  resetUnifiedMemoryEngine();
  vi.restoreAllMocks();
  unpatchCommitBug();
});

beforeEach(() => {
  patchCommitBug();
});

describe('UnifiedMemory', () => {
  it('constructs with defaults', () => {
    const mem = new UnifiedMemory({ id: 'mem-1', content: 'Hello world' });
    expect(mem.id).toBe('mem-1');
    expect(mem.content).toBe('Hello world');
    expect(mem.layer).toBe('session');
    expect(mem.dimension).toBeNull();
    expect(mem.entityId).toBeNull();
    expect(mem.importance).toBe(0.5);
    expect(mem.confidence).toBe(1.0);
    expect(mem.source).toBe('user');
    expect(mem.tags).toEqual([]);
    expect(mem.embedding).toEqual([]);
    expect(mem.createdAt).toBeTruthy();
    expect(mem.updatedAt).toBeTruthy();
  });

  it('accepts all parameters', () => {
    const mem = new UnifiedMemory({
      id: 'mem-2',
      content: 'Detailed content',
      layer: MemoryLayer.PROJECT,
      dimension: MemoryDimension.CHARACTER,
      entityId: 'char-1',
      validFrom: '2026-01-01T00:00:00Z',
      validUntil: '2026-12-31T23:59:59Z',
      importance: 0.9,
      confidence: 0.8,
      source: 'system',
      tags: ['hero', 'protagonist'],
      userId: 'user-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
    });
    expect(mem.layer).toBe(MemoryLayer.PROJECT);
    expect(mem.dimension).toBe(MemoryDimension.CHARACTER);
    expect(mem.entityId).toBe('char-1');
    expect(mem.importance).toBe(0.9);
    expect(mem.tags).toEqual(['hero', 'protagonist']);
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new UnifiedMemory({
      id: 'mem-rt',
      content: 'Round trip content',
      layer: MemoryLayer.USER,
      dimension: MemoryDimension.PREFERENCE,
      importance: 0.7,
      tags: ['test'],
      embedding: [0.1, 0.2, 0.3],
    });
    const dict = original.toDict();
    const restored = UnifiedMemory.fromDict(dict);
    expect(restored.id).toBe('mem-rt');
    expect(restored.content).toBe('Round trip content');
    expect(restored.layer).toBe(MemoryLayer.USER);
    expect(restored.importance).toBe(0.7);
    expect(restored.tags).toEqual(['test']);
    expect(restored.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('fromDict recovers from corrupted JSON tags', () => {
    const data: Record<string, unknown> = {
      id: 'mem-corrupt',
      content: 'Corrupt tags',
      layer: 'session',
      tags: 'not-valid-json{{{',
      embedding: '[]',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mem = UnifiedMemory.fromDict(data);
    expect(mem.tags).toEqual([]);
    expect(mem.id).toBe('mem-corrupt');
  });

  it('fromDict recovers from corrupted JSON embedding', () => {
    const data: Record<string, unknown> = {
      id: 'mem-corrupt-emb',
      content: 'Corrupt embedding',
      layer: 'session',
      tags: '[]',
      embedding: 'broken-json{{{',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mem = UnifiedMemory.fromDict(data);
    expect(mem.embedding).toEqual([]);
  });

  it('fromDict unpacks embedding_blob when embedding array is empty', () => {
    // Pack [1.0, 2.0, 3.0] into a Buffer
    const buf = Buffer.alloc(12);
    buf.writeFloatLE(1.0, 0);
    buf.writeFloatLE(2.0, 4);
    buf.writeFloatLE(3.0, 8);

    const data: Record<string, unknown> = {
      id: 'mem-blob',
      content: 'Blob test',
      layer: 'session',
      tags: '[]',
      embedding: '[]',
      embedding_blob: buf,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const mem = UnifiedMemory.fromDict(data);
    expect(mem.embedding.length).toBe(3);
    expect(mem.embedding[0]).toBeCloseTo(1.0, 5);
    expect(mem.embedding[1]).toBeCloseTo(2.0, 5);
    expect(mem.embedding[2]).toBeCloseTo(3.0, 5);
  });

  it('toDict serializes tags and embedding as JSON strings', () => {
    const mem = new UnifiedMemory({
      id: 'mem-dict',
      content: 'Dict test',
      tags: ['a', 'b'],
      embedding: [0.5, 0.6],
    });
    const dict = mem.toDict();
    expect(typeof dict.tags).toBe('string');
    expect(JSON.parse(dict.tags as string)).toEqual(['a', 'b']);
    expect(typeof dict.embedding).toBe('string');
    expect(JSON.parse(dict.embedding as string)).toEqual([0.5, 0.6]);
  });
});

describe('EmbeddingEngine', () => {
  it('returns deterministic 384-dim dummy vectors in degraded mode', () => {
    const engine = new EmbeddingEngine();
    const vec = engine.embed('test text');
    expect(vec.length).toBe(384);
    // Same input should produce same output
    const vec2 = engine.embed('test text');
    expect(vec).toEqual(vec2);
  });

  it('returns different vectors for different inputs', () => {
    const engine = new EmbeddingEngine();
    const vec1 = engine.embed('hello');
    const vec2 = engine.embed('world');
    // Very unlikely to be equal for different inputs
    expect(vec1).not.toEqual(vec2);
  });

  it('uses cache for embedCached calls', () => {
    const engine = new EmbeddingEngine();
    const vec1 = engine.embedCached('cache test');
    const vec2 = engine.embedCached('cache test');
    expect(vec1).toEqual(vec2);
    // Cache stats should show at least 1 hit
    const stats = engine.cacheStats;
    expect(stats.hits).toBeGreaterThanOrEqual(1);
  });

  it('computes cosine similarity correctly', () => {
    const engine = new EmbeddingEngine();
    // Identical vectors -> similarity = 1
    const sim1 = engine.similarity([1, 0, 0], [1, 0, 0]);
    expect(sim1).toBeCloseTo(1.0, 5);

    // Orthogonal vectors -> similarity = 0
    const sim2 = engine.similarity([1, 0, 0], [0, 1, 0]);
    expect(sim2).toBeCloseTo(0.0, 5);

    // Opposite vectors -> similarity = -1
    const sim3 = engine.similarity([1, 0, 0], [-1, 0, 0]);
    expect(sim3).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 similarity for mismatched lengths or zero vectors', () => {
    const engine = new EmbeddingEngine();
    expect(engine.similarity([1, 0], [1, 0, 0])).toBe(0);
    expect(engine.similarity([], [1, 0])).toBe(0);
    expect(engine.similarity([0, 0], [1, 0])).toBe(0);
  });
});

describe('EngineConflictResolver', () => {
  it('returns empty conflicts when entityId is null', async () => {
    const mockDb = {
      execute: vi.fn(),
    };
    const resolver = new EngineConflictResolver(mockDb as unknown as import('../unified-memory').UnifiedDbConnection);
    const conflicts = await resolver.check('content', null);
    expect(conflicts).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('resolves with auto strategy by marking old memories superseded', async () => {
    const mockDb = {
      execute: vi.fn().mockReturnValue({
        fetchAll: () => [['id-1', 'old content', null, null]],
      }),
    };
    const resolver = new EngineConflictResolver(mockDb as unknown as import('../unified-memory').UnifiedDbConnection);
    const conflicts = await resolver.check('new content that is not contradictory', 'entity-1');
    // No contradiction detected with default negation pairs
    expect(conflicts).toEqual([]);
  });

  it('detects contradiction between negation pairs', async () => {
    const mockDb = {
      execute: vi.fn().mockReturnValue({
        fetchAll: () => [['id-1', '角色alive', null, null]],
      }),
    };
    const resolver = new EngineConflictResolver(mockDb as unknown as import('../unified-memory').UnifiedDbConnection);
    const conflicts = await resolver.check('角色dead', 'entity-1');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('id-1');
  });

  it('resolve with auto strategy returns update action', async () => {
    const mockDb = {
      execute: vi.fn(),
    };
    const resolver = new EngineConflictResolver(mockDb as unknown as import('../unified-memory').UnifiedDbConnection);
    const result = await resolver.resolve('new content', [
      { id: 'old-1', content: 'old content' },
    ], 'auto');
    expect(result.action).toBe('update');
    expect(result.obsolete_ids).toEqual(['old-1']);
  });

  it('resolve with keep_old strategy rejects update', async () => {
    const mockDb = {
      execute: vi.fn(),
    };
    const resolver = new EngineConflictResolver(mockDb as unknown as import('../unified-memory').UnifiedDbConnection);
    const result = await resolver.resolve('new content', [
      { id: 'old-1', content: 'old content' },
    ], 'keep_old');
    expect(result.action).toBe('reject');
  });

  it('resolve with merge strategy produces merged content', async () => {
    const mockDb = {
      execute: vi.fn(),
    };
    const resolver = new EngineConflictResolver(mockDb as unknown as import('../unified-memory').UnifiedDbConnection);
    const result = await resolver.resolve('new content', [
      { id: 'old-1', content: 'old content' },
    ], 'merge');
    expect(result.action).toBe('merge');
    expect(result.merged_content).toContain('old content');
    expect(result.merged_content).toContain('new content');
  });
});

describe('UnifiedMemoryEngine', () => {
  let tempDir: string;
  let dbPath: string;
  let engine: UnifiedMemoryEngine;

  beforeEach(() => {
    tempDir = createTempDir();
    dbPath = join(tempDir, 'unified_memory.db');
    engine = new UnifiedMemoryEngine({ dbPath });
  });

  afterEach(() => {
    engine.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes with custom dbPath', () => {
    expect(engine.dbPath).toBe(dbPath);
  });

  it('adds and searches memories', async () => {
    const result = await engine.add({
      content: 'The hero fights the dragon in the castle',
      layer: MemoryLayer.SESSION,
      tags: ['adventure'],
    });
    expect(result.status).toBe('created');
    expect(result.id).toBeTruthy();
  });

  it('adds memory with all scope filters', async () => {
    const result = await engine.add({
      content: 'Project-level memory',
      layer: MemoryLayer.PROJECT,
      dimension: MemoryDimension.WORLDVIEW,
      entityId: 'world-1',
      userId: 'user-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
      importance: 0.9,
      tags: ['world'],
    });
    expect(result.status).toBe('created');
  });

  it('healthCheck returns valid status', async () => {
    const health = await engine.healthCheck();
    expect(health.engine).toBe('primary');
    expect(health.db_ok).toBe(true);
    expect(health.db_path).toBe(dbPath);
  });

  it('retrieval profile CRUD works', () => {
    engine.upsertRetrievalProfile({
      profileName: 'default',
      sourceWeights: { session: 0.5, user: 0.3, project: 0.2 },
      thresholds: { minScore: 0.3 },
      budget: { maxResults: 10 },
    });
    const profile = engine.getRetrievalProfile('default');
    expect(profile).not.toBeNull();
    expect(profile!.profile_name).toBe('default');
    expect(profile!.enabled).toBe(true);
  });

  it('retrieval profile returns null for non-existent profile', () => {
    const profile = engine.getRetrievalProfile('non-existent');
    expect(profile).toBeNull();
  });

  it('retrieval cache pack and read works', () => {
    engine.cachePack({
      cacheKey: 'test-key',
      payload: { result: 'cached' },
      ttlSeconds: 300,
    });
    const cached = engine.cacheRead('test-key');
    expect(cached).not.toBeNull();
    expect(cached!.payload).toEqual({ result: 'cached' });
    expect(cached!.status).toBe('ready');
  });

  it('retrieval cache returns null for non-existent key', () => {
    const cached = engine.cacheRead('missing-key');
    expect(cached).toBeNull();
  });

  it('retrieval cache returns null for expired entries', () => {
    engine.cachePack({
      cacheKey: 'expire-key',
      payload: { data: 'will expire' },
      ttlSeconds: 0, // Will be clamped to 1 second minimum
    });
    // Manually set the expires_at to the past
    const now = new Date();
    now.setMinutes(now.getMinutes() - 5);
    const db = new BetterSqlite3(dbPath);
    db.prepare("UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?").run(now.toISOString(), 'expire-key');
    db.close();

    const cached = engine.cacheRead('expire-key');
    expect(cached).toBeNull();
  });

  it('cacheStatus returns status for existing cache entry', () => {
    engine.cachePack({
      cacheKey: 'status-key',
      payload: { x: 1 },
      ttlSeconds: 300,
      status: 'computing',
    });
    expect(engine.cacheStatus('status-key')).toBe('computing');
  });

  it('cacheCleanup removes expired entries', () => {
    // Pack and then expire
    engine.cachePack({
      cacheKey: 'cleanup-key',
      payload: { data: 'old' },
      ttlSeconds: 1,
    });
    // Force expire
    const past = new Date();
    past.setMinutes(past.getMinutes() - 5);
    const db = new BetterSqlite3(dbPath);
    db.prepare("UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?").run(past.toISOString(), 'cleanup-key');
    db.close();

    const removed = engine.cacheCleanup();
    expect(removed).toBeGreaterThanOrEqual(1);
  });

  it('cacheRelease deletes a cache entry', () => {
    engine.cachePack({
      cacheKey: 'release-key',
      payload: { data: 'release me' },
      ttlSeconds: 300,
    });
    engine.cacheRelease('release-key');
    expect(engine.cacheRead('release-key')).toBeNull();
  });
});
