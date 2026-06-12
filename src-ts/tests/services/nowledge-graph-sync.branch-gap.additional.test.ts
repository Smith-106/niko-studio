import { describe, expect, it, vi } from 'vitest';

import { NowledgeGraphSync } from '../../services/nowledge-graph-sync.js';
import type { KnowledgeEntity, KnowledgeRelation } from '../../protocols/knowledge.js';

function createEntity(overrides: Partial<KnowledgeEntity> = {}): KnowledgeEntity {
  return {
    id: 'hero',
    name: 'Hero',
    type: 'character',
    ...overrides,
  };
}

function createRelation(overrides: Partial<KnowledgeRelation> = {}): KnowledgeRelation {
  return {
    id: 'rel-1',
    sourceId: 'hero',
    targetId: 'mentor',
    type: 'knows',
    ...overrides,
  };
}

function createHarness(options: {
  entities?: KnowledgeEntity[];
  relations?: KnowledgeRelation[];
  graphNodes?: Record<string, unknown>;
  withEventBus?: boolean;
  withConflictBridge?: boolean;
} = {}) {
  const entities = new Map((options.entities ?? []).map(entity => [entity.id, entity]));
  const relations = new Map((options.relations ?? []).map(relation => [relation.id, relation]));
  const graphNodes = new Map(Object.entries(options.graphNodes ?? {}));

  const knowledgeService = {
    addEntity: vi.fn(async (entity: KnowledgeEntity) => {
      entities.set(entity.id, entity);
    }),
    addRelation: vi.fn(),
    getEntity: vi.fn((entityId: string) => entities.get(entityId)),
    getRelation: vi.fn((relationId: string) => relations.get(relationId)),
    listEntities: vi.fn(() => Array.from(entities.values())),
    listRelations: vi.fn(() => Array.from(relations.values())),
  };

  const graphEngine = {
    addNode: vi.fn(async (entityId: string, node: unknown) => {
      graphNodes.set(entityId, node);
    }),
    addEdge: vi.fn(async () => undefined),
    getNode: vi.fn(async (entityId: string) => (
      graphNodes.has(entityId) ? graphNodes.get(entityId) : null
    )),
  };

  const eventBus = options.withEventBus === false
    ? undefined
    : {
      publish: vi.fn(),
    };

  const conflictBridge = options.withConflictBridge === false
    ? undefined
    : {
      detectConflicts: vi.fn(async () => [] as string[]),
    };

  const sync = new NowledgeGraphSync({
    knowledgeService: knowledgeService as never,
    graphEngine: graphEngine as never,
    eventBus: eventBus as never,
    conflictBridge: conflictBridge as never,
  });

  return {
    sync,
    knowledgeService,
    graphEngine,
  };
}

describe('services/nowledge-graph-sync branch gaps', () => {
  it('stringifies non-Error entity push failures and tolerates missing event bus', async () => {
    const harness = createHarness({
      entities: [createEntity()],
      withEventBus: false,
      withConflictBridge: false,
    });

    harness.graphEngine.addNode.mockRejectedValueOnce(503);

    await expect(harness.sync.syncEntityToGraph('hero')).resolves.toMatchObject({
      success: false,
      entityId: 'hero',
      direction: 'to-graph',
      error: '503',
    });

    await expect(harness.sync.syncEntityToGraph('hero')).resolves.toMatchObject({
      success: true,
      entityId: 'hero',
      direction: 'to-graph',
    });
  });

  it('stringifies non-Error failures for relation push and graph pull', async () => {
    const relationHarness = createHarness({
      relations: [createRelation()],
    });
    relationHarness.graphEngine.addEdge.mockRejectedValueOnce(404);

    await expect(relationHarness.sync.syncRelationToGraph('rel-1')).resolves.toMatchObject({
      success: false,
      entityId: 'rel-1',
      direction: 'to-graph',
      error: '404',
    });

    const pullHarness = createHarness({
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
    });
    pullHarness.knowledgeService.addEntity.mockRejectedValueOnce('write exploded');

    await expect(pullHarness.sync.syncGraphToKnowledge('hero')).resolves.toMatchObject({
      success: false,
      entityId: 'hero',
      direction: 'to-knowledge',
      error: 'write exploded',
    });
  });

  it('stringifies non-Error child crashes during bulk sync in both directions', async () => {
    const toGraphHarness = createHarness({
      entities: [createEntity()],
      relations: [createRelation()],
    });
    vi.spyOn(toGraphHarness.sync, 'syncEntityToGraph').mockRejectedValueOnce(7);
    vi.spyOn(toGraphHarness.sync, 'syncRelationToGraph').mockRejectedValueOnce({ code: 'REL' });

    const toGraph = await toGraphHarness.sync.syncAll('to-graph');

    expect(toGraph.failed).toBe(2);
    expect(toGraph.results.map(result => result.error)).toEqual([
      '7',
      '[object Object]',
    ]);

    const toKnowledgeHarness = createHarness({
      entities: [createEntity()],
    });
    vi.spyOn(toKnowledgeHarness.sync, 'syncGraphToKnowledge').mockRejectedValueOnce(false);

    const toKnowledge = await toKnowledgeHarness.sync.syncAll('to-knowledge');

    expect(toKnowledge.failed).toBe(1);
    expect(toKnowledge.results[0]).toMatchObject({
      entityId: 'hero',
      direction: 'to-knowledge',
      error: 'false',
    });
  });
});
