import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntityType } from '../../graph/graph-manager.js';
import { DimensionType } from '../../memory/six-dimensional-memory.js';

const httpClientConfigSpy = vi.hoisted(() => vi.fn());
const nullApiCtorSpy = vi.hoisted(() => vi.fn());
const syncEngineCtorSpy = vi.hoisted(() => vi.fn());
const entityMapperCtorSpy = vi.hoisted(() => vi.fn());
const memoryMapperCtorSpy = vi.hoisted(() => vi.fn());
const relationMapperCtorSpy = vi.hoisted(() => vi.fn());
const conflictResolverCtorSpy = vi.hoisted(() => vi.fn());

const refs = vi.hoisted(() => ({
  httpClient: {
    isHealthy: true,
    checkHealth: vi.fn(),
    addMemory: vi.fn(),
    getEntities: vi.fn(),
    getContradictions: vi.fn(),
  },
  nullApi: {
    isHealthy: false,
    addMemory: vi.fn(),
    getEntities: vi.fn(),
    getContradictions: vi.fn(),
  },
  entityMapper: {
    toNowledge: vi.fn(),
  },
  memoryMapper: {
    toNowledge: vi.fn(),
  },
  relationMapper: {},
  syncEngine: {
    hasChanged: vi.fn(),
    getRemoteId: vi.fn(),
    recordSync: vi.fn(),
  },
  conflictResolver: {
    resolve: vi.fn(),
    getPendingConflicts: vi.fn(),
    resolveManual: vi.fn(),
  },
}));

vi.mock('../../services/nowledge-mem-http-client', () => ({
  NowledgeMemHTTPClient: vi.fn().mockImplementation(function NowledgeMemHTTPClient(config: unknown) {
    httpClientConfigSpy(config);
    return refs.httpClient;
  }),
}));

vi.mock('../../services/null-nowledge-mem-api', () => ({
  NullNowledgeMemAPI: vi.fn().mockImplementation(function NullNowledgeMemAPI() {
    nullApiCtorSpy();
    return refs.nullApi;
  }),
}));

vi.mock('../../services/mappers/narrative-entity-mapper', () => ({
  NarrativeEntityMapper: vi.fn().mockImplementation(function NarrativeEntityMapper() {
    entityMapperCtorSpy();
    return refs.entityMapper;
  }),
}));

vi.mock('../../services/mappers/dimensional-memory-mapper', () => ({
  DimensionalMemoryMapper: vi.fn().mockImplementation(function DimensionalMemoryMapper() {
    memoryMapperCtorSpy();
    return refs.memoryMapper;
  }),
}));

vi.mock('../../services/mappers/narrative-relation-mapper', () => ({
  NarrativeRelationMapper: vi.fn().mockImplementation(function NarrativeRelationMapper() {
    relationMapperCtorSpy();
    return refs.relationMapper;
  }),
}));

vi.mock('../../services/sync/incremental-sync-engine', () => ({
  IncrementalSyncEngine: vi.fn().mockImplementation(function IncrementalSyncEngine(dbPath: string) {
    syncEngineCtorSpy(dbPath);
    return refs.syncEngine;
  }),
}));

vi.mock('../../services/sync/bridge-conflict-resolver', () => ({
  BridgeConflictResolver: vi.fn().mockImplementation(function BridgeConflictResolver() {
    conflictResolverCtorSpy();
    return refs.conflictResolver;
  }),
}));

import { KnowledgeBridgeV2 } from '../../services/knowledge-bridge-v2.js';

