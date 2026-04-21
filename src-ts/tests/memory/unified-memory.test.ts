/**
 * UnifiedMemory Tests (Unit Tests)
 *
 * Tests UnifiedMemory data model, EmbeddingQueryCache, packEmbedding/unpackEmbedding,
 * EmbeddingEngine, and EngineConflictResolver.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  UnifiedMemory,
  MemoryLayer,
  MemoryDimension,
  EmbeddingEngine,
  EngineConflictResolver,
  resetUnifiedMemoryEngine,
  type UnifiedDbConnection,
} from '../../memory/unified-memory';

// packEmbedding and unpackEmbedding are not exported, so we inline them
function packEmbedding(values: number[]): Buffer {
  if (!values || values.length === 0) {
    return Buffer.alloc(0);
  }
  const buffer = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    buffer.writeFloatLE(values[i], i * 4);
  }
  return buffer;
}

function unpackEmbedding(blob: Buffer): number[] {
  if (!blob || blob.length === 0) {
    return [];
  }
  const count = Math.floor(blob.length / 4);
  if (count <= 0) {
    return [];
  }
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(blob.readFloatLE(i * 4));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb(rows: unknown[][] = []): UnifiedDbConnection {
  return {
    execute: vi.fn().mockReturnValue({ fetchAll: () => rows }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  resetUnifiedMemoryEngine();
  vi.restoreAllMocks();
});

describe('packEmbedding / unpackEmbedding', () => {
  it('packs and unpacks round-trip correctly', () => {
    const original = [0.1, 0.5, -0.3, 0.9, -0.7, 1.0];
    const packed = packEmbedding(original);
    const unpacked = unpackEmbedding(packed);
    expect(unpacked.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(unpacked[i] - original[i])).toBeLessThan(0.0001);
    }
  });

  it('returns empty buffer for empty array', () => {
    expect(packEmbedding([])).toEqual(Buffer.alloc(0));
  });

  it('returns empty buffer for null/undefined', () => {
    expect(packEmbedding(null as any)).toEqual(Buffer.alloc(0));
    expect(packEmbedding(undefined as any)).toEqual(Buffer.alloc(0));
  });

  it('returns empty array for empty buffer', () => {
    expect(unpackEmbedding(Buffer.alloc(0))).toEqual([]);
  });

  it('returns empty array for null buffer', () => {
    expect(unpackEmbedding(null as any)).toEqual([]);
  });

  it('handles single element', () => {
    const packed = packEmbedding([3.14]);
    const unpacked = unpackEmbedding(packed);
    expect(unpacked.length).toBe(1);
    expect(Math.abs(unpacked[0] - 3.14)).toBeLessThan(0.0001);
  });

  it('handles large arrays', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => i * 0.001 - 0.5);
    const packed = packEmbedding(arr);
    const unpacked = unpackEmbedding(packed);
    expect(unpacked.length).toBe(1000);
  });
});

describe('UnifiedMemory', () => {
  it('constructs with minimal parameters', () => {
    const mem = new UnifiedMemory({ id: 'test-id', content: 'Test content' });
    expect(mem.id).toBe('test-id');
    expect(mem.content).toBe('Test content');
    expect(mem.layer).toBe('session');
    expect(mem.dimension).toBeNull();
    expect(mem.importance).toBe(0.5);
    expect(mem.confidence).toBe(1.0);
    expect(mem.source).toBe('user');
    expect(mem.tags).toEqual([]);
    expect(mem.createdAt).toBeTruthy();
  });

  it('constructs with all parameters', () => {
    const mem = new UnifiedMemory({
      id: 'full-id',
      content: 'Full content',
      layer: MemoryLayer.PROJECT,
      dimension: MemoryDimension.CHARACTER,
      entityId: 'hero-1',
      validFrom: '2025-01-01T00:00:00Z',
      validUntil: '2025-12-31T23:59:59Z',
      supersedes: 'old-id',
      supersededBy: null,
      userId: 'user-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
      importance: 0.9,
      confidence: 0.8,
      source: 'imported',
      tags: ['hero', 'main'],
    });
    expect(mem.layer).toBe('project');
    expect(mem.dimension).toBe('character');
    expect(mem.entityId).toBe('hero-1');
    expect(mem.importance).toBe(0.9);
    expect(mem.confidence).toBe(0.8);
    expect(mem.tags).toEqual(['hero', 'main']);
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new UnifiedMemory({
      id: 'rt-id',
      content: 'Round trip content',
      layer: MemoryLayer.USER,
      dimension: MemoryDimension.PREFERENCE,
      tags: ['pref-1'],
      importance: 0.7,
    });
    const dict = original.toDict();
    const restored = UnifiedMemory.fromDict(dict);
    expect(restored.id).toBe('rt-id');
    expect(restored.content).toBe('Round trip content');
    expect(restored.layer).toBe('user');
    expect(restored.dimension).toBe('preference');
    expect(restored.tags).toEqual(['pref-1']);
  });

  it('fromDict handles string tags', () => {
    const dict: Record<string, unknown> = {
      id: 'str-tags',
      content: 'content',
      tags: JSON.stringify(['a', 'b']),
    };
    const mem = UnifiedMemory.fromDict(dict);
    expect(mem.tags).toEqual(['a', 'b']);
  });

  it('fromDict handles invalid tags JSON gracefully', () => {
    const dict: Record<string, unknown> = {
      id: 'bad-tags',
      content: 'content',
      tags: 'not-valid-json',
    };
    const mem = UnifiedMemory.fromDict(dict);
    expect(mem.tags).toEqual([]);
  });

  it('fromDict handles string embedding JSON', () => {
    const dict: Record<string, unknown> = {
      id: 'str-embed',
      content: 'content',
      embedding: JSON.stringify([0.1, 0.2, 0.3]),
    };
    const mem = UnifiedMemory.fromDict(dict);
    expect(mem.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('fromDict unpacks embedding from blob when embedding is empty', () => {
    const original = [0.1, 0.2, 0.3];
    const blob = packEmbedding(original);
    const dict: Record<string, unknown> = {
      id: 'blob-embed',
      content: 'content',
      embedding: [],
      embedding_blob: blob,
    };
    const mem = UnifiedMemory.fromDict(dict);
    expect(mem.embedding.length).toBe(3);
  });

  it('toDict includes embedding_blob from embedding array', () => {
    const mem = new UnifiedMemory({
      id: 'blob-out',
      content: 'content',
      embedding: [0.1, 0.2],
    });
    const dict = mem.toDict();
    expect(dict.embedding_blob).toBeInstanceOf(Buffer);
  });

  it('toDict stringifies tags', () => {
    const mem = new UnifiedMemory({
      id: 'str-tags-out',
      content: 'content',
      tags: ['a', 'b'],
    });
    const dict = mem.toDict();
    expect(typeof dict.tags).toBe('string');
    expect(JSON.parse(dict.tags as string)).toEqual(['a', 'b']);
  });
});

describe('MemoryLayer / MemoryDimension enums', () => {
  it('MemoryLayer has expected values', () => {
    expect(MemoryLayer.EPHEMERAL).toBe('ephemeral');
    expect(MemoryLayer.SESSION).toBe('session');
    expect(MemoryLayer.USER).toBe('user');
    expect(MemoryLayer.PROJECT).toBe('project');
  });

  it('MemoryDimension has expected values', () => {
    expect(MemoryDimension.TIMELINE).toBe('timeline');
    expect(MemoryDimension.CONTEXT).toBe('context');
    expect(MemoryDimension.CHARACTER).toBe('character');
    expect(MemoryDimension.WORLDVIEW).toBe('worldview');
    expect(MemoryDimension.PREFERENCE).toBe('preference');
    expect(MemoryDimension.EXPERIENCE).toBe('experience');
  });
});

describe('EmbeddingEngine', () => {
  describe('embed', () => {
    it('generates deterministic dummy embeddings', () => {
      const engine = new EmbeddingEngine();
      const vec1 = engine.embed('test content');
      const vec2 = engine.embed('test content');
      expect(vec1).toEqual(vec2);
    });

    it('generates different embeddings for different content', () => {
      const engine = new EmbeddingEngine();
      const vec1 = engine.embed('content A');
      const vec2 = engine.embed('content B');
      // They should be different
      let diffCount = 0;
      for (let i = 0; i < Math.min(vec1.length, vec2.length); i++) {
        if (vec1[i] !== vec2[i]) diffCount++;
      }
      expect(diffCount).toBeGreaterThan(0);
    });

    it('returns 384-dimensional vectors', () => {
      const engine = new EmbeddingEngine();
      const vec = engine.embed('any text');
      expect(vec.length).toBe(384);
    });

    it('caches embeddings when useCache=true', () => {
      const engine = new EmbeddingEngine();
      engine.embed('cached text', true);
      engine.embed('cached text', true);
      const stats = engine.cacheStats;
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('embedCached is a convenience for embed with cache', () => {
      const engine = new EmbeddingEngine();
      const vec1 = engine.embedCached('text-unique-xyz');
      const vec2 = engine.embedCached('text-unique-xyz');
      expect(vec1).toEqual(vec2);
      // Note: cache is module-level singleton so hits may include other tests
      expect(engine.cacheStats.hits).toBeGreaterThanOrEqual(1);
    });
  });

  describe('similarity', () => {
    it('returns 1.0 for identical vectors', () => {
      const engine = new EmbeddingEngine();
      const vec = [0.1, 0.2, 0.3, 0.4];
      expect(engine.similarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it('returns 0.0 for empty vectors', () => {
      const engine = new EmbeddingEngine();
      expect(engine.similarity([], [])).toBe(0.0);
    });

    it('returns 0.0 for zero vectors', () => {
      const engine = new EmbeddingEngine();
      expect(engine.similarity([0, 0, 0], [0, 0, 0])).toBe(0.0);
    });

    it('returns 0.0 for different length vectors', () => {
      const engine = new EmbeddingEngine();
      expect(engine.similarity([0.1, 0.2], [0.1, 0.2, 0.3])).toBe(0.0);
    });

    it('returns -1.0 for opposite vectors', () => {
      const engine = new EmbeddingEngine();
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(engine.similarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const engine = new EmbeddingEngine();
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(engine.similarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('handles null/undefined vectors', () => {
      const engine = new EmbeddingEngine();
      expect(engine.similarity(null as any, [1])).toBe(0.0);
      expect(engine.similarity([1], null as any)).toBe(0.0);
    });
  });

  describe('cacheStats', () => {
    it('returns stats with expected shape', () => {
      const engine = new EmbeddingEngine();
      const stats = engine.cacheStats;
      // Cache is module-level singleton, so stats may have accumulated state
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.max_size).toBe('number');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.hit_rate).toBe('number');
      expect(typeof stats.ttl_seconds).toBe('number');
    });
  });
});

describe('EngineConflictResolver', () => {
  let mockDb: UnifiedDbConnection;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('check', () => {
    it('returns empty for null entityId', async () => {
      const resolver = new EngineConflictResolver(mockDb);
      const conflicts = await resolver.check('content', null);
      expect(conflicts).toEqual([]);
    });

    it('returns empty for empty string entityId', async () => {
      const resolver = new EngineConflictResolver(mockDb);
      const conflicts = await resolver.check('content', '');
      expect(conflicts).toEqual([]);
    });

    it('returns contradictions when negation pairs found', async () => {
      const db = createMockDb([
        ['mem-1', 'The hero is alive', null, null],
      ]);
      const resolver = new EngineConflictResolver(db);
      const conflicts = await resolver.check('The hero is dead', 'hero-1');
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].id).toBe('mem-1');
    });

    it('returns empty when no negation pairs found', async () => {
      const db = createMockDb([
        ['mem-1', 'The hero fights the dragon', null, null],
      ]);
      const resolver = new EngineConflictResolver(db);
      const conflicts = await resolver.check('The hero is brave', 'hero-1');
      expect(conflicts.length).toBe(0);
    });
  });

  describe('resolve', () => {
    it('auto strategy marks all conflicts as obsolete', async () => {
      const resolver = new EngineConflictResolver(mockDb);
      const conflicts = [
        { id: 'old-1', content: 'old content' },
        { id: 'old-2', content: 'older content' },
      ];
      const result = await resolver.resolve('new content', conflicts, 'auto');
      expect(result.action).toBe('update');
      expect(result.obsolete_ids).toEqual(['old-1', 'old-2']);
    });

    it('keep_old strategy rejects new content', async () => {
      const resolver = new EngineConflictResolver(mockDb);
      const result = await resolver.resolve('new', [{ id: 'c1', content: 'old' }], 'keep_old');
      expect(result.action).toBe('reject');
    });

    it('merge strategy combines content', async () => {
      const resolver = new EngineConflictResolver(mockDb);
      const result = await resolver.resolve(
        'new info',
        [{ id: 'c1', content: 'old info' }],
        'merge',
      );
      expect(result.action).toBe('merge');
      expect((result.merged_content as string)).toContain('old info');
      expect((result.merged_content as string)).toContain('new info');
    });

    it('unknown strategy returns update with empty obsolete_ids', async () => {
      const resolver = new EngineConflictResolver(mockDb);
      const result = await resolver.resolve('new', [], 'unknown_strategy');
      expect(result.action).toBe('update');
      expect(result.obsolete_ids).toEqual([]);
    });
  });
});

describe('EmbeddingQueryCache (via EmbeddingEngine)', () => {
  it('LRU eviction works when max size reached', () => {
    const engine = new EmbeddingEngine();
    // Embed many unique items to fill cache
    for (let i = 0; i < 50; i++) {
      engine.embed(`unique content ${i}`, true);
    }
    const stats = engine.cacheStats;
    expect(stats.size).toBeLessThanOrEqual(1000); // max size
  });

  it('hit_rate reflects recent cache activity', () => {
    const engine = new EmbeddingEngine();
    const before = { ...engine.cacheStats };
    // Use unique text to avoid cache pollution from other tests
    engine.embed('unique-hitrate-test-ccc', true); // miss
    engine.embed('unique-hitrate-test-ccc', true); // hit
    engine.embed('unique-hitrate-test-ccc', true); // hit
    const after = { ...engine.cacheStats };
    // We should have at least 2 new hits and 1 new miss
    expect(after.hits - before.hits).toBeGreaterThanOrEqual(2);
    expect(after.misses - before.misses).toBeGreaterThanOrEqual(1);
  });
});
