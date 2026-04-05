import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { GraphEngine } from '../../graph/graph-engine';
import {
  MemoryDimension,
  MemoryLayer,
  resetUnifiedMemoryEngine,
  setConfigProvider,
  UnifiedMemoryEngine,
} from '../../memory';
import { createIterativeRetriever } from '../../search';

describe('search/iterative-retriever', () => {
  afterEach(() => {
    resetUnifiedMemoryEngine();
    setConfigProvider((_key, defaultValue) => defaultValue);
  });

  it('adapts the unified memory runtime to the retriever memory-provider contract', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-${randomUUID()}`);
    const dbPath = join(tempRoot, 'memory.db');
    let retriever: ReturnType<typeof createIterativeRetriever> | null = null;

    setConfigProvider((key, defaultValue) => {
      if (key === 'memory.db_path') return dbPath;
      if (key === 'data_dir') return null;
      return defaultValue;
    });

    const seedEngine = new UnifiedMemoryEngine({ dbPath });

    try {
      await seedEngine.add({
        content: 'Alice guards the silver key in the archive.',
        layer: MemoryLayer.SESSION,
        dimension: MemoryDimension.CONTEXT,
        entityId: 'alice-retriever',
        importance: 0.91,
        tags: ['phase4', 'retriever'],
      });
      seedEngine.upsertRetrievalProfile({
        profileName: 'phase4-retriever',
        sourceWeights: { memory: 1, graph: 0.25, file: 0.1 },
        thresholds: { min_score: 0.2 },
        budget: { budget_tokens: 1200 },
        enabled: true,
      });
      seedEngine.close();

      retriever = createIterativeRetriever({ projectRoot: tempRoot });
      const results = await retriever.memoryEngine.search(
        'Alice guards the silver key in the archive.',
        {
          dimensions: [MemoryDimension.CONTEXT],
          limit: 5,
        },
      );
      const profile = retriever.memoryEngine.getRetrievalProfile?.('phase4-retriever');

      expect(results).toEqual([
        expect.objectContaining({
          content: 'Alice guards the silver key in the archive.',
          dimension: MemoryDimension.CONTEXT,
          entity_id: 'alice-retriever',
        }),
      ]);
      expect(profile).toMatchObject({
        profile_name: 'phase4-retriever',
        source_weights_json: { memory: 1, graph: 0.25, file: 0.1 },
        thresholds_json: { min_score: 0.2 },
        budget_json: { budget_tokens: 1200 },
        enabled: true,
      });
    } finally {
      const provider = (retriever as unknown as {
        _memoryEngine?: { engine?: { close?: () => void } };
      }) ?? {};
      provider._memoryEngine?.engine?.close?.();
      resetUnifiedMemoryEngine();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('lazily instantiates the ts graph runtime for graph-backed context resolution', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-retriever-graph-${randomUUID()}`);
    const previousDataDir = process.env.DATA_DIR;
    let retriever: ReturnType<typeof createIterativeRetriever> | null = null;

    process.env.DATA_DIR = tempRoot;

    const seedEngine = new GraphEngine(join(tempRoot, 'graph.db'));

    try {
      await seedEngine.createEntity('Character', 'Alice', { role: 'lead', squad: 'archive' });
      await seedEngine.createEntity('Foreshadow', 'SilverBell', {
        status: 'pending',
        description: 'The bell tolls before the vault opens.',
      });
      seedEngine.close();

      retriever = createIterativeRetriever({ projectRoot: tempRoot });
      const resolved = await retriever.resolveContext(
        'Signal @character:Alice before @foreshadow:SilverBell.',
      );

      expect(resolved).toContain('[character:Alice]');
      expect(resolved).toContain('[foreshadow:SilverBell]');
      expect(resolved).toContain('名称: Alice');
      expect(resolved).toContain('"role":"lead"');
      expect(resolved).toContain('伏笔: SilverBell');
      expect(resolved).toContain('状态: pending');
      expect(resolved).toContain('描述: The bell tolls before the vault opens.');
    } finally {
      const provider = (retriever as unknown as {
        _graphEngine?: { close?: () => void };
      }) ?? {};
      provider._graphEngine?.close?.();
      if (previousDataDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = previousDataDir;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
