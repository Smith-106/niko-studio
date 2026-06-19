import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DistillationTemplate } from '../../services/distill-service.js';
import {
  DocumentNotFoundError,
  KnowledgeError,
  KnowledgeServiceImpl,
} from '../../services/knowledge-service.js';
import type {
  KnowledgeEntity,
  KnowledgeGraphEngineAdapter,
  KnowledgeMemoryEngineAdapter,
  KnowledgeRelation,
} from '../../protocols/knowledge.js';

class ThrowingEmbeddingService {
  async embed(): Promise<number[]> {
    throw new Error('embedding offline');
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }

  embedWithMetadata(): Promise<unknown> {
    return Promise.resolve({ embedding: [] });
  }

  similarity(): number {
    return 0;
  }

  getDimensions(): number {
    return 0;
  }
}

class MinimalLLMService {
  async generate(): Promise<string> {
    return 'llm';
  }

  async generateWithMetadata(): Promise<{ content: string; metadata: Record<string, unknown> }> {
    return { content: 'llm', metadata: {} };
  }

  async generateJson(): Promise<Record<string, unknown>> {
    return {};
  }

  async *stream(): AsyncIterableIterator<{ content: string; isFinished: boolean; metadata?: Record<string, unknown> }> {
    yield { content: 'llm', isFinished: true, metadata: {} };
  }

  async batchGenerate(prompts: string[]): Promise<string[]> {
    return prompts.map(() => 'llm');
  }
}

function createEntity(overrides: Partial<KnowledgeEntity> = {}): KnowledgeEntity {
  return {
    id: 'entity-1',
    name: 'Atlas',
    type: 'Character',
    ...overrides,
  };
}

function createRelation(overrides: Partial<KnowledgeRelation> = {}): KnowledgeRelation {
  return {
    id: 'relation-1',
    sourceId: 'entity-1',
    targetId: 'entity-2',
    type: 'knows',
    ...overrides,
  };
}

