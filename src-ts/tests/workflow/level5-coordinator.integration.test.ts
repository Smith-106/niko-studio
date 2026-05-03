/**
 * L5 Coordinator integration test (PLN-006 Phase 2 / TASK-007)
 *
 * Closes SC-3 from Phase 2 + the deferred Phase 1 DI step:
 *   1. GraphManager → VectorSearch wiring (setVectorSearch) fires the
 *      embedding hook on createEntity (proven by inspecting the vector_items
 *      table after a 200ms settle wait — embedding is fire-and-forget per
 *      Phase 1 review F-003).
 *   2. Level5Coordinator's analyze phase (cmd_1 of chapter_revision) goes
 *      through the default IterativeRetriever → GraphEngine.searchEntitiesByName
 *      and surfaces the seeded Character via state.metadata.analysis.
 *
 * GraphManager and GraphEngine maintain separate SQLite schemas (parallel
 * implementations from the Python migration), so the test seeds the entity
 * via BOTH:
 *   - GraphManager.createEntity → exercises the setVectorSearch embed hook
 *   - GraphEngine.createEntity   → exposed to IterativeRetriever's keyword
 *                                  graph search via GRAPH_DB_PATH env var
 *
 * Skip-on-missing-model: real VectorSearch requires the BAAI/bge-small-en-v1.5
 * embedding model. If the model can't load locally (no fastembed binary, no
 * cached weights), we skip the test with a clear reason rather than failing —
 * the wiring code is still validated by typecheck and the unit-level
 * setVectorSearch test below.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

import Database from 'better-sqlite3';

import {
  Entity,
  EntityType,
  GraphManager,
  type IEntityVectorSearch,
} from '../../graph/graph-manager.js';
import { GraphEngine } from '../../graph/graph-engine.js';
import { VectorSearch } from '../../search/vector-search.js';
import { EmbeddingServiceImpl, ProviderType } from '../../services/embedding-service.js';
import { LocalEmbeddingProvider } from '../../knowledge/providers/local-embedding.js';
import type { EmbeddingProvider, EmbeddingService, BatchEmbeddingResponse } from '../../protocols/embedding.js';
import { Level5Coordinator } from '../../workflow/levels/level5-coordinator.js';
import type { BaseState } from '../../workflow/state.js';

// ----------------------------------------------------------------------
// Tmp dir lifecycle
// ----------------------------------------------------------------------

interface TestPaths {
  root: string;
  graphManagerDb: string;
  graphEngineDb: string;
  vectorDb: string;
  persistDir: string;
}

function makeTestPaths(): TestPaths {
  const root = path.join(os.tmpdir(), `niko-l5-integration-${randomUUID()}`);
  fs.mkdirSync(root, { recursive: true });
  return {
    root,
    graphManagerDb: path.join(root, 'graph-manager.db'),
    graphEngineDb: path.join(root, 'graph.db'),
    vectorDb: path.join(root, 'vectors.db'),
    persistDir: path.join(root, 'coordinator-state'),
  };
}

function cleanupPaths(paths: TestPaths): void {
  fs.rmSync(paths.root, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// Embedding service factory — reuses the production wiring from
// container/bindings.ts so we exercise the real fastembed path.
// ----------------------------------------------------------------------

const DEFAULT_VECTOR_MODEL = 'BAAI/bge-small-en-v1.5';
const DEFAULT_VECTOR_DIMENSION = 384;

function createProductionEmbeddingService(): EmbeddingService {
  const localProvider = new LocalEmbeddingProvider({
    modelName: DEFAULT_VECTOR_MODEL,
    backend: 'fastembed',
  });
  const productionProvider: EmbeddingProvider = {
    providerType: ProviderType.LOCAL,
    async embed(texts: string[], model: string, options?: { dimensions?: number }): Promise<BatchEmbeddingResponse> {
      const response = await localProvider.embed(texts, model, options);
      return {
        embeddings: response.embeddings,
        model: response.modelUsed,
        provider: response.provider,
        dimensions: response.dimensions,
        usage: response.usage,
        latencyMs: response.latencyMs,
        cacheHits: response.cacheHits,
      };
    },
    async healthCheck(): Promise<boolean> {
      return localProvider.healthCheck();
    },
    getDimensions(model: string): number {
      return localProvider.getDimensions(model);
    },
  };

  return new EmbeddingServiceImpl(
    new Map<ProviderType, EmbeddingProvider>([[ProviderType.LOCAL, productionProvider]]),
    {
      defaultProvider: ProviderType.LOCAL,
      defaultModel: DEFAULT_VECTOR_MODEL,
    },
  );
}

/** Probe whether the local embedding model can load — used to skip when offline / no cache. */
async function isEmbeddingModelAvailable(): Promise<{ available: boolean; reason: string }> {
  try {
    const embeddingService = createProductionEmbeddingService();
    // A single embed call forces _ensureModel() to hit the model loader.
    const result = await embeddingService.embed('probe', { model: DEFAULT_VECTOR_MODEL });
    if (Array.isArray(result) && result.length === DEFAULT_VECTOR_DIMENSION) {
      return { available: true, reason: '' };
    }
    return { available: false, reason: `Embedding probe returned unexpected shape (length=${result?.length ?? 'n/a'})` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, reason: message };
  }
}

