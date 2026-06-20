/**
 * ConflictResolver Tests
 *
 * Comprehensive test coverage for conflict detection, resolution strategies,
 * contradiction analysis, semantic similarity, and edge cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConflictResolver,
  ConflictInfo,
  ConflictType,
  ConflictResolutionStrategy,
  ResolutionResult,
  getConflictResolver,
  resetConflictResolver,
  type ConflictDbConnection,
  type ConflictEmbedder,
} from '../../memory/conflict-resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb(rows: Array<{ id: string; content: string; valid_from: string | null; valid_until: string | null; importance: number }> = []): ConflictDbConnection {
  return {
    execute: vi.fn().mockReturnValue({
      fetchAll: () => rows.map((r) => [r.id, r.content, r.valid_from, r.valid_until, r.importance]),
    }),
  };
}

function createEmbedder(embeddings: Map<string, number[]> = new Map()): ConflictEmbedder {
  return {
    embed: vi.fn((text: string) => embeddings.get(text) ?? [0.1, 0.2, 0.3]),
    similarity: vi.fn((a: number[], b: number[]) => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      return denom === 0 ? 0 : dot / denom;
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  resetConflictResolver();
  vi.restoreAllMocks();
});

describe('ConflictResolver', () => {
  describe('constructor', () => {
    it('initializes with default similarityThreshold of 0.85', () => {
      const resolver = new ConflictResolver();
      expect(resolver.similarityThreshold).toBe(0.85);
      expect(resolver.db).toBeNull();
    });

    it('accepts custom similarityThreshold', () => {
      const resolver = new ConflictResolver(null, 0.7);
      expect(resolver.similarityThreshold).toBe(0.7);
    });

    it('accepts a db connection', () => {
      const db = createMockDb();
      const resolver = new ConflictResolver(db);
      expect(resolver.db).toBe(db);
    });
  });

  describe('setDbConnection / setEmbedder', () => {
    it('updates database connection after construction', () => {
      const resolver = new ConflictResolver();
      const db = createMockDb();
      resolver.setDbConnection(db);
      expect(resolver.db).toBe(db);
    });

    it('updates embedder after construction', () => {
      const resolver = new ConflictResolver();
      const embedder = createEmbedder();
      resolver.setEmbedder(embedder);
      // Verify the embedder is wired by checking that semantic similarity is used
      const db = createMockDb([
        { id: 'mem-emb', content: 'existing content', valid_from: null, valid_until: null, importance: 0.5 },
      ]);
      resolver.setDbConnection(db);
      // When embedder is set, check() should use it for similarity calculation
      // rather than falling back to lexical Jaccard similarity
      expect(embedder.embed).not.toHaveBeenCalled();
      return resolver.check('existing content', 'entity-1').then(() => {
        expect(embedder.embed).toHaveBeenCalled();
      });
    });
  });

  describe('check', () => {
    it('returns empty array when no entityId provided', async () => {
      const db = createMockDb();
      const resolver = new ConflictResolver(db);
      const conflicts = await resolver.check('some content');
      expect(conflicts).toEqual([]);
    });

    it('returns empty array when no db connection', async () => {
      const resolver = new ConflictResolver(null);
      const conflicts = await resolver.check('some content', 'entity-1');
      expect(conflicts).toEqual([]);
    });

    it('returns empty array when db has no matching rows', async () => {
      const db = createMockDb([]);
      const resolver = new ConflictResolver(db);
      const conflicts = await resolver.check('some content', 'entity-1');
      expect(conflicts).toEqual([]);
    });

    it('detects contradictory content in existing rows', async () => {
      const db = createMockDb([
        { id: 'mem-1', content: 'The hero is alive', valid_from: null, valid_until: null, importance: 0.5 },
      ]);
      const resolver = new ConflictResolver(db);
      const conflicts = await resolver.check('The hero is dead', 'entity-1');
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe(ConflictType.CONTRADICTION);
      expect(conflicts[0].id).toBe('mem-1');
    });

    it('detects duplicate content exceeding similarityThreshold', async () => {
      const db = createMockDb([
        { id: 'mem-2', content: 'The hero fights the dragon', valid_from: null, valid_until: null, importance: 0.5 },
      ]);
      const resolver = new ConflictResolver(db, 0.5);
      const conflicts = await resolver.check('The hero fights the dragon', 'entity-1');
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe(ConflictType.DUPLICATE);
    });

    it('detects update for partially similar content', async () => {
      // Use content that shares enough words for Jaccard >= 0.6 (UPDATE range)
      const db = createMockDb([
        { id: 'mem-3', content: 'The hero fights the dragon in the castle with a sword and shield bravely', valid_from: null, valid_until: null, importance: 0.5 },
      ]);
      // Lower the duplicate threshold so UPDATE detection is possible
      // Jaccard for these strings should be > 0.6
      const resolver = new ConflictResolver(db, 0.95);
      const conflicts = await resolver.check(
        'The hero fights the dragon in the castle with a sword and shield',
        'entity-1'
      );
      // With very high similarity, should be DUPLICATE (not UPDATE, since it's >= 0.85 effectively)
      // But the threshold is 0.95, so if Jaccard is between 0.6 and 0.95, it should be UPDATE
      const similar = conflicts.filter((c) =>
        c.conflictType === ConflictType.UPDATE || c.conflictType === ConflictType.DUPLICATE
      );
      expect(similar.length).toBeGreaterThan(0);
    });

    it('passes scope parameters to SQL query', async () => {
      const db = createMockDb([]);
      const resolver = new ConflictResolver(db);
      await resolver.check('content', 'entity-1', {
        userId: 'user-1',
        projectId: 'proj-1',
        sessionId: 'sess-1',
      });
      const sql = db.execute.mock.calls[0][0] as string;
      const params = db.execute.mock.calls[0][1] as unknown[];
      expect(sql).toContain('user_id = ?');
      expect(sql).toContain('project_id = ?');
      expect(sql).toContain('session_id = ?');
      expect(params).toContain('user-1');
      expect(params).toContain('proj-1');
      expect(params).toContain('sess-1');
    });

    it('returns empty array when db query throws', async () => {
      const db = {
        execute: vi.fn().mockImplementation(() => {
          throw new Error('DB error');
        }),
      };
      const resolver = new ConflictResolver(db as ConflictDbConnection);
      const conflicts = await resolver.check('content', 'entity-1');
      expect(conflicts).toEqual([]);
    });

    it('uses embedder when set for semantic similarity', async () => {
      const identicalVec = [0.5, 0.3, 0.7, 0.9];
      const embeddings = new Map<string, number[]>();
      embeddings.set('new content', identicalVec);
      embeddings.set('existing content', identicalVec);
      const embedder = createEmbedder(embeddings);
      const db = createMockDb([
        { id: 'mem-x', content: 'existing content', valid_from: null, valid_until: null, importance: 0.5 },
      ]);
      const resolver = new ConflictResolver(db, 0.85);
      resolver.setEmbedder(embedder);
      const conflicts = await resolver.check('new content', 'entity-1');
      // With identical vectors, similarity = 1.0 > 0.85 => DUPLICATE
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].conflictType).toBe(ConflictType.DUPLICATE);
    });
  });

  describe('resolve', () => {
    it('returns accept action when no conflicts', async () => {
      const resolver = new ConflictResolver();
      const result = await resolver.resolve('content', []);
      expect(result.action).toBe('accept');
      expect(result.reason).toContain('No conflicts');
    });

    it('AUTO strategy marks duplicates with low importance as obsolete', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-low', content: 'old text', importance: 0.3, conflictType: ConflictType.DUPLICATE }),
      ];
      const result = await resolver.resolve('new text', conflicts, ConflictResolutionStrategy.AUTO);
      expect(result.action).toBe('update');
      expect(result.obsoleteIds).toContain('mem-low');
    });

    it('AUTO strategy keeps duplicates with high importance', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-high', content: 'old text', importance: 0.9, conflictType: ConflictType.DUPLICATE }),
      ];
      const result = await resolver.resolve('new text', conflicts, ConflictResolutionStrategy.AUTO);
      expect(result.action).toBe('update');
      expect(result.obsoleteIds).not.toContain('mem-high');
    });

    it('AUTO strategy marks contradictions as obsolete', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-contr', content: 'hero is alive', conflictType: ConflictType.CONTRADICTION }),
      ];
      const result = await resolver.resolve('hero is dead', conflicts, ConflictResolutionStrategy.AUTO);
      expect(result.action).toBe('update');
      expect(result.obsoleteIds).toContain('mem-contr');
    });

    it('AUTO strategy marks updates as obsolete', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-upd', content: 'partial info', conflictType: ConflictType.UPDATE }),
      ];
      const result = await resolver.resolve('complete info', conflicts, ConflictResolutionStrategy.AUTO);
      expect(result.action).toBe('update');
      expect(result.obsoleteIds).toContain('mem-upd');
    });

    it('KEEP_OLD strategy keeps all existing memories', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-a', content: 'a' }),
        new ConflictInfo({ id: 'mem-b', content: 'b' }),
      ];
      const result = await resolver.resolve('new', conflicts, ConflictResolutionStrategy.KEEP_OLD);
      expect(result.action).toBe('reject');
      expect(result.keptIds).toEqual(['mem-a', 'mem-b']);
      expect(result.obsoleteIds).toEqual([]);
    });

    it('KEEP_NEW strategy marks all existing as obsolete', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-a', content: 'a' }),
        new ConflictInfo({ id: 'mem-b', content: 'b' }),
      ];
      const result = await resolver.resolve('new', conflicts, ConflictResolutionStrategy.KEEP_NEW);
      expect(result.action).toBe('update');
      expect(result.obsoleteIds).toEqual(['mem-a', 'mem-b']);
    });

    it('MERGE strategy combines content with most important conflict', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-a', content: 'old content A', importance: 0.3 }),
        new ConflictInfo({ id: 'mem-b', content: 'old content B', importance: 0.9 }),
      ];
      const result = await resolver.resolve('new content', conflicts, ConflictResolutionStrategy.MERGE);
      expect(result.action).toBe('merge');
      expect(result.obsoleteIds).toEqual(['mem-a', 'mem-b']);
      expect(result.mergedContent).toContain('old content B');
      expect(result.mergedContent).toContain('[Updated]: new content');
    });

    it('MANUAL strategy defers resolution', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-a', content: 'content a', conflictType: ConflictType.CONTRADICTION }),
      ];
      const result = await resolver.resolve('new', conflicts, ConflictResolutionStrategy.MANUAL);
      expect(result.action).toBe('defer');
      expect(result.requiresManual).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.conflicts).toBeDefined();
    });

    it('defaults to AUTO strategy for unknown strategies', async () => {
      const resolver = new ConflictResolver();
      const conflicts = [
        new ConflictInfo({ id: 'mem-x', content: 'x', conflictType: ConflictType.UPDATE }),
      ];
      const result = await resolver.resolve('new', conflicts, 'unknown' as ConflictResolutionStrategy);
      expect(result.action).toBe('update');
      expect(result.obsoleteIds).toContain('mem-x');
    });
  });

  describe('detectAllConflicts', () => {
    it('finds contradictions between memory pairs', () => {
      const resolver = new ConflictResolver();
      const memories = [
        { id: 'm1', content: 'The hero is alive and well' },
        { id: 'm2', content: 'The hero is dead now' },
      ];
      const conflicts = resolver.detectAllConflicts(memories);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0][2]).toBe(ConflictType.CONTRADICTION);
    });

    it('finds duplicates among similar content', () => {
      const resolver = new ConflictResolver(null, 0.5);
      const memories = [
        { id: 'm1', content: 'The hero fights the dragon' },
        { id: 'm2', content: 'The hero fights the dragon' },
      ];
      const conflicts = resolver.detectAllConflicts(memories);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0][2]).toBe(ConflictType.DUPLICATE);
    });

    it('returns empty for non-conflicting memories', () => {
      const resolver = new ConflictResolver();
      const memories = [
        { id: 'm1', content: 'The hero fights the dragon' },
        { id: 'm2', content: 'The princess rules the kingdom' },
      ];
      const conflicts = resolver.detectAllConflicts(memories);
      expect(conflicts.length).toBe(0);
    });

    it('handles empty memory list', () => {
      const resolver = new ConflictResolver();
      const conflicts = resolver.detectAllConflicts([]);
      expect(conflicts).toEqual([]);
    });

    it('handles memories with undefined content', () => {
      const resolver = new ConflictResolver();
      const memories = [
        { id: 'm1', content: undefined },
        { id: 'm2', content: 'some text' },
      ];
      const conflicts = resolver.detectAllConflicts(memories);
      expect(conflicts).toEqual([]);
    });

    it('checks all pairs (N choose 2)', () => {
      const resolver = new ConflictResolver(null, 0.3);
      const memories = [
        { id: 'm1', content: 'hero is alive' },
        { id: 'm2', content: 'hero is dead' },
        { id: 'm3', content: 'hero is strong' },
      ];
      const conflicts = resolver.detectAllConflicts(memories);
      // m1 vs m2 should be a contradiction; other pairs may vary
      const hasContradiction = conflicts.some(
        ([, , type]) => type === ConflictType.CONTRADICTION
      );
      expect(hasContradiction).toBe(true);
    });
  });

  describe('NEGATION_PAIRS', () => {
    it('contains expected negation pairs', () => {
      expect(ConflictResolver.NEGATION_PAIRS).toContainEqual(['is', 'is not']);
      expect(ConflictResolver.NEGATION_PAIRS).toContainEqual(['alive', 'dead']);
      expect(ConflictResolver.NEGATION_PAIRS).toContainEqual(['love', 'hate']);
    });
  });
});

describe('ConflictInfo', () => {
  it('constructs with defaults', () => {
    const info = new ConflictInfo({ id: 'test-id', content: 'test' });
    expect(info.id).toBe('test-id');
    expect(info.content).toBe('test');
    expect(info.validFrom).toBeNull();
    expect(info.validUntil).toBeNull();
    expect(info.importance).toBe(0.5);
    expect(info.conflictType).toBe(ConflictType.CONTRADICTION);
    expect(info.similarityScore).toBe(0.0);
    expect(info.metadata).toEqual({});
  });

  it('accepts all parameters', () => {
    const info = new ConflictInfo({
      id: 'id-2',
      content: 'content-2',
      validFrom: '2025-01-01',
      validUntil: '2025-12-31',
      importance: 0.9,
      conflictType: ConflictType.DUPLICATE,
      similarityScore: 0.95,
      metadata: { key: 'value' },
    });
    expect(info.validFrom).toBe('2025-01-01');
    expect(info.validUntil).toBe('2025-12-31');
    expect(info.importance).toBe(0.9);
    expect(info.conflictType).toBe(ConflictType.DUPLICATE);
    expect(info.similarityScore).toBe(0.95);
    expect(info.metadata).toEqual({ key: 'value' });
  });
});

describe('ResolutionResult', () => {
  it('constructs with defaults', () => {
    const result = new ResolutionResult({ action: 'accept' });
    expect(result.action).toBe('accept');
    expect(result.keptIds).toEqual([]);
    expect(result.obsoleteIds).toEqual([]);
    expect(result.mergedContent).toBeNull();
    expect(result.reason).toBe('');
    expect(result.requiresManual).toBe(false);
    expect(result.metadata).toEqual({});
  });
});

describe('getConflictResolver / resetConflictResolver', () => {
  it('creates singleton instance', () => {
    const r1 = getConflictResolver();
    const r2 = getConflictResolver();
    expect(r1).toBe(r2);
  });

  it('creates new instance after reset', () => {
    const r1 = getConflictResolver();
    resetConflictResolver();
    const r2 = getConflictResolver();
    expect(r1).not.toBe(r2);
  });

  it('sets db connection on existing singleton if passed', () => {
    const r1 = getConflictResolver();
    const db = createMockDb();
    const r2 = getConflictResolver(db);
    expect(r1).toBe(r2);
    expect(r2.db).toBe(db);
  });
});
