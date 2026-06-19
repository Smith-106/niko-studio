import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeServiceImpl } from '../../services/knowledge-service.js';
import type {
  KnowledgeEntity,
  KnowledgeGraphEngineAdapter,
  KnowledgeRelation,
} from '../../protocols/knowledge.js';

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

describe('services/knowledge-service branch gaps', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-knowledge-service-branch-gap-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('publishes the default document source type when metadata omits it', async () => {
    const eventBus = { publish: vi.fn() };
    const service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      eventBus: eventBus as never,
    });
    await service.initialize();

    await service.addDocument('doc-default-source-type', 'Atlas archive', {
      sourceId: 'vault/atlas.md',
    });

    expect(eventBus.publish).toHaveBeenCalledWith('knowledge:document-added', {
      id: 'doc-default-source-type',
      sourceId: 'vault/atlas.md',
      sourceType: 'document',
    });
  });

  it('stringifies non-Error syncFile failures and falls back when library adapters are absent', async () => {
    const service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
    });
    await service.initialize();

    const filePath = join(tempRoot, 'sync-file.txt');
    writeFileSync(filePath, 'sync me', 'utf-8');

    vi.spyOn(service, 'addDocument').mockRejectedValueOnce('sync exploded');

    await expect(service.syncFile(filePath)).resolves.toMatchObject({
      success: false,
      action: 'error',
      message: 'sync exploded',
    });
    await expect(service.addToLibrary(['atlas.md'])).resolves.toEqual([]);
    await expect(service.searchLibrary('atlas', { limit: 1 })).resolves.toEqual([]);
  });

  it('uses default topK and delegates library queries when adapter methods exist', async () => {
    const addToLibrary = vi.fn().mockResolvedValue([{ id: 'doc-1', name: 'Atlas', type: 'note' }]);
    const searchLibrary = vi.fn().mockResolvedValue([{ id: 'doc-2', name: 'Harbor', type: 'memory' }]);
    const service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      memoryEngine: {
        initialize: vi.fn().mockResolvedValue(undefined),
        addToLibrary,
        searchLibrary,
      } as never,
    });
    await service.initialize();
    await service.addEntity(createEntity({ id: 'entity-topk', name: 'Atlas Harbor' }));

    const result = await service.search('Atlas');

    expect(result.entities).toEqual([
      expect.objectContaining({ id: 'entity-topk', name: 'Atlas Harbor' }),
    ]);
    await expect(service.addToLibrary(['atlas.md'])).resolves.toEqual([
      { id: 'doc-1', name: 'Atlas', type: 'note' },
    ]);
    await expect(service.searchLibrary('atlas')).resolves.toEqual([
      { id: 'doc-2', name: 'Harbor', type: 'memory' },
    ]);
    expect(addToLibrary).toHaveBeenCalledWith(['atlas.md']);
    expect(searchLibrary).toHaveBeenCalledWith('atlas', undefined);
  });

  it('deletes relations when the removed entity appears on the relation target side', async () => {
    const service = new KnowledgeServiceImpl({ dbPath: ':memory:' });
    await service.initialize();
    await service.addEntity(createEntity({ id: 'entity-1', name: 'Atlas' }));
    await service.addEntity(createEntity({ id: 'entity-2', name: 'Harbor' }));
    await service.addRelation(
      createRelation({
        id: 'relation-target-match',
        sourceId: 'entity-2',
        targetId: 'entity-1',
      }),
    );

    await service.deleteEntity('entity-1');

    expect(service.getRelation('relation-target-match')).toBeUndefined();
  });

  it('coalesces missing createdAt values to null in graph persistence fallbacks', async () => {
    const createEntitySpy = vi.fn().mockResolvedValue(undefined);
    const createRelationSpy = vi.fn().mockResolvedValue(undefined);
    const graphEngine = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createEntity: createEntitySpy,
      createRelation: createRelationSpy,
    } as unknown as KnowledgeGraphEngineAdapter;

    const service = new KnowledgeServiceImpl({
      dbPath: join(tempRoot, 'graph-persistence', 'knowledge.db'),
      graphEngine,
    });
    await service.initialize();

    await (service as never).persistEntity({
      id: 'entity-private',
      name: 'Private Atlas',
      type: 'Character',
    });

    (service as never).entities.set('source', {
      id: 'source',
      name: 'Source Atlas',
      type: 'Character',
    });
    (service as never).entities.set('target', {
      id: 'target',
      name: 'Target Harbor',
      type: 'Location',
    });

    await (service as never).persistRelation({
      id: 'relation-private',
      sourceId: 'source',
      targetId: 'target',
      type: 'knows',
    });

    expect(createEntitySpy).toHaveBeenCalledWith(
      'Character',
      'Private Atlas',
      expect.objectContaining({
        id: 'entity-private',
        createdAt: null,
      }),
    );
    expect(createRelationSpy).toHaveBeenCalledWith(
      'Source Atlas',
      'Target Harbor',
      'knows',
      expect.objectContaining({
        id: 'relation-private',
        createdAt: null,
      }),
    );
  });

  it('handles missing distilled arrays and detects memory paths during sync', async () => {
    const service = new KnowledgeServiceImpl({ dbPath: ':memory:' });
    await service.initialize();

    await expect(service.applyDistilledToGraph({})).resolves.toBeUndefined();

    const memoryDir = join(tempRoot, 'memories');
    const memoryPath = join(memoryDir, 'atlas.md');
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(memoryPath, 'Atlas memory note', 'utf-8');

    await expect(service.syncFile(memoryPath)).resolves.toMatchObject({
      success: true,
      action: 'synced',
      message: 'Synced as memory',
    });
    expect(service.getStats().documentCount).toBe(1);
  });
});
