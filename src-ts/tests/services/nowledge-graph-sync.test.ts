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
    entities,
    relations,
    graphNodes,
    knowledgeService,
    graphEngine,
    eventBus,
    conflictBridge,
  };
}

describe('services/nowledge-graph-sync', () => {
  it('pushes entities to the graph, maps defaults, and records conflict status', async () => {
    const entity = createEntity({
      id: 'hero',
      description: undefined,
      properties: undefined,
      createdAt: undefined,
    });
    const harness = createHarness({
      entities: [entity],
      graphNodes: {
        hero: { id: 'hero', name: 'Hero', type: 'character' },
      },
    });
    harness.conflictBridge?.detectConflicts.mockResolvedValue(['conflict-1']);

    const result = await harness.sync.syncEntityToGraph('hero');

    expect(result).toMatchObject({
      success: true,
      entityId: 'hero',
      direction: 'to-graph',
    });
    expect(harness.graphEngine.addNode).toHaveBeenCalledWith(
      'hero',
      expect.objectContaining({
        type: 'character',
        name: 'Hero',
        description: '',
        properties: {},
      }),
    );
    expect(typeof harness.graphEngine.addNode.mock.calls[0]?.[1]?.createdAt).toBe('string');
    expect(harness.eventBus?.publish).toHaveBeenCalledWith('knowledge:entity-synced', {
      entityId: 'hero',
      direction: 'to-graph',
      conflicts: 1,
    });

    const status = await harness.sync.getSyncStatus('hero');

    expect(status.lastSyncAt).toBe(result.syncedAt);
    expect(status.direction).toBe('to-graph');
    expect(status.status).toBe('conflict');
  });

  it('returns a not-found result when an entity is missing', async () => {
    const harness = createHarness();

    await expect(harness.sync.syncEntityToGraph('missing')).resolves.toMatchObject({
      success: false,
      entityId: 'missing',
      direction: 'to-graph',
      error: 'Entity not found: missing',
    });
  });

  it('treats conflict checks and event bus failures as non-blocking during entity push', async () => {
    const harness = createHarness({
      entities: [createEntity()],
    });
    harness.conflictBridge?.detectConflicts.mockRejectedValue(new Error('conflict offline'));
    harness.eventBus?.publish.mockImplementation(() => {
      throw new Error('event bus offline');
    });

    await expect(harness.sync.syncEntityToGraph('hero')).resolves.toMatchObject({
      success: true,
      entityId: 'hero',
      direction: 'to-graph',
    });
  });

  it('returns a failure when graph writes fail during entity push', async () => {
    const harness = createHarness({
      entities: [createEntity()],
    });
    harness.graphEngine.addNode.mockRejectedValue(new Error('graph unavailable'));

    await expect(harness.sync.syncEntityToGraph('hero')).resolves.toMatchObject({
      success: false,
      entityId: 'hero',
      direction: 'to-graph',
      error: 'graph unavailable',
    });
  });

  it('syncs relations to graph edges and records success', async () => {
    const relation = createRelation();
    const harness = createHarness({
      relations: [relation],
    });

    await expect(harness.sync.syncRelationToGraph('rel-1')).resolves.toMatchObject({
      success: true,
      entityId: 'rel-1',
      direction: 'to-graph',
    });
    expect(harness.graphEngine.addEdge).toHaveBeenCalledWith('hero', 'mentor', 'knows');
    expect(harness.eventBus?.publish).toHaveBeenCalledWith('knowledge:relation-synced', {
      relationId: 'rel-1',
      sourceId: 'hero',
      targetId: 'mentor',
      type: 'knows',
      direction: 'to-graph',
    });
  });

  it('returns relation failures for missing relations and edge write errors', async () => {
    const harness = createHarness();

    await expect(harness.sync.syncRelationToGraph('missing')).resolves.toMatchObject({
      success: false,
      entityId: 'missing',
      direction: 'to-graph',
      error: 'Relation not found: missing',
    });

    const relation = createRelation();
    harness.relations.set(relation.id, relation);
    harness.graphEngine.addEdge.mockRejectedValue(new Error('edge write failed'));

    await expect(harness.sync.syncRelationToGraph('rel-1')).resolves.toMatchObject({
      success: false,
      entityId: 'rel-1',
      direction: 'to-graph',
      error: 'edge write failed',
    });
  });

  it('pulls graph nodes into knowledge with default mapping when optional fields are absent', async () => {
    const harness = createHarness({
      graphNodes: {
        orphan: {
          properties: { faction: 'rebels' },
        },
      },
    });
    harness.conflictBridge?.detectConflicts.mockRejectedValue(new Error('conflicts unavailable'));

    const result = await harness.sync.syncGraphToKnowledge('orphan');

    expect(result).toMatchObject({
      success: true,
      entityId: 'orphan',
      direction: 'to-knowledge',
    });
    expect(harness.knowledgeService.addEntity).toHaveBeenCalledWith(expect.objectContaining({
      id: 'orphan',
      name: 'orphan',
      type: 'unknown',
      properties: { faction: 'rebels' },
    }));
    expect(typeof harness.knowledgeService.addEntity.mock.calls[0]?.[0]?.createdAt).toBe('string');
    expect(harness.eventBus?.publish).toHaveBeenCalledWith('knowledge:graph-synced', {
      entityId: 'orphan',
      direction: 'to-knowledge',
    });
  });

  it('records graph pull conflicts without failing the sync', async () => {
    const harness = createHarness({
      graphNodes: {
        conflicted: {
          name: 'Conflicted Hero',
          type: 'character',
        },
      },
    });
    harness.conflictBridge?.detectConflicts.mockResolvedValue(['conflict-a']);

    const result = await harness.sync.syncGraphToKnowledge('conflicted');

    expect(result).toMatchObject({
      success: true,
      entityId: 'conflicted',
      direction: 'to-knowledge',
    });
    expect(harness.eventBus?.publish).toHaveBeenCalledWith('knowledge:graph-synced', {
      entityId: 'conflicted',
      direction: 'to-knowledge',
      conflicts: 1,
    });
    await expect(harness.sync.getSyncStatus('conflicted')).resolves.toMatchObject({
      status: 'conflict',
      direction: 'to-knowledge',
    });
  });

  it('returns graph pull failures for missing nodes and knowledge write errors', async () => {
    const missingHarness = createHarness();

    await expect(missingHarness.sync.syncGraphToKnowledge('ghost')).resolves.toMatchObject({
      success: false,
      entityId: 'ghost',
      direction: 'to-knowledge',
      error: 'Graph node not found: ghost',
    });

    const failingHarness = createHarness({
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
    });
    failingHarness.knowledgeService.addEntity.mockRejectedValue(new Error('knowledge write failed'));

    await expect(failingHarness.sync.syncGraphToKnowledge('hero')).resolves.toMatchObject({
      success: false,
      entityId: 'hero',
      direction: 'to-knowledge',
      error: 'knowledge write failed',
    });
  });

  it('aggregates bidirectional sync results and upgrades successful records to bidirectional', async () => {
    const entity = createEntity();
    const relation = createRelation();
    const harness = createHarness({
      entities: [entity],
      relations: [relation],
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
    });

    const result = await harness.sync.syncAll('bidirectional');

    expect(result.total).toBe(3);
    expect(result.synced).toBe(3);
    expect(result.failed).toBe(0);

    const status = await harness.sync.getSyncStatus('hero');

    expect(status.direction).toBe('bidirectional');
    expect(status.status).toBe('synced');
  });

  it('captures thrown child sync failures during bulk sync in every direction', async () => {
    const toGraphHarness = createHarness({
      entities: [createEntity()],
      relations: [createRelation()],
    });
    vi.spyOn(toGraphHarness.sync, 'syncEntityToGraph').mockRejectedValueOnce(new Error('entity crash'));
    vi.spyOn(toGraphHarness.sync, 'syncRelationToGraph').mockRejectedValueOnce(new Error('relation crash'));

    const toGraph = await toGraphHarness.sync.syncAll('to-graph');

    expect(toGraph.total).toBe(2);
    expect(toGraph.failed).toBe(2);
    expect(toGraph.results.map(result => result.error)).toEqual([
      'entity crash',
      'relation crash',
    ]);

    const toKnowledgeHarness = createHarness({
      entities: [createEntity()],
    });
    vi.spyOn(toKnowledgeHarness.sync, 'syncGraphToKnowledge').mockRejectedValueOnce(new Error('pull crash'));

    const toKnowledge = await toKnowledgeHarness.sync.syncAll('to-knowledge');

    expect(toKnowledge.total).toBe(1);
    expect(toKnowledge.failed).toBe(1);
    expect(toKnowledge.results[0]).toMatchObject({
      entityId: 'hero',
      direction: 'to-knowledge',
      error: 'pull crash',
    });
  });

  it('reports sync status across storage presence combinations and conflict fallback branches', async () => {
    const absent = createHarness({
      withConflictBridge: false,
    });
    await expect(absent.sync.getSyncStatus('ghost')).resolves.toMatchObject({
      entityId: 'ghost',
      status: 'error',
      direction: null,
      lastSyncAt: null,
    });

    const knowledgeOnly = createHarness({
      entities: [createEntity()],
      withConflictBridge: false,
    });
    await expect(knowledgeOnly.sync.getSyncStatus('hero')).resolves.toMatchObject({
      entityId: 'hero',
      status: 'pending',
    });

    const graphOnly = createHarness({
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
      withConflictBridge: false,
    });
    await expect(graphOnly.sync.getSyncStatus('hero')).resolves.toMatchObject({
      entityId: 'hero',
      status: 'pending',
    });

    const unsyncedBoth = createHarness({
      entities: [createEntity()],
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
      withConflictBridge: false,
    });
    await expect(unsyncedBoth.sync.getSyncStatus('hero')).resolves.toMatchObject({
      entityId: 'hero',
      status: 'pending',
    });

    const syncedFallback = createHarness({
      entities: [createEntity()],
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
    });
    await syncedFallback.sync.syncEntityToGraph('hero');
    syncedFallback.conflictBridge?.detectConflicts.mockRejectedValue(new Error('status conflict check failed'));

    await expect(syncedFallback.sync.getSyncStatus('hero')).resolves.toMatchObject({
      entityId: 'hero',
      status: 'synced',
      direction: 'to-graph',
    });

    const syncedWithoutConflictBridge = createHarness({
      entities: [createEntity()],
      graphNodes: {
        hero: {
          name: 'Hero',
          type: 'character',
        },
      },
      withConflictBridge: false,
    });
    await syncedWithoutConflictBridge.sync.syncEntityToGraph('hero');

    await expect(syncedWithoutConflictBridge.sync.getSyncStatus('hero')).resolves.toMatchObject({
      entityId: 'hero',
      status: 'synced',
      direction: 'to-graph',
    });

    const graphLookupFailure = createHarness({
      entities: [createEntity()],
      withConflictBridge: false,
    });
    graphLookupFailure.graphEngine.getNode.mockRejectedValue(new Error('graph read failed'));

    await expect(graphLookupFailure.sync.getSyncStatus('hero')).resolves.toMatchObject({
      entityId: 'hero',
      status: 'pending',
    });
  });
});