describe('services/knowledge-service additional coverage', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-knowledge-service-additional-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('falls back to summary distillation template when the template is unknown', async () => {
    const service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      llmService: new MinimalLLMService(),
    });
    await service.initialize();

    const distillSpy = vi
      .spyOn((service as never).distillationService as { distill: (...args: unknown[]) => Promise<unknown> }, 'distill')
      .mockResolvedValue({ summary: 'ok' });

    const result = await service.distillKnowledge('chapter text', 'not-a-template', { chapter: 3 });

    expect(result).toEqual({ summary: 'ok' });
    expect(distillSpy).toHaveBeenCalledWith(
      ['chapter text'],
      DistillationTemplate.SUMMARY,
      [],
      { chapter: 3 },
    );
  });

  it('throws a bounded error when distillation is unavailable', async () => {
    const service = new KnowledgeServiceImpl({ dbPath: ':memory:' });
    await service.initialize();

    await expect(service.distillKnowledge('chapter text', DistillationTemplate.SUMMARY)).rejects.toThrow(
      new KnowledgeError('Distillation service not available'),
    );
  });

  it('returns an error result when syncFile reads a directory path', async () => {
    const service = new KnowledgeServiceImpl({ dbPath: ':memory:' });
    await service.initialize();
    const folderPath = join(tempRoot, 'docs');
    mkdirSync(folderPath, { recursive: true });

    const result = await service.syncFile(folderPath);

    expect(result.success).toBe(false);
    expect(result.action).toBe('error');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('returns empty library results when no memory adapter library APIs are available', async () => {
    const service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      memoryEngine: {
        initialize: vi.fn().mockResolvedValue(undefined),
      },
    });
    await service.initialize();

    await expect(service.addToLibrary(['a.md'])).resolves.toEqual([]);
    await expect(service.searchLibrary('atlas', { limit: 2 })).resolves.toEqual([]);
  });

  it('uses memory store fallback when add is unavailable', async () => {
    const store = vi.fn().mockResolvedValue(undefined);
    const service = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'memory-store-fallback', 'knowledge.db'),
      memoryEngine: {
        initialize: vi.fn().mockResolvedValue(undefined),
        store,
      } satisfies KnowledgeMemoryEngineAdapter,
    });
    await service.initialize();

    await service.addDocument('doc-store', 'fallback body', {
      sourceId: 'notes/doc-store.md',
      sourceType: 'document',
    });

    expect(store).toHaveBeenCalledWith(
      'knowledge-document:doc-store',
      expect.objectContaining({
        id: 'doc-store',
        content: 'fallback body',
        sourceType: 'document',
      }),
    );
  });

  it('uses graph node and edge fallbacks when create APIs are unavailable', async () => {
    const addNode = vi.fn().mockResolvedValue(undefined);
    const addEdge = vi.fn().mockResolvedValue(undefined);
    const graphEngine: KnowledgeGraphEngineAdapter = {
      initialize: vi.fn().mockResolvedValue(undefined),
      addNode,
      addEdge,
    };
    const service = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'graph-fallback', 'knowledge.db'),
      graphEngine,
    });
    await service.initialize();

    await service.addEntity(createEntity({ id: 'entity-1', name: 'Atlas', type: 'mystery' }));
    await service.addEntity(createEntity({ id: 'entity-2', name: 'Harbor', type: 'location' }));
    await service.addRelation(createRelation());

    expect(addNode).toHaveBeenNthCalledWith(
      1,
      'entity-1',
      expect.objectContaining({ id: 'entity-1', name: 'Atlas' }),
    );
    expect(addNode).toHaveBeenNthCalledWith(
      2,
      'entity-2',
      expect.objectContaining({ id: 'entity-2', name: 'Harbor' }),
    );
    expect(addEdge).toHaveBeenCalledWith('entity-1', 'entity-2', 'knows');
  });

  it('publishes document and entity lifecycle events when an event bus is present', async () => {
    const eventBus = { publish: vi.fn() };
    const service = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'events', 'knowledge.db'),
      eventBus: eventBus as never,
    });
    await service.initialize();

    await service.addDocument('doc-event', 'memory archive', {
      sourceId: 'archive/memories/entry.md',
      sourceType: 'memory',
    });
    await service.addEntity(createEntity({ id: 'entity-event', name: 'Atlas Harbor', type: 'location' }));
    await service.addEntity(createEntity({ id: 'entity-event', name: 'Atlas Harbor', type: 'location' }));

    expect(eventBus.publish).toHaveBeenCalledWith(
      'knowledge:document-added',
      expect.objectContaining({
        id: 'doc-event',
        sourceId: 'archive/memories/entry.md',
        sourceType: 'memory',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      'knowledge:entity-created',
      expect.objectContaining({
        id: 'entity-event',
        label: 'Atlas Harbor',
        type: 'location',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      'knowledge:entity-updated',
      expect.objectContaining({
        id: 'entity-event',
        label: 'Atlas Harbor',
        type: 'location',
      }),
    );
  });

  it('skips missing candidate entities and tolerates vector search failures', async () => {
    const service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      embeddingService: new ThrowingEmbeddingService(),
    });
    await service.initialize();
    await service.addEntity(createEntity({ id: 'entity-1', name: 'Atlas Harbor' }));
    await service.addEntity(createEntity({ id: 'entity-2', name: 'Atlas Vault' }));
    await service.deleteEntity('entity-2');
    (((service as never).entityFTSIndex as Map<string, Set<string>>).get('atlas') as Set<string>).add('missing-entity');

    const result = await service.search('Atlas', { topK: 3 });

    expect(result.chunks).toEqual([]);
    expect(result.entities).toEqual([
      expect.objectContaining({ id: 'entity-1', name: 'Atlas Harbor' }),
    ]);
  });

  it('matches entities through substring fallback branches during search', async () => {
    const service = new KnowledgeServiceImpl({ dbPath: ':memory:' });
    await service.initialize();
    await service.addEntity(createEntity({ id: 'entity-query-substring', name: 'Atlas' }));
    await service.addEntity(createEntity({ id: 'entity-name-substring', name: 'AtlasHarbor' }));

    ((service as never).entityFTSIndex as Map<string, Set<string>>).set(
      'atlasharbor',
      new Set(['entity-query-substring']),
    );
    ((service as never).entityFTSIndex as Map<string, Set<string>>).set(
      'harbor',
      new Set(['entity-name-substring']),
    );

    const querySubstringResult = await service.search('atlasharbor', { topK: 1 });
    const nameSubstringResult = await service.search('harbor', { topK: 1 });

    expect(querySubstringResult.entities).toEqual([
      expect.objectContaining({ id: 'entity-query-substring', name: 'Atlas' }),
    ]);
    expect(nameSubstringResult.entities).toEqual([
      expect.objectContaining({ id: 'entity-name-substring', name: 'AtlasHarbor' }),
    ]);
  });

  it('returns early when persisting relations without both backing entities', async () => {
    const createRelationSpy = vi.fn().mockResolvedValue(undefined);
    const addEdge = vi.fn().mockResolvedValue(undefined);
    const service = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'persist-relation-missing', 'knowledge.db'),
      graphEngine: {
        initialize: vi.fn().mockResolvedValue(undefined),
        createRelation: createRelationSpy,
        addEdge,
      } satisfies KnowledgeGraphEngineAdapter,
    });
    await service.initialize();
    await service.addEntity(createEntity({ id: 'entity-1', name: 'Atlas' }));

    await ((service as never).persistRelation as (relation: KnowledgeRelation) => Promise<void>)(
      createRelation({ sourceId: 'entity-1', targetId: 'missing-entity' }),
    );

    expect(createRelationSpy).not.toHaveBeenCalled();
    expect(addEdge).not.toHaveBeenCalled();
  });

  it('applies distilled entities and relations into the graph', async () => {
    const service = new KnowledgeServiceImpl({ dbPath: ':memory:' });
    await service.initialize();

    await service.applyDistilledToGraph({
      entities: [
        { id: 'e-a', name: 'Atlas', type: 'character', description: 'Lead navigator' },
        { id: 'e-b', name: 'Harbor', type: 'location' },
      ],
      relations: [
        { source: 'e-a', target: 'e-b', type: 'protects', props: { urgency: 'high' } },
      ],
    });

    expect(service.getEntity('e-a')).toMatchObject({
      name: 'Atlas',
      description: 'Lead navigator',
    });
    expect(service.getEntity('e-b')).toMatchObject({
      name: 'Harbor',
    });
    expect(service.getRelation('e-a-protects-e-b')).toMatchObject({
      sourceId: 'e-a',
      targetId: 'e-b',
      type: 'protects',
      properties: { urgency: 'high' },
    });
  });

  it('deletes related relations and publishes entity deletion events', async () => {
    const eventBus = { publish: vi.fn() };
    const service = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'delete-entity', 'knowledge.db'),
      eventBus: eventBus as never,
    });
    await service.initialize();
    await service.addEntity(createEntity({ id: 'entity-delete-a', name: 'Atlas' }));
    await service.addEntity(createEntity({ id: 'entity-delete-b', name: 'Harbor' }));
    await service.addRelation(
      createRelation({
        id: 'relation-delete',
        sourceId: 'entity-delete-a',
        targetId: 'entity-delete-b',
      }),
    );

    await service.deleteEntity('entity-delete-a');

    expect(service.getEntity('entity-delete-a')).toBeUndefined();
    expect(service.getRelation('relation-delete')).toBeUndefined();
    expect(eventBus.publish).toHaveBeenCalledWith('knowledge:entity-deleted', {
      id: 'entity-delete-a',
    });
  });

  it('loads json snapshot paths directly and filters malformed snapshot entries', async () => {
    const snapshotPath = join(tempRoot, 'knowledge-snapshot.json');
    writeFileSync(
      snapshotPath,
      JSON.stringify({
        documents: [
          { id: 'doc-1', sourceType: 'document', content: 'Kept', createdAt: 1 },
          null,
          42,
        ],
        entities: [
          { id: 'entity-1', name: 'Atlas', type: 'Character' },
          'ignored',
        ],
        relations: [
          { id: 'relation-1', sourceId: 'entity-1', targetId: 'entity-1', type: 'reflects' },
          false,
        ],
        sourceIndex: [
          ['doc-1', '/vault/doc-1.md'],
          ['bad'],
          9,
        ],
      }),
      'utf-8',
    );

    const service = new KnowledgeServiceImpl({ dbPath: snapshotPath });
    await service.initialize();

    expect(service.getDocument('doc-1')).toMatchObject({ content: 'Kept' });
    expect(service.getEntity('entity-1')).toMatchObject({ name: 'Atlas' });
    expect(service.getRelation('relation-1')).toMatchObject({ type: 'reflects' });
    expect((service as never).snapshotPath).toBe(snapshotPath);
    expect((service as never).sourceIndex.get('doc-1')).toBe('/vault/doc-1.md');
  });

  it('defaults invalid snapshot arrays and entity type normalization branches safely', async () => {
    const snapshotPath = join(tempRoot, 'knowledge-invalid-arrays.json');
    writeFileSync(
      snapshotPath,
      JSON.stringify({
        documents: 'bad-documents',
        entities: 'bad-entities',
        relations: 'bad-relations',
        sourceIndex: 'bad-source-index',
      }),
      'utf-8',
    );

    const emptyTypeService = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'empty-type', 'knowledge.db'),
      graphEngine: {
        initialize: vi.fn().mockResolvedValue(undefined),
        createEntity: vi.fn().mockResolvedValue({}),
      },
    });
    await emptyTypeService.initialize();
    await emptyTypeService.addEntity(createEntity({ id: 'blank-type', type: '   ' }));

    const invalidTypeService = new KnowledgeServiceImpl({
      dbPath: snapshotPath,
      graphEngine: {
        initialize: vi.fn().mockResolvedValue(undefined),
        createEntity: vi.fn().mockResolvedValue({}),
      },
    });
    await invalidTypeService.initialize();
    await invalidTypeService.addEntity(createEntity({ id: 'invalid-type', type: 'mystery' }));

    expect(invalidTypeService.getStats()).toEqual({
      documentCount: 0,
      entityCount: 1,
      relationCount: 0,
    });
    expect(
      ((emptyTypeService as never).graphEngine.createEntity as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe('Item');
    expect(
      ((invalidTypeService as never).graphEngine.createEntity as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe('Item');
  });

  it('falls back to an empty snapshot when persisted snapshot content is invalid', async () => {
    const durablePath = join(tempRoot, 'broken', 'knowledge.db');
    mkdirSync(join(tempRoot, 'broken'), { recursive: true });
    writeFileSync(`${durablePath}.json`, '{"documents":[', 'utf-8');

    const service = new KnowledgeServiceImpl({ dbPath: durablePath });
    await service.initialize();

    expect(service.getStats()).toEqual({
      documentCount: 0,
      entityCount: 0,
      relationCount: 0,
    });
  });

  it('constructs DocumentNotFoundError with the expected message', () => {
    const error = new DocumentNotFoundError('missing-doc');
    expect(error.name).toBe('DocumentNotFoundError');
    expect(error.message).toBe('Document not found: missing-doc');
  });
});
