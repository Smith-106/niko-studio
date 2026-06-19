import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityType } from '../../graph/graph-manager.js';
import { DimensionType } from '../../memory/six-dimensional-memory.js';
import { NarrativeRelationType } from '../../services/mappers/narrative-relation-mapper.js';
import { NarrativeEngine } from '../../services/narrative-engine.js';

describe('services/narrative-engine', () => {
  const graphManager = {
    addEntity: vi.fn(),
    getEntity: vi.fn(),
    queryEntities: vi.fn(),
    addRelation: vi.fn(),
    traverse: vi.fn(),
  };
  const memoryStore = {
    addMemory: vi.fn(),
    searchMemories: vi.fn(),
    getRecentMemories: vi.fn(),
  };
  const bridge = {
    pushEntity: vi.fn(),
    pushMemory: vi.fn(),
    syncFromKnowledgeLayer: vi.fn(),
    syncToKnowledgeLayer: vi.fn(),
    getSyncStatus: vi.fn(),
    getPendingConflicts: vi.fn(),
  };

  let engine: NarrativeEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new NarrativeEngine(
      graphManager as never,
      memoryStore as never,
      bridge as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies entity and memory writes while swallowing async bridge sync failures', async () => {
    graphManager.addEntity.mockResolvedValueOnce('entity-1');
    memoryStore.addMemory.mockResolvedValueOnce('memory-1');
    graphManager.getEntity.mockResolvedValueOnce({ id: 'entity-1', name: 'Aster' });
    graphManager.getEntity.mockResolvedValueOnce(undefined);
    graphManager.queryEntities.mockResolvedValueOnce([{ id: 'entity-1' }]);
    graphManager.addRelation.mockResolvedValueOnce('relation-1');
    graphManager.traverse.mockResolvedValueOnce({ nodes: ['entity-1'] });
    memoryStore.searchMemories.mockResolvedValueOnce([{ id: 'memory-1' }]);
    bridge.pushEntity.mockRejectedValueOnce(new Error('offline'));
    bridge.pushMemory.mockRejectedValueOnce(new Error('offline'));

    await expect(
      engine.addEntity(EntityType.CHARACTER, {
        name: 'Aster',
        description: 'Dockside detective',
        aliases: ['Ast'],
        tags: ['pov'],
      }),
    ).resolves.toBe('entity-1');
    await expect(
      engine.addNarrativeMemory(DimensionType.CHARACTER, 'Aster keeps the ledger hidden.', {
        entityId: 'entity-1',
        importance: 0.8,
        chapter: 2,
      }),
    ).resolves.toBe('memory-1');

    expect(graphManager.addEntity).toHaveBeenCalledWith(
      EntityType.CHARACTER,
      'Aster',
      'Dockside detective',
      expect.objectContaining({
        aliases: ['Ast'],
        tags: ['pov'],
      }),
    );
    expect(bridge.pushEntity).toHaveBeenCalledWith(
      'entity-1',
      expect.objectContaining({
        type: EntityType.CHARACTER,
        name: 'Aster',
      }),
    );
    expect(bridge.pushMemory).toHaveBeenCalledWith(
      'memory-1',
      expect.objectContaining({
        dimension: DimensionType.CHARACTER,
        content: 'Aster keeps the ledger hidden.',
        entityId: 'entity-1',
        importance: 0.8,
        chapter: 2,
      }),
    );

    await expect(engine.getEntity('entity-1')).resolves.toEqual({
      id: 'entity-1',
      name: 'Aster',
    });
    await expect(engine.getEntity('missing')).resolves.toBeNull();
    await expect(engine.queryEntities({ type: EntityType.CHARACTER })).resolves.toEqual([
      { id: 'entity-1' },
    ]);
    await expect(
      engine.addRelation('entity-1', 'entity-2', NarrativeRelationType.FORESHADOWS, 0.9),
    ).resolves.toBe('relation-1');
    await expect(
      engine.traverse('entity-1', { depth: 2, relationTypes: [NarrativeRelationType.FORESHADOWS] }),
    ).resolves.toEqual({ nodes: ['entity-1'] });
    await expect(
      engine.queryNarrativeMemory(DimensionType.CHARACTER, 'Aster', { limit: 3 }),
    ).resolves.toEqual([{ id: 'memory-1' }]);

    expect(memoryStore.searchMemories).toHaveBeenCalledWith('Aster', {
      dimension: DimensionType.CHARACTER,
      limit: 3,
    });
  });

  it('tracks foreshadows and assembles writing context', async () => {
    const randomUUIDSpy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('foreshadow-1')
      .mockReturnValueOnce('foreshadow-2');

    graphManager.addRelation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('graph unavailable'));
    graphManager.queryEntities.mockResolvedValueOnce([
      { id: 'entity-1', name: 'Aster' },
    ]);
    memoryStore.getRecentMemories.mockResolvedValueOnce([
      { dimension: DimensionType.TIMELINE, content: 'Aster lost the witness.' },
      { content: 'The dock bell tolled once.' },
    ]);
    bridge.getPendingConflicts.mockResolvedValueOnce([
      { description: 'Timeline drift near the warehouse.' },
    ]);

    await expect(
      engine.plantForeshadow('entity-1', 'A key rattles in the lock.', 1, {
        maxDistance: 10,
        reminderThreshold: 3,
      }),
    ).resolves.toBe('foreshadow-1');

    await engine.resolveForeshadow('foreshadow-1', 3, 'The key opens the ledger room.');
    await expect(engine.getPendingForeshadows(3)).resolves.toEqual([]);

    await expect(
      engine.plantForeshadow('entity-2', 'A bell toll marks the ambush.', 1, {
        maxDistance: 5,
        reminderThreshold: 2,
      }),
    ).resolves.toBe('foreshadow-2');

    await expect(engine.getPendingForeshadows(6)).resolves.toEqual([
      {
        foreshadowId: 'foreshadow-2',
        hint: 'A bell toll marks the ambush.',
        plantedAt: 1,
        currentChapter: 6,
        chaptersUntilDue: 0,
        urgency: 'overdue',
      },
    ]);

    await expect(engine.getWritingContext(6, 'project-1')).resolves.toEqual({
      entities: [{ id: 'entity-1', name: 'Aster' }],
      recentMemories: [
        { dimension: DimensionType.TIMELINE, content: 'Aster lost the witness.' },
        { dimension: DimensionType.CONTEXT, content: 'The dock bell tolled once.' },
      ],
      pendingForeshadows: [
        {
          foreshadowId: 'foreshadow-2',
          hint: 'A bell toll marks the ambush.',
          plantedAt: 1,
          currentChapter: 6,
          chaptersUntilDue: 0,
          urgency: 'overdue',
        },
      ],
      contradictions: [{ description: 'Timeline drift near the warehouse.' }],
    });

    await expect(engine.getPendingForeshadows(7)).resolves.toEqual([]);

    expect(graphManager.addRelation).toHaveBeenNthCalledWith(
      1,
      'entity-1',
      'foreshadow-1',
      NarrativeRelationType.FORESHADOWS,
    );
    expect(graphManager.addRelation).toHaveBeenNthCalledWith(
      2,
      'entity-2',
      'foreshadow-2',
      NarrativeRelationType.FORESHADOWS,
    );

    randomUUIDSpy.mockRestore();
  });

  it('delegates analysis and knowledge sync methods', async () => {
    bridge.syncFromKnowledgeLayer.mockResolvedValueOnce({ synced: true });
    bridge.syncToKnowledgeLayer.mockResolvedValueOnce({ pushed: 2 });
    bridge.getSyncStatus.mockReturnValue({ connected: true });

    await expect(engine.analyzeHook('然而，真相究竟是什么？')).resolves.toMatchObject({
      hookType: expect.any(String),
      score: expect.any(Number),
    });
    await expect(engine.analyzeCliffhanger('她推开门，却发现里面空无一人。')).resolves.toMatchObject({
      score: expect.any(Number),
      curiosity: expect.any(Number),
    });
    await expect(engine.analyzeEmotionCraft('她的手指微微颤抖，胸口像被什么堵住了。')).resolves.toMatchObject({
      showTellRatio: expect.any(Number),
      dominantLayer: expect.any(String),
    });
    await expect(engine.analyzeSuspense('秘密、威胁与倒计时同时逼近。')).resolves.toMatchObject({
      score: expect.any(Number),
      informationGap: expect.any(Number),
    });
    await expect(engine.generateQualityReport('然而，秘密就在那扇门后。')).resolves.toMatchObject({
      overall: expect.any(Number),
      dimensions: expect.objectContaining({
        hook: expect.any(Number),
      }),
    });

    await expect(engine.syncFromKnowledgeLayer()).resolves.toEqual({ synced: true });
    await expect(
      engine.syncToKnowledgeLayer([
        {
          localId: 'entity-1',
          input: {
            type: EntityType.CHARACTER,
            name: 'Aster',
            description: 'Detective',
            aliases: [],
            tags: [],
          },
        },
      ]),
    ).resolves.toEqual({ pushed: 2 });
    expect(engine.getSyncStatus()).toEqual({ connected: true });
  });
});