describe('services/knowledge-bridge-v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    refs.httpClient.isHealthy = true;
    refs.httpClient.checkHealth.mockResolvedValue(true);
    refs.httpClient.addMemory.mockResolvedValue({ id: 'remote-1' });
    refs.httpClient.getEntities.mockResolvedValue([]);
    refs.httpClient.getContradictions.mockResolvedValue([]);

    refs.nullApi.isHealthy = false;
    refs.nullApi.addMemory.mockRejectedValue(new Error('offline'));
    refs.nullApi.getEntities.mockResolvedValue([]);
    refs.nullApi.getContradictions.mockResolvedValue([]);

    refs.entityMapper.toNowledge.mockReturnValue({
      entity_type: 'character',
      description: 'Lead hero',
      aliases: ['hero'],
    });
    refs.memoryMapper.toNowledge.mockReturnValue({
      content: 'Memory body',
      labels: ['dimension:context'],
      importance: 0.7,
    });

    refs.syncEngine.hasChanged.mockReturnValue(true);
    refs.syncEngine.getRemoteId.mockReturnValue(null);
    refs.syncEngine.recordSync.mockReturnValue(undefined);

    refs.conflictResolver.resolve.mockReturnValue('remote_wins');
    refs.conflictResolver.getPendingConflicts.mockReturnValue([]);
    refs.conflictResolver.resolveManual.mockReturnValue(undefined);
  });

  it('wires constructor dependencies and falls back to the null API when health checks fail', async () => {
    refs.httpClient.checkHealth.mockResolvedValue(false);

    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });
    await Promise.resolve();
    await Promise.resolve();

    expect(httpClientConfigSpy).toHaveBeenCalledWith({ host: '127.0.0.1', port: 19828 });
    expect(syncEngineCtorSpy).toHaveBeenCalledWith(path.join('C:/tmp/atlas', 'sync-state.db'));
    expect(entityMapperCtorSpy).toHaveBeenCalledTimes(1);
    expect(memoryMapperCtorSpy).toHaveBeenCalledTimes(1);
    expect(relationMapperCtorSpy).toHaveBeenCalledTimes(1);
    expect(conflictResolverCtorSpy).toHaveBeenCalledTimes(1);
    expect(nullApiCtorSpy).toHaveBeenCalledTimes(1);
    expect(bridge.isOnline()).toBe(false);
  });

  it('returns early when offline or when no entity changes are detected', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });

    (bridge as unknown as { api: typeof refs.nullApi }).api = refs.nullApi;
    await expect(
      bridge.pushEntity('local-1', {
        type: EntityType.CHARACTER,
        name: 'Alice',
        description: 'Lead hero',
      }),
    ).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: ['Knowledge layer offline'],
    });

    (bridge as unknown as { api: typeof refs.httpClient }).api = refs.httpClient;
    refs.syncEngine.hasChanged.mockReturnValue(false);

    await expect(
      bridge.pushEntity('local-1', {
        type: EntityType.CHARACTER,
        name: 'Alice',
        description: 'Lead hero',
      }),
    ).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: [],
    });
    expect(refs.httpClient.addMemory).not.toHaveBeenCalled();
  });

  it('pushes new and existing entities, records syncs for new entities, and maps memory pushes', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas', host: '10.0.0.8', port: 22100 });

    await expect(
      bridge.pushEntity('local-1', {
        type: EntityType.CHARACTER,
        name: 'Alice',
        description: 'Lead hero',
      }),
    ).resolves.toEqual({
      pushed: 1,
      pulled: 0,
      conflicts: 0,
      errors: [],
    });
    expect(refs.httpClient.addMemory).toHaveBeenCalledWith('Lead hero', {
      labels: ['character', 'hero'],
    });
    expect(refs.syncEngine.recordSync).toHaveBeenCalledWith(
      'local-1',
      'remote-1',
      JSON.stringify({
        type: EntityType.CHARACTER,
        name: 'Alice',
        description: 'Lead hero',
      }),
      'push',
    );

    refs.syncEngine.getRemoteId.mockReturnValue('remote-existing');
    refs.syncEngine.recordSync.mockClear();

    await bridge.pushEntity('local-2', {
      type: EntityType.CONCEPT,
      name: 'Vault',
      description: 'Old vault',
      aliases: ['archive'],
    });
    expect(refs.syncEngine.recordSync).not.toHaveBeenCalled();

    await expect(
      bridge.pushMemory('memory-1', {
        dimension: DimensionType.CONTEXT,
        content: 'Memory body',
        importance: 0.7,
      }),
    ).resolves.toEqual({
      pushed: 1,
      pulled: 0,
      conflicts: 0,
      errors: [],
    });
    expect(refs.httpClient.addMemory).toHaveBeenLastCalledWith('Memory body', {
      labels: ['dimension:context'],
      importance: 0.7,
    });
    expect(refs.syncEngine.recordSync).toHaveBeenCalledWith(
      'memory-1',
      'remote-1',
      JSON.stringify({
        dimension: DimensionType.CONTEXT,
        content: 'Memory body',
        importance: 0.7,
      }),
      'push',
    );
  });

  it('pulls entities and contradictions, reports manual conflicts during sync, and exposes sync status', async () => {
    refs.httpClient.getEntities.mockResolvedValue([
      { id: 'remote-1', entity_type: 'character', name: 'Alice', description: 'Lead', aliases: [] },
      { id: 'remote-2', entity_type: 'event', name: 'Alarm', description: 'Bridge alarm', aliases: [] },
    ]);
    refs.httpClient.getContradictions.mockResolvedValue([
      { memory_a: 'm1', memory_b: 'm2', description: 'Version drift' },
      { memory_a: 'm3', memory_b: 'm4', description: 'Chapter mismatch' },
    ]);
    refs.conflictResolver.resolve
      .mockReturnValueOnce('manual')
      .mockReturnValueOnce('remote_wins');
    refs.conflictResolver.getPendingConflicts.mockReturnValue([
      { type: 'relation_type', localId: 'a', remoteId: 'b', localValue: null, remoteValue: null, description: 'Pending' },
    ]);

    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });

    await expect(bridge.pullEntities('character')).resolves.toEqual([
      { remoteId: 'remote-1', type: 'character', name: 'Alice', description: 'Lead' },
      { remoteId: 'remote-2', type: 'event', name: 'Alarm', description: 'Bridge alarm' },
    ]);
    await expect(bridge.pullContradictions()).resolves.toEqual([
      {
        type: 'memory_content',
        localId: 'm1',
        remoteId: 'm2',
        localValue: null,
        remoteValue: null,
        description: 'Version drift',
      },
      {
        type: 'memory_content',
        localId: 'm3',
        remoteId: 'm4',
        localValue: null,
        remoteValue: null,
        description: 'Chapter mismatch',
      },
    ]);

    await expect(bridge.syncFromKnowledgeLayer()).resolves.toEqual({
      pushed: 0,
      pulled: 2,
      conflicts: 1,
      errors: [],
    });
    expect(bridge.getSyncStatus()).toEqual({
      knowledgeLayerOnline: true,
      lastSyncAt: null,
      pendingConflicts: 1,
      mappingCount: 0,
    });
    expect(bridge.getPendingConflicts()).toEqual([
      { type: 'relation_type', localId: 'a', remoteId: 'b', localValue: null, remoteValue: null, description: 'Pending' },
    ]);
  });

  it('aggregates sync-to-knowledge results and forwards manual conflict resolutions', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });
    const pushEntitySpy = vi
      .spyOn(bridge, 'pushEntity')
      .mockResolvedValueOnce({ pushed: 1, pulled: 0, conflicts: 0, errors: [] })
      .mockResolvedValueOnce({ pushed: 0, pulled: 0, conflicts: 0, errors: ['failed second'] });

    await expect(
      bridge.syncToKnowledgeLayer([
        { localId: 'a', input: { type: EntityType.CHARACTER, name: 'Alice', description: 'Lead' } },
        { localId: 'b', input: { type: EntityType.EVENT, name: 'Alarm', description: 'Bridge alarm' } },
      ]),
    ).resolves.toEqual({
      pushed: 1,
      pulled: 0,
      conflicts: 0,
      errors: ['failed second'],
    });
    expect(pushEntitySpy).toHaveBeenCalledTimes(2);

    bridge.resolveConflict(0, 'local_wins');
    expect(refs.conflictResolver.resolveManual).toHaveBeenCalledWith(0, 'local_wins');
  });
});
