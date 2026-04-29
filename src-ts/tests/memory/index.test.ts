import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StubPostgresShadowAdapter } from '../../integrations';
import * as memory from '../../memory';
import { LayerType as DirectLayerType } from '../../memory/memory-layers';
import {
  MemoryLayer as DirectMemoryLayer,
  MemoryDimension as DirectMemoryDimension,
  UnifiedMemoryEngine as DirectUnifiedMemoryEngine,
} from '../../memory/unified-memory';

const POSTGRES_ENV_KEY = 'INTEGRATION_POSTGRES_ENABLED';
const ORIGINAL_POSTGRES_ENV = process.env[POSTGRES_ENV_KEY];

function restorePostgresEnv(): void {
  if (ORIGINAL_POSTGRES_ENV === undefined) {
    delete process.env[POSTGRES_ENV_KEY];
  } else {
    process.env[POSTGRES_ENV_KEY] = ORIGINAL_POSTGRES_ENV;
  }
}

describe('memory/index barrel', () => {
  beforeEach(() => {
    vi.stubGlobal('console', {
      ...console,
      log: vi.fn(),
      warn: vi.fn(),
    });
  });

  afterEach(() => {
    memory.resetUnifiedMemoryEngine();
    restorePostgresEnv();
    memory.setConfigProvider((_key, defaultValue) => defaultValue);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('re-exports representative memory enums, helpers, and engine classes through the public entrypoint', () => {
    expect(memory.LayerType).toBe(DirectLayerType);
    expect(memory.MemoryLayer).toBe(DirectMemoryLayer);
    expect(memory.MemoryDimension).toBe(DirectMemoryDimension);
    expect(memory.UnifiedMemoryEngine).toBe(DirectUnifiedMemoryEngine);
    expect(memory.getUnifiedMemoryEngine).toBeDefined();
    expect(memory.resetUnifiedMemoryEngine).toBeDefined();
  });

  it('provides a working unified memory engine through the barrel', async () => {
    const tempDir = join(tmpdir(), `niko-memory-barrel-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      const added = await engine.add({
        content: 'Alice remembers the silver key.',
        layer: memory.MemoryLayer.SESSION,
        dimension: memory.MemoryDimension.CONTEXT,
        entityId: 'alice',
        importance: 0.8,
        tags: ['plot'],
      });
      const temporal = await engine.getTemporalFacts({
        entityId: 'alice',
      });

      expect(added).toMatchObject({ status: 'created' });
      expect(temporal).toHaveLength(1);
      expect(temporal[0]).toMatchObject({
        content: 'Alice remembers the silver key.',
        dimension: memory.MemoryDimension.CONTEXT,
      });
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports filtered search and temporal windows through the public unified memory engine', async () => {
    const tempDir = join(tmpdir(), `niko-memory-search-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      const active = await engine.add({
        content: 'Alice keeps the silver key active.',
        layer: memory.MemoryLayer.SESSION,
        dimension: memory.MemoryDimension.CONTEXT,
        entityId: 'alice-search',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-04-01T00:00:00Z',
        importance: 0.9,
        tags: ['plot'],
      });
      await engine.add({
        content: 'Alice keeps the silver key expired.',
        layer: memory.MemoryLayer.SESSION,
        dimension: memory.MemoryDimension.CONTEXT,
        entityId: 'alice-search',
        validFrom: '2025-01-01T00:00:00Z',
        validUntil: '2026-02-01T00:00:00Z',
        importance: 0.4,
        tags: ['archive'],
      });
      await engine.add({
        content: 'Bridge alarm memory for a different layer.',
        layer: memory.MemoryLayer.PROJECT,
        dimension: memory.MemoryDimension.EVENT,
        entityId: 'bridge-search',
        importance: 0.7,
        tags: ['alarm'],
      });

      const filteredSearch = await engine.search({
        query: 'Alice keeps the silver key active.',
        layer: memory.MemoryLayer.SESSION,
        dimensions: [memory.MemoryDimension.CONTEXT],
        entityId: 'alice-search',
        atTime: '2026-03-01T00:00:00Z',
        limit: 5,
      });
      const temporal = await engine.getTemporalFacts({
        entityId: 'alice-search',
        atTime: '2026-03-01T00:00:00Z',
      });

      expect(filteredSearch).toHaveLength(1);
      expect(filteredSearch[0]).toMatchObject({
        id: active.id,
        content: 'Alice keeps the silver key active.',
        layer: memory.MemoryLayer.SESSION,
        dimension: memory.MemoryDimension.CONTEXT,
        entity_id: 'alice-search',
      });
      expect(temporal).toEqual([
        expect.objectContaining({
          id: active.id,
          content: 'Alice keeps the silver key active.',
          dimension: memory.MemoryDimension.CONTEXT,
          valid_until: '2026-04-01T00:00:00Z',
        }),
      ]);
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps search, temporal lookup, and conflict detection isolated by memory scope', async () => {
    const tempDir = join(tmpdir(), `niko-memory-scope-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      await engine.add({
        content: 'Alice is alive in project alpha.',
        layer: memory.MemoryLayer.PROJECT,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'alice-scope',
        userId: 'user-alpha',
        projectId: 'project-alpha',
        sessionId: 'session-alpha',
        importance: 0.8,
        tags: ['status', 'alpha'],
      });
      await engine.add({
        content: 'Alice is dead in project beta.',
        layer: memory.MemoryLayer.PROJECT,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'alice-scope',
        userId: 'user-beta',
        projectId: 'project-beta',
        sessionId: 'session-beta',
        importance: 0.9,
        tags: ['status', 'beta'],
      });

      const alphaSearch = await engine.search({
        query: 'Alice is alive in project alpha.',
        entityId: 'alice-scope',
        projectId: 'project-alpha',
        sessionId: 'session-alpha',
        limit: 5,
      });
      const betaSearch = await engine.search({
        query: 'Alice is dead in project beta.',
        entityId: 'alice-scope',
        projectId: 'project-beta',
        sessionId: 'session-beta',
        limit: 5,
      });
      const alphaTemporal = await engine.getTemporalFacts({
        entityId: 'alice-scope',
        projectId: 'project-alpha',
        sessionId: 'session-alpha',
      });
      const betaTemporal = await engine.getTemporalFacts({
        entityId: 'alice-scope',
        projectId: 'project-beta',
        sessionId: 'session-beta',
      });
      const alphaConflicts = await engine.detectConflicts('alice-scope', {
        projectId: 'project-alpha',
        sessionId: 'session-alpha',
      });
      const betaConflicts = await engine.detectConflicts('alice-scope', {
        projectId: 'project-beta',
        sessionId: 'session-beta',
      });

      expect(alphaSearch).toEqual([
        expect.objectContaining({
          content: 'Alice is alive in project alpha.',
          entity_id: 'alice-scope',
        }),
      ]);
      expect(betaSearch).toEqual([
        expect.objectContaining({
          content: 'Alice is dead in project beta.',
          entity_id: 'alice-scope',
        }),
      ]);
      expect(alphaTemporal).toEqual([
        expect.objectContaining({
          content: 'Alice is alive in project alpha.',
          dimension: memory.MemoryDimension.CHARACTER,
        }),
      ]);
      expect(betaTemporal).toEqual([
        expect.objectContaining({
          content: 'Alice is dead in project beta.',
          dimension: memory.MemoryDimension.CHARACTER,
        }),
      ]);
      expect(alphaConflicts).toEqual([]);
      expect(betaConflicts).toEqual([]);
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('round-trips retrieval profiles and cache entries through the public unified memory engine', () => {
    const tempDir = join(tmpdir(), `niko-memory-cache-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      engine.upsertRetrievalProfile({
        profileName: 'phase4-default',
        sourceWeights: { memory: 1, graph: 0.5 },
        thresholds: { min_score: 0.42 },
        budget: { budget_tokens: 2048 },
        enabled: true,
      });
      engine.cachePack({
        cacheKey: 'phase4-cache-key',
        payload: { hits: ['alpha', 'beta'] },
        ttlSeconds: 60,
        status: 'ready',
      });

      const profile = engine.getRetrievalProfile('phase4-default');
      const cached = engine.cacheRead('phase4-cache-key');
      const cacheStatus = engine.cacheStatus('phase4-cache-key');

      expect(profile).toMatchObject({
        profile_name: 'phase4-default',
        source_weights_json: { memory: 1, graph: 0.5 },
        thresholds_json: { min_score: 0.42 },
        budget_json: { budget_tokens: 2048 },
        enabled: true,
      });
      expect(cached).toMatchObject({
        payload: { hits: ['alpha', 'beta'] },
        status: 'ready',
        hit_count: 1,
      });
      expect(cacheStatus).toBe('ready');

      engine.cacheRelease('phase4-cache-key');
      expect(engine.cacheRead('phase4-cache-key')).toBeNull();
      expect(engine.cacheStatus('phase4-cache-key')).toBeNull();
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('expires and cleans retrieval cache entries through the public unified memory engine', () => {
    const tempDir = join(tmpdir(), `niko-memory-cache-expiry-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      engine.cachePack({
        cacheKey: 'phase4-expired-key',
        payload: { hits: ['expired'] },
        ttlSeconds: 60,
        status: 'stale',
      });
      engine.cachePack({
        cacheKey: 'phase4-fresh-key',
        payload: { hits: ['fresh'] },
        ttlSeconds: 60,
        status: 'ready',
      });

      const db = (engine as unknown as { _db: { prepare: (sql: string) => { run: (...params: unknown[]) => void } } })._db;
      const expiredAt = new Date(Date.now() - 60_000).toISOString();
      db.prepare('UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?').run(expiredAt, 'phase4-expired-key');

      expect(engine.cacheRead('phase4-expired-key')).toBeNull();
      expect(engine.cacheStatus('phase4-expired-key')).toBeNull();

      engine.cachePack({
        cacheKey: 'phase4-manual-expired',
        payload: { hits: ['cleanup'] },
        ttlSeconds: 60,
        status: 'pending',
      });
      db.prepare('UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?').run(expiredAt, 'phase4-manual-expired');

      expect(engine.cacheCleanup()).toBe(1);
      expect(engine.cacheRead('phase4-manual-expired')).toBeNull();
      expect(engine.cacheStatus('phase4-fresh-key')).toBe('ready');
      expect(engine.cacheRead('phase4-fresh-key')).toMatchObject({
        payload: { hits: ['fresh'] },
        status: 'ready',
        hit_count: 1,
      });
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('covers plugin lifecycle and config-driven factory behavior through the public unified memory engine', async () => {
    const tempRoot = join(tmpdir(), `niko-memory-config-${randomUUID()}`);
    const runtimeDbPath = join(tempRoot, 'runtime-memory.db');
    const configuredDataDir = join(tempRoot, 'configured-data');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    memory.setConfigProvider((key, defaultValue) => {
      if (key === 'memory.db_path') return null;
      if (key === 'data_dir') return configuredDataDir;
      if (key === 'memory.vector_db_path') return null;
      return defaultValue;
    });

    const okPlugin = {
      name: 'ok-plugin',
      load: vi.fn(async () => {}),
      healthCheck: vi.fn(async () => ({ status: 'ok' })),
      onMemoryAdded: vi.fn(async () => {}),
    };
    const badPlugin = {
      name: 'bad-plugin',
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
      dbPath: runtimeDbPath,
      plugins: [okPlugin, badPlugin, okPlugin],
    });
    let engineClosed = false;

    try {
      expect(engine.plugins).toHaveLength(2);

      await engine.initialize();

      expect(okPlugin.load).toHaveBeenCalledTimes(1);
      expect(badPlugin.load).toHaveBeenCalledTimes(1);

      const healthWhileOpen = await engine.healthCheck();
      expect(healthWhileOpen).toMatchObject({
        db_ok: true,
        plugins: {
          'ok-plugin': { status: 'ok' },
          'bad-plugin': { status: 'error', error: 'Error: health failed' },
        },
      });

      await engine.add({
        content: 'Plugin lifecycle memory.',
        layer: memory.MemoryLayer.SESSION,
        dimension: memory.MemoryDimension.CONTEXT,
        entityId: 'plugin-lifecycle',
        importance: 0.5,
        tags: ['phase4', 'plugin'],
      });

      expect(okPlugin.onMemoryAdded).toHaveBeenCalledTimes(1);
      expect(badPlugin.onMemoryAdded).toHaveBeenCalledTimes(1);
      expect(
        errorSpy.mock.calls.some((call) =>
          String(call[0]).includes('Memory plugin load failed: bad-plugin: Error: load failed'),
        ),
      ).toBe(true);
      expect(
        errorSpy.mock.calls.some((call) =>
          String(call[0]).includes('Memory plugin callback failed: bad-plugin: Error: callback failed'),
        ),
      ).toBe(true);

      const configured = memory.UnifiedMemoryEngine.fromConfig([okPlugin]);
      try {
        expect(configured.dbPath).toBe(join(configuredDataDir, 'memory.db'));
      } finally {
        configured.close();
      }

      memory.setConfigProvider((key, defaultValue) => {
        if (key === 'memory.db_path') return null;
        if (key === 'data_dir') return null;
        if (key === 'memory.vector_db_path') return join(tempRoot, 'vector-fallback.db');
        return defaultValue;
      });

      const vectorFallback = memory.UnifiedMemoryEngine.fromConfig();
      try {
        expect(vectorFallback.dbPath).toBe(join(tempRoot, 'vector-fallback.db'));
      } finally {
        vectorFallback.close();
      }

      engine.close();
      engineClosed = true;

      const healthAfterClose = await engine.healthCheck();
      expect(healthAfterClose).toMatchObject({
        db_ok: false,
        plugins: {
          'ok-plugin': { status: 'ok' },
          'bad-plugin': { status: 'error', error: 'Error: health failed' },
        },
      });
      expect(String(healthAfterClose.error)).toContain('database connection is not open');
    } finally {
      if (!engineClosed) {
        engine.close();
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('reuses and resets the unified memory singleton through the public barrel helpers', () => {
    const tempRoot = join(tmpdir(), `niko-memory-singleton-${randomUUID()}`);
    const firstPath = join(tempRoot, 'first-memory.db');
    const secondPath = join(tempRoot, 'second-memory.db');

    try {
      const first = memory.getUnifiedMemoryEngine({ dbPath: firstPath });
      const second = memory.getUnifiedMemoryEngine({ dbPath: secondPath });

      expect(second).toBe(first);
      expect(second.dbPath).toBe(firstPath);

      memory.resetUnifiedMemoryEngine();

      const recreated = memory.getUnifiedMemoryEngine({ dbPath: secondPath });
      expect(recreated).not.toBe(first);
      expect(recreated.dbPath).toBe(secondPath);
    } finally {
      memory.resetUnifiedMemoryEngine();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('applies environment-selected default adapters through the public config factory', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    process.env.NIKO_ENV = 'development';
    const shadowWriteSpy = vi.spyOn(StubPostgresShadowAdapter.prototype, 'shadowWriteMemory');
    const tempRoot = join(tmpdir(), `niko-memory-config-default-${randomUUID()}`);
    const configuredDbPath = join(tempRoot, 'configured-memory.db');

    memory.setConfigProvider((key, defaultValue) => {
      if (key === 'memory.db_path') return configuredDbPath;
      if (key === 'data_dir') return null;
      return defaultValue;
    });

    const engine = memory.UnifiedMemoryEngine.fromConfig();

    try {
      const added = await engine.add({
        content: 'Frank relies on fromConfig() to pick the default shadow adapter.',
        layer: memory.MemoryLayer.USER,
        dimension: memory.MemoryDimension.CONTEXT,
        entityId: 'frank-config-default-env',
        validFrom: '2026-04-01T00:00:00Z',
        validUntil: '2026-09-01T00:00:00Z',
        importance: 0.82,
        confidence: 0.86,
        source: 'config-seeded',
        tags: ['phase4', 'config-default-adapters'],
      });
      const temporal = await engine.getTemporalFacts({ entityId: 'frank-config-default-env' });

      expect(engine.dbPath).toBe(configuredDbPath);
      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(shadowWriteSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        content: 'Frank relies on fromConfig() to pick the default shadow adapter.',
        layer: memory.MemoryLayer.USER,
        dimension: memory.MemoryDimension.CONTEXT,
        entity_id: 'frank-config-default-env',
        valid_from: '2026-04-01T00:00:00Z',
        valid_until: '2026-09-01T00:00:00Z',
        user_id: null,
        project_id: null,
        session_id: null,
        importance: 0.82,
        confidence: 0.86,
        source: 'config-seeded',
        tags: ['phase4', 'config-default-adapters'],
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }));
      expect(temporal).toEqual([
        expect.objectContaining({
          content: 'Frank relies on fromConfig() to pick the default shadow adapter.',
          dimension: memory.MemoryDimension.CONTEXT,
        }),
      ]);
    } finally {
      engine.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('detects and resolves public memory conflicts through the unified engine', async () => {
    const tempDir = join(tmpdir(), `niko-memory-conflicts-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      const older = await engine.add({
        content: 'Alice is alive.',
        layer: memory.MemoryLayer.USER,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'alice-conflict',
        importance: 0.6,
        tags: ['status'],
      });
      const newer = await engine.add({
        content: 'Alice is dead.',
        layer: memory.MemoryLayer.USER,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'alice-conflict',
        importance: 0.9,
        tags: ['status', 'contradiction'],
      });

      const db = (
        engine as unknown as {
          _db: {
            prepare: (
              sql: string,
            ) => {
              run: (...args: unknown[]) => unknown;
            };
          };
        }
      )._db;

      // Restore both rows to active state so the public conflict scanner can inspect the pair.
      db.prepare('UPDATE memories SET superseded_by = NULL WHERE id IN (?, ?)').run(
        older.id,
        newer.id,
      );

      const conflicts = await engine.detectConflicts('alice-conflict');
      const resolution = await engine.resolveConflict({
        memoryIdA: older.id as string,
        memoryIdB: newer.id as string,
      });
      const temporal = await engine.getTemporalFacts({
        entityId: 'alice-conflict',
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        conflict_type: 'contradiction',
      });
      expect(
        [conflicts[0]?.memory_a?.id, conflicts[0]?.memory_b?.id].sort(),
      ).toEqual([older.id, newer.id].sort());
      expect(resolution).toEqual({
        status: 'resolved',
        kept: newer.id,
        removed: older.id,
      });
      expect(temporal).toEqual([
        expect.objectContaining({
          id: newer.id,
          content: 'Alice is dead.',
          dimension: memory.MemoryDimension.CHARACTER,
        }),
      ]);
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports explicit conflict resolution strategies through the unified engine', async () => {
    const tempDir = join(tmpdir(), `niko-memory-conflict-strategies-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      const db = (
        engine as unknown as {
          _db: {
            prepare: (
              sql: string,
            ) => {
              run: (...args: unknown[]) => unknown;
            };
          };
        }
      )._db;

      const createConflictPair = async (entityId: string, olderContent: string, newerContent: string) => {
        const older = await engine.add({
          content: olderContent,
          layer: memory.MemoryLayer.USER,
          dimension: memory.MemoryDimension.CHARACTER,
          entityId,
          importance: 0.6,
          tags: ['status', 'phase4'],
        });
        const newer = await engine.add({
          content: newerContent,
          layer: memory.MemoryLayer.USER,
          dimension: memory.MemoryDimension.CHARACTER,
          entityId,
          importance: 0.9,
          tags: ['status', 'phase4', 'contradiction'],
        });

        db.prepare('UPDATE memories SET superseded_by = NULL WHERE id IN (?, ?)').run(
          older.id,
          newer.id,
        );

        return {
          olderId: older.id as string,
          newerId: newer.id as string,
        };
      };

      const keepOldPair = await createConflictPair(
        'alice-keep-old',
        'Alice is alive in the old record.',
        'Alice is dead in the new record.',
      );
      const keepOldResolution = await engine.resolveConflict({
        memoryIdA: keepOldPair.olderId,
        memoryIdB: keepOldPair.newerId,
        resolution: 'keep_old',
      });
      const keepOldTemporal = await engine.getTemporalFacts({ entityId: 'alice-keep-old' });

      expect(keepOldResolution).toEqual({
        status: 'resolved',
        kept: keepOldPair.olderId,
        removed: keepOldPair.newerId,
      });
      expect(keepOldTemporal).toEqual([
        expect.objectContaining({
          id: keepOldPair.olderId,
          content: 'Alice is alive in the old record.',
        }),
      ]);

      const keepNewPair = await createConflictPair(
        'alice-keep-new',
        'Alice is alive in the old version.',
        'Alice is dead in the new version.',
      );
      const keepNewResolution = await engine.resolveConflict({
        memoryIdA: keepNewPair.olderId,
        memoryIdB: keepNewPair.newerId,
        resolution: 'keep_new',
      });
      const keepNewTemporal = await engine.getTemporalFacts({ entityId: 'alice-keep-new' });

      expect(keepNewResolution).toEqual({
        status: 'resolved',
        kept: keepNewPair.newerId,
        removed: keepNewPair.olderId,
      });
      expect(keepNewTemporal).toEqual([
        expect.objectContaining({
          id: keepNewPair.newerId,
          content: 'Alice is dead in the new version.',
        }),
      ]);

      const mergePair = await createConflictPair(
        'alice-merge',
        'Alice is alive before the merge.',
        'Alice is dead after the merge update.',
      );
      const mergeResolution = await engine.resolveConflict({
        memoryIdA: mergePair.olderId,
        memoryIdB: mergePair.newerId,
        resolution: 'merge',
      });
      const mergeTemporal = await engine.getTemporalFacts({ entityId: 'alice-merge' });

      expect(mergeResolution).toMatchObject({
        status: 'resolved',
        kept: expect.any(String),
        removed: [mergePair.olderId, mergePair.newerId],
        merged_content: 'Alice is alive before the merge.\n\n[Updated]: Alice is dead after the merge update.',
      });
      expect(mergeTemporal).toEqual([
        expect.objectContaining({
          id: mergeResolution.kept,
          content: 'Alice is alive before the merge.\n\n[Updated]: Alice is dead after the merge update.',
          dimension: memory.MemoryDimension.CHARACTER,
        }),
      ]);

      const manualPair = await createConflictPair(
        'alice-manual',
        'Alice is alive pending review.',
        'Alice is dead pending review.',
      );
      const manualResolution = await engine.resolveConflict({
        memoryIdA: manualPair.olderId,
        memoryIdB: manualPair.newerId,
        resolution: 'manual',
      });
      const manualTemporal = await engine.getTemporalFacts({ entityId: 'alice-manual' });

      expect(manualResolution).toEqual({
        status: 'manual_required',
        requires_manual: true,
        conflicts: [
          { id: manualPair.olderId, content: 'Alice is alive pending review.' },
          { id: manualPair.newerId, content: 'Alice is dead pending review.' },
        ],
      });
      expect(manualTemporal).toHaveLength(2);
      expect(manualTemporal).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ content: 'Alice is alive pending review.' }),
          expect.objectContaining({ content: 'Alice is dead pending review.' }),
        ]),
      );

      await expect(
        engine.resolveConflict({
          memoryIdA: 'missing-memory',
          memoryIdB: manualPair.newerId,
        }),
      ).resolves.toEqual({
        status: 'error',
        error: 'Memory not found',
        missing: ['missing-memory'],
      });
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('preserves richer metadata when merge resolution combines sparse newer memories', async () => {
    const tempDir = join(tmpdir(), `niko-memory-merge-metadata-${randomUUID()}`);
    const engine = new memory.UnifiedMemoryEngine({ dbPath: join(tempDir, 'memory.db') });

    try {
      const older = await engine.add({
        content: 'Atlas dossier says Alice leads the archive team.',
        layer: memory.MemoryLayer.PROJECT,
        dimension: memory.MemoryDimension.CHARACTER,
        entityId: 'alice-merge-metadata',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T00:00:00Z',
        importance: 0.4,
        confidence: 0.55,
        tags: ['atlas', 'legacy'],
        userId: 'archivist',
        projectId: 'atlas-project',
        source: 'imported',
      });
      const newer = await engine.add({
        content: 'Recent update says Alice left the archive team.',
        layer: memory.MemoryLayer.PROJECT,
        dimension: null,
        entityId: 'alice-merge-metadata',
        validFrom: '2026-06-01T00:00:00Z',
        importance: 0.92,
        confidence: 0.97,
        tags: ['atlas', 'update'],
        sessionId: 'session-merge-1',
        source: 'user',
      });

      const db = (
        engine as unknown as {
          _db: {
            prepare: (
              sql: string,
            ) => {
              run: (...params: unknown[]) => void;
              get: (...params: unknown[]) => Record<string, unknown> | undefined;
            };
          };
        }
      )._db;

      db.prepare('UPDATE memories SET superseded_by = NULL WHERE id IN (?, ?)').run(
        older.id,
        newer.id,
      );

      const resolution = await engine.resolveConflict({
        memoryIdA: older.id as string,
        memoryIdB: newer.id as string,
        resolution: 'merge',
      });
      const mergedTemporal = await engine.getTemporalFacts({
        entityId: 'alice-merge-metadata',
        projectId: 'atlas-project',
      });
      const mergedRow = db
        .prepare(
          `SELECT dimension, valid_from, valid_until, user_id, project_id, session_id, importance, confidence, source, tags
           FROM memories WHERE id = ?`,
        )
        .get(resolution.kept as string);

      expect(resolution).toMatchObject({
        status: 'resolved',
        kept: expect.any(String),
        removed: [older.id, newer.id],
        merged_content:
          'Atlas dossier says Alice leads the archive team.\n\n[Updated]: Recent update says Alice left the archive team.',
      });
      expect(mergedTemporal).toEqual([
        expect.objectContaining({
          id: resolution.kept,
          dimension: memory.MemoryDimension.CHARACTER,
          valid_from: '2026-01-01T00:00:00Z',
          valid_until: '2026-12-31T00:00:00Z',
          importance: 0.92,
        }),
      ]);
      expect(mergedRow).toMatchObject({
        dimension: memory.MemoryDimension.CHARACTER,
        valid_from: '2026-01-01T00:00:00Z',
        valid_until: '2026-12-31T00:00:00Z',
        user_id: 'archivist',
        project_id: 'atlas-project',
        session_id: 'session-merge-1',
        importance: 0.92,
        confidence: 0.97,
        source: 'user',
      });
      expect(JSON.parse(String(mergedRow?.tags))).toEqual(['atlas', 'legacy', 'update']);
    } finally {
      engine.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
