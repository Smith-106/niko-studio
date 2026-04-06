import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIntegrationAdapters, StubPostgresShadowAdapter } from '../../integrations';
import {
  getUnifiedMemoryEngine,
  MemoryDimension,
  MemoryLayer,
  resetUnifiedMemoryEngine,
  UnifiedMemoryEngine,
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

function createDbPath(label: string): { basePath: string; dbPath: string } {
  const basePath = join(tmpdir(), `niko-memory-${label}-${randomUUID()}`);
  return { basePath, dbPath: join(basePath, 'memory.db') };
}

describe('UnifiedMemoryEngine integration adapters', () => {
  afterEach(() => {
    resetUnifiedMemoryEngine();
    restorePostgresEnv();
    vi.restoreAllMocks();
  });

  it('keeps the local-first add path when postgres shadow-write is disabled', async () => {
    restorePostgresEnv();
    const adapters = createIntegrationAdapters();
    const shadowWriteSpy = vi.spyOn(adapters.storageShadow, 'shadowWriteMemory');
    const { basePath, dbPath } = createDbPath('shadow-disabled');
    const engine = new UnifiedMemoryEngine({
      dbPath,
      integrationAdapters: adapters,
    });

    try {
      const added = await engine.add({
        content: 'Alice keeps the memory local when shadow write is disabled.',
        layer: MemoryLayer.SESSION,
        dimension: MemoryDimension.CONTEXT,
        entityId: 'alice-disabled',
        importance: 0.7,
        tags: ['phase4', 'local-first'],
      });
      const temporal = await engine.getTemporalFacts({ entityId: 'alice-disabled' });

      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).not.toHaveBeenCalled();
      expect(temporal).toHaveLength(1);
      expect(temporal[0]).toMatchObject({
        content: 'Alice keeps the memory local when shadow write is disabled.',
        dimension: MemoryDimension.CONTEXT,
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('invokes the injected shadow-write adapter when postgres integration is enabled', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const adapters = createIntegrationAdapters();
    const shadowWriteSpy = vi.spyOn(adapters.storageShadow, 'shadowWriteMemory');
    const { basePath, dbPath } = createDbPath('shadow-enabled');
    const engine = new UnifiedMemoryEngine({
      dbPath,
      integrationAdapters: adapters,
    });

    try {
      const added = await engine.add({
        content: 'Bob synchronizes this memory through the optional shadow path.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'bob-enabled',
        validFrom: '2026-04-01T00:00:00Z',
        validUntil: '2026-10-01T00:00:00Z',
        importance: 0.9,
        confidence: 0.88,
        source: 'imported',
        tags: ['phase4', 'shadow-write'],
      });
      const temporal = await engine.getTemporalFacts({ entityId: 'bob-enabled' });

      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(shadowWriteSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        content: 'Bob synchronizes this memory through the optional shadow path.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CHARACTER,
        entity_id: 'bob-enabled',
        valid_from: '2026-04-01T00:00:00Z',
        valid_until: '2026-10-01T00:00:00Z',
        user_id: null,
        project_id: null,
        session_id: null,
        importance: 0.9,
        confidence: 0.88,
        source: 'imported',
        tags: ['phase4', 'shadow-write'],
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }));
      expect(temporal).toHaveLength(1);
      expect(temporal[0]).toMatchObject({
        content: 'Bob synchronizes this memory through the optional shadow path.',
        dimension: MemoryDimension.CHARACTER,
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('preserves the local write when the shadow-write adapter fails', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const adapters = createIntegrationAdapters();
    const shadowWriteSpy = vi
      .spyOn(adapters.storageShadow, 'shadowWriteMemory')
      .mockRejectedValueOnce(new Error('shadow failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { basePath, dbPath } = createDbPath('shadow-failure');
    const engine = new UnifiedMemoryEngine({
      dbPath,
      integrationAdapters: adapters,
    });

    try {
      const added = await engine.add({
        content: 'Carol still stores this memory locally even if shadow sync fails.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.EXPERIENCE,
        entityId: 'carol-failure',
        importance: 0.6,
        tags: ['phase4', 'fallback'],
      });
      const temporal = await engine.getTemporalFacts({ entityId: 'carol-failure' });

      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Postgres shadow write failed, local-first path preserved: Error: shadow failed'),
      );
      expect(temporal).toHaveLength(1);
      expect(temporal[0]).toMatchObject({
        content: 'Carol still stores this memory locally even if shadow sync fails.',
        dimension: MemoryDimension.EXPERIENCE,
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('preserves the local write when the shadow-write adapter does not confirm success', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const adapters = createIntegrationAdapters();
    const shadowWriteSpy = vi
      .spyOn(adapters.storageShadow, 'shadowWriteMemory')
      .mockResolvedValueOnce(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { basePath, dbPath } = createDbPath('shadow-non-success');
    const engine = new UnifiedMemoryEngine({
      dbPath,
      integrationAdapters: adapters,
    });

    try {
      const added = await engine.add({
        content: 'Nora keeps this memory local even when shadow write reports non-success.',
        layer: MemoryLayer.SESSION,
        dimension: MemoryDimension.CONTEXT,
        entityId: 'nora-shadow-non-success',
        importance: 0.62,
        tags: ['phase4', 'shadow-non-success'],
      });
      const temporal = await engine.getTemporalFacts({
        entityId: 'nora-shadow-non-success',
      });

      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'Postgres shadow write returned non-success, local-first path preserved',
      );
      expect(temporal).toHaveLength(1);
      expect(temporal[0]).toMatchObject({
        content:
          'Nora keeps this memory local even when shadow write reports non-success.',
        dimension: MemoryDimension.CONTEXT,
      });
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('uses environment-selected default adapters when no integration bundle is injected', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const shadowWriteSpy = vi.spyOn(StubPostgresShadowAdapter.prototype, 'shadowWriteMemory');
    const { basePath, dbPath } = createDbPath('shadow-default-env');
    const engine = new UnifiedMemoryEngine({ dbPath });

    try {
      const added = await engine.add({
        content: 'Dana relies on the default adapter factory when postgres is enabled.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CONTEXT,
        entityId: 'dana-default-env',
        importance: 0.75,
        tags: ['phase4', 'default-adapters'],
      });
      const temporal = await engine.getTemporalFacts({ entityId: 'dana-default-env' });

      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(shadowWriteSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        content: 'Dana relies on the default adapter factory when postgres is enabled.',
        layer: MemoryLayer.USER,
        dimension: MemoryDimension.CONTEXT,
        entity_id: 'dana-default-env',
        user_id: null,
        project_id: null,
        session_id: null,
        importance: 0.75,
        tags: ['phase4', 'default-adapters'],
        created_at: expect.any(String),
      }));
      expect(temporal).toEqual([
        expect.objectContaining({
          content: 'Dana relies on the default adapter factory when postgres is enabled.',
          dimension: MemoryDimension.CONTEXT,
        }),
      ]);
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('uses environment-selected default adapters on the singleton accessor path', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const shadowWriteSpy = vi.spyOn(StubPostgresShadowAdapter.prototype, 'shadowWriteMemory');
    const { basePath, dbPath } = createDbPath('singleton-default-env');

    try {
      const engine = getUnifiedMemoryEngine({ dbPath });
      const reused = getUnifiedMemoryEngine({ dbPath: join(basePath, 'ignored.db') });

      expect(reused).toBe(engine);
      expect(reused.dbPath).toBe(dbPath);

      const added = await engine.add({
        content: 'Eve relies on singleton creation to pick the default shadow adapter.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.CONTEXT,
        entityId: 'eve-singleton-default-env',
        importance: 0.65,
        tags: ['phase4', 'singleton-default-adapters'],
      });
      const temporal = await engine.getTemporalFacts({ entityId: 'eve-singleton-default-env' });

      expect(added).toMatchObject({ status: 'created' });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(shadowWriteSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        content: 'Eve relies on singleton creation to pick the default shadow adapter.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.CONTEXT,
        entity_id: 'eve-singleton-default-env',
        user_id: null,
        project_id: null,
        session_id: null,
        importance: 0.65,
        tags: ['phase4', 'singleton-default-adapters'],
        created_at: expect.any(String),
      }));
      expect(temporal).toEqual([
        expect.objectContaining({
          content: 'Eve relies on singleton creation to pick the default shadow adapter.',
          dimension: MemoryDimension.CONTEXT,
        }),
      ]);
    } finally {
      resetUnifiedMemoryEngine();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('shadow-writes merged memories with inherited metadata on the merge path', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const shadowWriteSpy = vi.spyOn(StubPostgresShadowAdapter.prototype, 'shadowWriteMemory');
    const { basePath, dbPath } = createDbPath('shadow-merge-default-env');
    const engine = new UnifiedMemoryEngine({ dbPath });

    try {
      const older = await engine.add({
        content: 'Atlas dossier says Alice leads the archive team.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'alice-shadow-merge',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T00:00:00Z',
        importance: 0.4,
        confidence: 0.61,
        source: 'imported',
        tags: ['atlas', 'legacy'],
        projectId: 'atlas-project',
        userId: 'archivist',
      });
      const newer = await engine.add({
        content: 'Recent update says Alice left the archive team.',
        layer: MemoryLayer.PROJECT,
        dimension: null,
        entityId: 'alice-shadow-merge',
        importance: 0.93,
        confidence: 0.98,
        source: 'user',
        tags: ['atlas', 'update'],
        sessionId: 'session-merge-1',
      });

      const db = (
        engine as unknown as {
          _db: {
            prepare: (
              sql: string,
            ) => {
              run: (...params: unknown[]) => void;
            };
          };
        }
      )._db;

      db.prepare('UPDATE memories SET superseded_by = NULL WHERE id IN (?, ?)').run(
        older.id,
        newer.id,
      );
      shadowWriteSpy.mockClear();

      const resolution = await engine.resolveConflict({
        memoryIdA: older.id as string,
        memoryIdB: newer.id as string,
        resolution: 'merge',
      });

      expect(resolution).toMatchObject({
        status: 'resolved',
        kept: expect.any(String),
      });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(shadowWriteSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: resolution.kept,
        content:
          'Atlas dossier says Alice leads the archive team.\n\n[Updated]: Recent update says Alice left the archive team.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.CHARACTER,
        entity_id: 'alice-shadow-merge',
        valid_from: '2026-01-01T00:00:00Z',
        valid_until: '2026-12-31T00:00:00Z',
        user_id: 'archivist',
        project_id: 'atlas-project',
        session_id: 'session-merge-1',
        importance: 0.93,
        confidence: 0.98,
        source: 'user',
        tags: ['atlas', 'legacy', 'update'],
        created_at: expect.any(String),
        updated_at: expect.any(String),
      }));
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });

  it('preserves merge resolution when merge shadow-write throws after local merge is stored', async () => {
    process.env[POSTGRES_ENV_KEY] = 'true';
    const shadowWriteSpy = vi.spyOn(
      StubPostgresShadowAdapter.prototype,
      'shadowWriteMemory',
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { basePath, dbPath } = createDbPath('shadow-merge-failure');
    const engine = new UnifiedMemoryEngine({ dbPath });

    try {
      const older = await engine.add({
        content: 'Atlas notes keep Alice in the archive.',
        layer: MemoryLayer.PROJECT,
        dimension: MemoryDimension.CHARACTER,
        entityId: 'alice-shadow-merge-failure',
        validFrom: '2026-01-01T00:00:00Z',
        validUntil: '2026-12-31T00:00:00Z',
        importance: 0.55,
        confidence: 0.71,
        source: 'imported',
        tags: ['atlas', 'legacy'],
      });
      const newer = await engine.add({
        content: 'Recent update says Alice left the archive.',
        layer: MemoryLayer.PROJECT,
        dimension: null,
        entityId: 'alice-shadow-merge-failure',
        importance: 0.91,
        confidence: 0.97,
        source: 'user',
        tags: ['atlas', 'update'],
      });

      const db = (
        engine as unknown as {
          _db: {
            prepare: (
              sql: string,
            ) => {
              run: (...params: unknown[]) => void;
            };
          };
        }
      )._db;

      db.prepare('UPDATE memories SET superseded_by = NULL WHERE id IN (?, ?)').run(
        older.id,
        newer.id,
      );
      shadowWriteSpy.mockClear();
      shadowWriteSpy.mockRejectedValueOnce(new Error('merge shadow failed'));

      const resolution = await engine.resolveConflict({
        memoryIdA: older.id as string,
        memoryIdB: newer.id as string,
        resolution: 'merge',
      });
      const temporal = await engine.getTemporalFacts({
        entityId: 'alice-shadow-merge-failure',
      });

      expect(resolution).toMatchObject({
        status: 'resolved',
        kept: expect.any(String),
      });
      expect(shadowWriteSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Postgres shadow write failed, local-first path preserved: Error: merge shadow failed',
        ),
      );
      expect(temporal).toEqual([
        expect.objectContaining({
          id: resolution.kept,
          content:
            'Atlas notes keep Alice in the archive.\n\n[Updated]: Recent update says Alice left the archive.',
        }),
      ]);
    } finally {
      engine.close();
      rmSync(basePath, { recursive: true, force: true });
    }
  });
});
