import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MemoryService,
  SimpleEmbedder,
  __memoryServiceTestUtils,
  configureMemoryEngineProvider,
  getMemoryService,
  resetMemoryService,
  type Embedder,
} from '../../services/memory-service.js';

class DeterministicEmbedder implements Embedder {
  async embed(text: string): Promise<number[]> {
    const lower = text.toLowerCase();
    if (lower.includes('alice') || lower.includes('silver')) return [1, 0, 0];
    if (lower.includes('beta') || lower.includes('storm')) return [0, 1, 0];
    return [0, 0, 1];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

class EmbedOnlyEmbedder implements Embedder {
  async embed(text: string): Promise<number[]> {
    return text.toLowerCase().includes('archive') ? [1, 0] : [0, 1];
  }
}

function getDb(service: MemoryService) {
  return (service as unknown as {
    _getDb: () => {
      prepare: (sql: string) => {
        run: (...args: unknown[]) => { changes: number }
        get: (...args: unknown[]) => Record<string, unknown> | undefined
      }
    }
  })._getDb()
}

const { packEmbedding, unpackEmbedding, cosineSimilarityWithNorms } = __memoryServiceTestUtils;

describe('services/memory-service', () => {
  let tempDir: string;
  let dbPath: string;
  let service: MemoryService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'niko-memory-service-'));
    dbPath = join(tempDir, 'memory.db');
    service = new MemoryService(dbPath, new DeterministicEmbedder());
  });

  afterEach(() => {
    service.close();
    resetMemoryService();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('adds, searches, updates, reads, deletes, counts, and lists namespaces', async () => {
    const alphaId = await service.add(
      [
        {
          role: 'user',
          content: 'Alice guards the silver key.',
          timestamp: new Date('2026-06-01T00:00:00.000Z'),
          metadata: { tone: 'urgent' },
        },
        {
          role: 'assistant',
          content: 'The archive gate stays closed.',
          timestamp: new Date('2026-06-01T00:05:00.000Z'),
          metadata: { branch: 'alpha' },
        },
      ],
      {
        namespace: 'alpha',
        tags: ['plot', 'key'],
        importance: 0.8,
        ttl: 120,
      },
    );
    await service.add(
      [{ role: 'user', content: 'Beta storm report.' }],
      {
        namespace: 'beta',
        tags: ['weather'],
        importance: 0.5,
      },
    );

    const results = await service.search('silver key', {
      namespace: 'alpha',
      limit: 5,
      threshold: 0.2,
      includeMetadata: true,
    });
    const stored = await service.get(alphaId);

    expect(results).toEqual([
      expect.objectContaining({
        id: alphaId,
        source: 'memory:alpha',
        metadata: expect.objectContaining({
          tone: 'urgent',
          branch: 'alpha',
          importance: 0.8,
          tags: ['plot', 'key'],
        }),
      }),
    ]);
    expect(stored).toMatchObject({
      id: alphaId,
      content: '[user] Alice guards the silver key.\n[assistant] The archive gate stays closed.',
      metadata: expect.objectContaining({
        tone: 'urgent',
        branch: 'alpha',
        messageCount: 2,
        roles: ['user', 'assistant'],
      }),
    });
    expect(await service.count()).toBe(2);
    expect(await service.count('alpha')).toBe(1);
    expect(await service.listNamespaces()).toEqual(['alpha', 'beta']);

    expect(
      await service.update(
        alphaId,
        'Alice secures the silver key in the archive.',
        { revised: true },
        0.9,
        ['plot', 'revised'],
      ),
    ).toBe(true);
    expect(await service.update(alphaId)).toBe(false);
    expect(
      await service.get(alphaId),
    ).toMatchObject({
      content: 'Alice secures the silver key in the archive.',
      metadata: { revised: true },
    });

    expect(await service.delete(alphaId)).toBe(true);
    expect(await service.get(alphaId)).toBeNull();
    expect(await service.delete('missing')).toBe(false);
  });

  it('supports history lookups, keyword-plus-vector hybrid search, profiles, and cache lifecycle', async () => {
    await service.add(
      [{ role: 'user', content: 'Silver key returns to the archive vault.' }],
      {
        namespace: 'alpha',
        tags: ['plot'],
        importance: 0.7,
      },
    );
    await service.add(
      [{ role: 'assistant', content: 'Silver key echoes through the archive.' }],
      {
        namespace: 'alpha',
        tags: ['echo'],
        importance: 0.6,
      },
    );

    await service.addHistory('session-1', [
      {
        role: 'user',
        content: 'first',
        timestamp: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        role: 'assistant',
        content: 'second',
        timestamp: new Date('2026-06-01T00:10:00.000Z'),
        metadata: { revision: 2 },
      },
    ]);

    const history = await service.getHistory('session-1', 5);
    const beforeHistory = await service.getHistory(
      'session-1',
      5,
      new Date('2026-06-01T00:05:00.000Z'),
    );
    const hybrid = await service.hybridSearch('silver archive', {
      namespace: 'alpha',
      limit: 5,
      threshold: 0.3,
      includeMetadata: true,
    });

    service.upsertRetrievalProfile(
      'balanced',
      { memory: 1, keyword: 0.5 },
      { min_score: 0.3 },
      { budget_tokens: 900 },
      true,
    );
    service.cachePack('cache-key', { hits: ['a', 'b'] }, 60, 'ready');

    const cached = service.cacheRead('cache-key');
    const cacheDb = (service as unknown as {
      _getDb: () => { prepare: (sql: string) => { run: (...args: unknown[]) => void } };
    })._getDb();
    cacheDb.prepare('UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      'cache-key',
    );

    service.cachePack('cleanup-key', { hits: ['x'] }, 60, 'stale');
    cacheDb.prepare('UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?').run(
      new Date(Date.now() - 60_000).toISOString(),
      'cleanup-key',
    );

    expect(history).toEqual([
      {
        role: 'user',
        content: 'first',
        timestamp: new Date('2026-06-01T00:00:00.000Z'),
        metadata: {},
      },
      {
        role: 'assistant',
        content: 'second',
        timestamp: new Date('2026-06-01T00:10:00.000Z'),
        metadata: { revision: 2 },
      },
    ]);
    expect(beforeHistory).toEqual([
      {
        role: 'user',
        content: 'first',
        timestamp: new Date('2026-06-01T00:00:00.000Z'),
        metadata: {},
      },
    ]);
    expect(hybrid[0]).toMatchObject({
      source: expect.stringMatching(/^(memory|keyword):alpha$/),
      metadata: expect.objectContaining({
        fusion: 'rrf',
        original_score: expect.any(Number),
      }),
    });
    expect(service.getRetrievalProfile('balanced')).toMatchObject({
      profileName: 'balanced',
      sourceWeights: { memory: 1, keyword: 0.5 },
      thresholds: { min_score: 0.3 },
      budget: { budget_tokens: 900 },
      enabled: true,
    });
    expect(service.getRetrievalProfile('missing')).toBeNull();
    expect(cached).toMatchObject({
      payload: { hits: ['a', 'b'] },
      status: 'ready',
      hitCount: 1,
    });
    expect(service.cacheStatus('cache-key')).toBe('ready');
    expect(service.cacheRead('cache-key')).toBeNull();
    expect(service.cacheCleanup()).toBe(1);
    expect(service.cacheStatus('cleanup-key')).toBeNull();
  });

  it('covers embed fallback, time ranges, corrupted stored json, and default hybrid options', async () => {
    service.close();
    service = new MemoryService(join(tempDir, 'embed-only.db'), new EmbedOnlyEmbedder());

    const memoryId = await service.add(
      [
        {
          role: '',
          content: 'Archive note with alpha keyword.',
        },
      ],
      {
        namespace: 'default',
        tags: ['alpha'],
        importance: 0.4,
      },
    );

    const db = (service as unknown as {
      _getDb: () => { prepare: (sql: string) => { run: (...args: unknown[]) => void } };
    })._getDb();
    db.prepare(`
      UPDATE memories
      SET created_at = ?, embedding_blob = NULL, embedding = ?, metadata = ?, tags = ?
      WHERE id = ?
    `).run(
      '2026-06-01T00:00:00.000Z',
      'not-json',
      'not-json',
      'not-json',
      memoryId,
    );

    const ranged = await service.search('archive', {
      namespace: 'default',
      limit: 5,
      threshold: 0,
      includeMetadata: true,
      timeRange: [
        new Date('2026-05-31T00:00:00.000Z'),
        new Date('2026-06-02T00:00:00.000Z'),
      ],
    });
    const outsideRange = await service.search('archive', {
      namespace: 'default',
      limit: 5,
      threshold: 0,
      includeMetadata: true,
      timeRange: [
        new Date('2026-06-02T00:00:00.000Z'),
        new Date('2026-06-03T00:00:00.000Z'),
      ],
    });
    const stored = await service.get(memoryId);
    const hybrid = await service.hybridSearch('archive alpha');

    expect(ranged).toHaveLength(1);
    expect(ranged[0]).toMatchObject({
      id: memoryId,
      score: 0,
      metadata: expect.objectContaining({
        created_at: '2026-06-01T00:00:00.000Z',
      }),
    });
    expect(ranged[0]?.metadata).not.toHaveProperty('tags');
    expect(outsideRange).toEqual([]);
    expect(stored).toMatchObject({
      id: memoryId,
      embedding: null,
      metadata: null,
    });
    expect(hybrid[0]).toMatchObject({
      id: memoryId,
      metadata: expect.objectContaining({
        fusion: 'rrf',
      }),
    });
  });

  it('covers constructor defaults, blank metadata fallbacks, and internal helper guards', async () => {
    const previousCwd = process.cwd();
    let defaultService: MemoryService | null = null;

    process.chdir(tempDir);
    try {
      defaultService = new MemoryService(undefined, null);
      expect((defaultService as unknown as { _dbPath: string })._dbPath).toBe(
        resolve(tempDir, '.writing/memory_service.db'),
      );
      expect((defaultService as unknown as { _getEmbedder: () => unknown })._getEmbedder()).toBeInstanceOf(SimpleEmbedder);

      const helperId = await defaultService.add(
        [{ role: 'user', content: 'Alice helper branch note.' }],
        { namespace: 'alpha', importance: 0.4 } as any,
      );
      const helperDb = getDb(defaultService);
      helperDb.prepare(
        'UPDATE memories SET metadata = ?, tags = ?, created_at = ?, updated_at = ? WHERE id = ?',
      ).run('', '', '', '', helperId);

      const exactStored = await defaultService.get(helperId);
      const searchWithDefaultThreshold = await defaultService.search(
        exactStored!.content,
        { namespace: 'alpha', limit: 5, includeMetadata: true } as any,
      );
      const stored = await defaultService.get(helperId);
      const keywordResults = await (defaultService as any)._keywordSearch('alice helper', {
        namespace: 'alpha',
        limit: 5,
        threshold: 0,
        includeMetadata: true,
      });
      const emptyKeywordResults = await defaultService.hybridSearch('the and or', {
        namespace: 'alpha',
        limit: 5,
        threshold: 1,
        includeMetadata: false,
      } as any);

      expect(searchWithDefaultThreshold[0]).toMatchObject({
        id: helperId,
        metadata: expect.objectContaining({
          tags: [],
          importance: 0.4,
        }),
      });
      expect(keywordResults[0]).toMatchObject({
        id: helperId,
        metadata: expect.objectContaining({
          tags: [],
          keywordMatches: 2,
        }),
      });
      expect(stored).toMatchObject({
        id: helperId,
        metadata: null,
        createdAt: null,
      });
      expect(stored?.updatedAt).toBeInstanceOf(Date);
      expect(emptyKeywordResults).toEqual([]);
      expect(packEmbedding(null)).toBeNull();
      expect(unpackEmbedding(null)).toEqual([]);
      expect(cosineSimilarityWithNorms([1, 0], [1, 0])).toBeCloseTo(1, 5);
      expect(cosineSimilarityWithNorms([0, 0], [1, 0])).toBe(0);
    } finally {
      defaultService?.close();
      process.chdir(previousCwd);
    }
  });

  it('covers history parsing fallbacks plus retrieval profile and cache corruption handling', async () => {
    await service.addHistory('session-fallback', [
      { role: 'user', content: 'untimed entry' },
      { role: 'assistant', content: 'timed entry', timestamp: new Date('2026-06-02T00:00:00.000Z') },
    ]);

    const db = getDb(service);
    db.prepare(
      'UPDATE session_history SET timestamp = ?, metadata = ? WHERE session_id = ? AND role = ?',
    ).run('', '', 'session-fallback', 'user');
    db.prepare(
      'UPDATE session_history SET metadata = ? WHERE session_id = ? AND role = ?',
    ).run('not-json', 'session-fallback', 'assistant');

    service.upsertRetrievalProfile(
      'nullish-profile',
      undefined as any,
      undefined as any,
      undefined as any,
      false,
    );
    service.upsertRetrievalProfile('blank-profile', {}, {}, {}, true);
    db.prepare(
      'UPDATE retrieval_profiles SET source_weights_json = ?, thresholds_json = ?, budget_json = ? WHERE profile_name = ?',
    ).run('', '', '', 'blank-profile');
    service.upsertRetrievalProfile('corrupt-profile', {}, {}, {}, true);
    db.prepare(
      'UPDATE retrieval_profiles SET source_weights_json = ?, thresholds_json = ?, budget_json = ? WHERE profile_name = ?',
    ).run('not-json', 'not-json', 'not-json', 'corrupt-profile');

    service.cachePack('blank-cache', { ok: true });
    db.prepare('UPDATE retrieval_cache SET payload_json = ? WHERE cache_key = ?').run('', 'blank-cache');
    service.cachePack('corrupt-cache', { ok: true });
    db.prepare('UPDATE retrieval_cache SET payload_json = ? WHERE cache_key = ?').run('not-json', 'corrupt-cache');

    const history = await service.getHistory('session-fallback', 10);

    expect(history).toEqual([
      {
        role: 'user',
        content: 'untimed entry',
        timestamp: null,
        metadata: null,
      },
      {
        role: 'assistant',
        content: 'timed entry',
        timestamp: new Date('2026-06-02T00:00:00.000Z'),
        metadata: null,
      },
    ]);
    expect(service.getRetrievalProfile('nullish-profile')).toMatchObject({
      sourceWeights: {},
      thresholds: {},
      budget: {},
      enabled: false,
    });
    expect(service.getRetrievalProfile('blank-profile')).toMatchObject({
      sourceWeights: {},
      thresholds: {},
      budget: {},
    });
    expect(service.getRetrievalProfile('corrupt-profile')).toMatchObject({
      sourceWeights: {},
      thresholds: {},
      budget: {},
    });
    expect(service.cacheRead('missing-cache')).toBeNull();
    expect(service.cacheRead('blank-cache')).toMatchObject({
      payload: {},
      hitCount: 1,
    });
    expect(service.cacheRead('corrupt-cache')).toMatchObject({
      payload: {},
      hitCount: 1,
    });
  });

  it('reuses and resets the singleton factory, and exposes the simple embedder helpers', async () => {
    const embedder = {
      embed: async (text: string) => (text.includes('alpha') ? [1, 0] : [0, 1]),
    };
    const firstDb = join(tempDir, 'singleton-a.db');
    const secondDb = join(tempDir, 'singleton-b.db');
    const thirdDb = join(tempDir, 'singleton-c.db');
    const fourthDb = join(tempDir, 'singleton-d.db');

    configureMemoryEngineProvider(() => ({ embedder }));

    const first = getMemoryService(firstDb);
    const second = getMemoryService(secondDb);
    const simple = new SimpleEmbedder(8);
    const vecA = await simple.embed('alpha');
    const vecB = await simple.embed('alpha');

    expect(second).toBe(first);
    expect((first as unknown as { _dbPath: string })._dbPath).toBe(secondDb.replace('singleton-b.db', 'singleton-a.db'));
    expect(simple.similarity(vecA, vecB)).toBeCloseTo(1, 5);
    expect(simple.similarity([1, 0], [0, 1])).toBe(0);
    expect(simple.similarity([1], [1, 0])).toBe(0);
    expect(simple.similarity([0, 0], [1, 0])).toBe(0);

    resetMemoryService();

    configureMemoryEngineProvider(() => ({}));
    const noEmbedder = getMemoryService(thirdDb);
    expect((noEmbedder as unknown as { _externalEmbedder: Embedder | null })._externalEmbedder).toBeNull();

    resetMemoryService();

    configureMemoryEngineProvider(() => {
      throw new Error('provider failed');
    });
    const fallback = getMemoryService(fourthDb);
    expect((fallback as unknown as { _externalEmbedder: Embedder | null })._externalEmbedder).toBeNull();

    const recreated = getMemoryService(secondDb);
    expect(recreated).not.toBe(first);
    recreated.close();
    fallback.close();
  });
});