// ----------------------------------------------------------------------
// Suite
// ----------------------------------------------------------------------

describe('Level5Coordinator integration: entity → embed → retrieve through L5', () => {
  let paths: TestPaths;
  let savedGraphDbPath: string | undefined;
  let modelAvailable = false;
  let modelSkipReason = '';

  beforeAll(async () => {
    const probe = await isEmbeddingModelAvailable();
    modelAvailable = probe.available;
    modelSkipReason = probe.reason;
    if (!modelAvailable) {
      // eslint-disable-next-line no-console
      console.warn(`[TASK-007 integration] Skipping integration assertions — embedding model unavailable: ${modelSkipReason}`);
    }
  }, 60_000);

  beforeEach(() => {
    paths = makeTestPaths();
    savedGraphDbPath = process.env.GRAPH_DB_PATH;
    process.env.GRAPH_DB_PATH = paths.graphEngineDb;
    // Suppress noisy info/warn logs from real services during the test run.
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (savedGraphDbPath === undefined) {
      delete process.env.GRAPH_DB_PATH;
    } else {
      process.env.GRAPH_DB_PATH = savedGraphDbPath;
    }
    GraphManager.setDefaultVectorSearch(null);
    vi.restoreAllMocks();
    cleanupPaths(paths);
  });

  afterAll(() => {
    GraphManager.setDefaultVectorSearch(null);
  });

  it('setVectorSearch wiring is exposed on GraphManager (unit-level smoke)', async () => {
    // Always-on guard: even when the embedding model is unavailable, the
    // setVectorSearch surface itself must exist and be callable. This is the
    // half of SC-3 that doesn't depend on the model loader.
    const manager = new GraphManager(paths.graphManagerDb);
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const fakeVectorSearch: IEntityVectorSearch = {
      async add(id, content, metadata, type) {
        calls.push({ method: 'add', args: [id, content, metadata, type] });
      },
      async delete(id) {
        calls.push({ method: 'delete', args: [id] });
        return true;
      },
    };

    try {
      manager.setVectorSearch(fakeVectorSearch);

      const entityId = manager.createEntity(new Entity({
        id: 'char-test-warrior',
        name: 'Test Warrior',
        type: EntityType.CHARACTER,
        properties: { description: 'a brave test warrior' },
      }));

      // Embedding is fire-and-forget — wait a tick for the microtask to flush.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(calls.some((c) => c.method === 'add' && c.args[0] === entityId)).toBe(true);
      const addCall = calls.find((c) => c.method === 'add')!;
      expect(addCall.args[1]).toContain('Test Warrior');
      expect(addCall.args[3]).toBe('entity');

      // Update path
      manager.updateEntity(new Entity({
        id: entityId,
        name: 'Test Warrior',
        type: EntityType.CHARACTER,
        properties: { description: 'an updated brave test warrior' },
      }));

      // Delete path
      manager.deleteEntity(entityId);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const addCalls = calls.filter((c) => c.method === 'add');
      const delCalls = calls.filter((c) => c.method === 'delete');
      expect(addCalls.length).toBeGreaterThanOrEqual(2); // create + update
      expect(delCalls.length).toBe(1);
    } finally {
      manager.close();
    }
  });

  it('end-to-end: GraphManager.createEntity embeds the entity AND L5 analyze surfaces it', async () => {
    if (!modelAvailable) {
      // eslint-disable-next-line no-console
      console.warn(`[TASK-007] Skipped end-to-end assertion: ${modelSkipReason}`);
      return;
    }

    // 1. Build real services pointed at tmp dirs.
    const embeddingService = createProductionEmbeddingService();
    const vectorSearch = new VectorSearch({
      dbPath: paths.vectorDb,
      dimension: DEFAULT_VECTOR_DIMENSION,
      modelName: DEFAULT_VECTOR_MODEL,
      embeddingService,
    });

    const graphManager = new GraphManager(paths.graphManagerDb);
    const graphEngine = new GraphEngine(paths.graphEngineDb);

    try {
      // 2. Mirror gateway bootstrap wiring.
      graphManager.setVectorSearch(vectorSearch as unknown as IEntityVectorSearch);

      // 3. Create the entity through GraphManager (exercises embed hook).
      const characterName = '勇敢的战士 (brave warrior)';
      const characterDescription = 'a brave warrior who fights monsters';
      const characterId = graphManager.createEntity(new Entity({
        id: 'char-brave-warrior',
        name: characterName,
        type: EntityType.CHARACTER,
        properties: { description: characterDescription },
      }));

      // 4. Also seed via GraphEngine so IterativeRetriever's keyword graph
      //    search can find it. GraphManager and GraphEngine use separate
      //    schemas, so we must seed both.
      const engineResult = await graphEngine.createEntity('Character', characterName, {
        description: characterDescription,
        graph_manager_id: characterId,
      });
      expect(engineResult).not.toHaveProperty('error');

      // 5. Wait for the fire-and-forget embedding to settle.
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));

      // 6. Verify the embedding row landed in vectors.db (Phase 1 wiring proof).
      const vectorDb = new Database(paths.vectorDb, { readonly: true });
      try {
        const row = vectorDb
          .prepare('SELECT id, content FROM vector_items WHERE id = ?')
          .get(characterId) as { id: string; content: string } | undefined;
        expect(row, 'expected embedding row for ' + characterId).toBeDefined();
        expect(row?.content).toContain('warrior');
      } finally {
        vectorDb.close();
      }

      // 7. Run L5 with the default analysisRetriever.
      const l5 = new Level5Coordinator(
        { persist_dir: paths.persistDir, retrieval_profile: 'coordinator_quality' },
      );
      const inputState: BaseState = {
        user_request: 'find brave warrior characters',
        domain: 'novel',
      };

      const finalState = await l5.execute(inputState);

      // 8. Assert L5 reached its analyze phase and surfaced the entity.
      const metadata = (finalState.metadata ?? {}) as Record<string, unknown>;
      const analysis = metadata.analysis as Array<Record<string, unknown>> | undefined;

      expect(analysis, 'L5 analyze phase should populate metadata.analysis').toBeDefined();
      expect(Array.isArray(analysis)).toBe(true);
      expect(analysis!.length).toBeGreaterThan(0);

      // At least one analysis entry must reference the seeded Character —
      // either via source ('graph') or via preview content (matches Chinese
      // name fragment, English alias, or the description keyword "warrior").
      const matchesCharacter = analysis!.some((entry) => {
        const source = String(entry.source ?? '');
        const preview = String(entry.preview ?? '');
        return (
          source === 'graph' ||
          preview.includes('warrior') ||
          preview.includes('勇敢') ||
          preview.includes('战士')
        );
      });
      expect(matchesCharacter, `expected analysis to reference the seeded Character. Got: ${JSON.stringify(analysis)}`).toBe(true);
    } finally {
      vectorSearch.close();
      graphManager.close();
      graphEngine.db.close();
    }
  }, 120_000);
});
