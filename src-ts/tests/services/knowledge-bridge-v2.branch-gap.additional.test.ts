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

describe('services/knowledge-bridge-v2 branch-gap coverage', () => {
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

  it('returns offline reports for memory pushes and knowledge pulls', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });
    (bridge as unknown as { api: typeof refs.nullApi }).api = refs.nullApi;

    await expect(
      bridge.pushMemory('memory-offline', {
        dimension: DimensionType.CONTEXT,
        content: 'Offline memory',
        importance: 0.4,
      }),
    ).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: ['Knowledge layer offline'],
    });
    await expect(bridge.pullEntities('character')).resolves.toEqual([]);
    await expect(bridge.pullContradictions()).resolves.toEqual([]);
    await expect(bridge.syncFromKnowledgeLayer()).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: ['Knowledge layer offline'],
    });
  });

  it('short-circuits unchanged memory pushes without touching the remote API', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });
    refs.syncEngine.hasChanged.mockReturnValue(false);

    await expect(
      bridge.pushMemory('memory-stable', {
        dimension: DimensionType.CONTEXT,
        content: 'Already synced',
        importance: 0.2,
      }),
    ).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: [],
    });

    expect(refs.memoryMapper.toNowledge).not.toHaveBeenCalled();
    expect(refs.httpClient.addMemory).not.toHaveBeenCalled();
  });

  it('captures entity and memory push failures into the sync report', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas' });
    refs.httpClient.addMemory
      .mockRejectedValueOnce(new Error('entity write failed'))
      .mockRejectedValueOnce(new Error('memory write failed'));

    await expect(
      bridge.pushEntity('entity-1', {
        type: EntityType.CHARACTER,
        name: 'Ava',
        description: 'Lead hero',
      }),
    ).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: ['Error: entity write failed'],
    });

    await expect(
      bridge.pushMemory('memory-1', {
        dimension: DimensionType.CONTEXT,
        content: 'Fragile memory',
        importance: 0.9,
      }),
    ).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: ['Error: memory write failed'],
    });
  });

  it('captures sync-from-knowledge errors after the online precheck passes', async () => {
    const bridge = new KnowledgeBridgeV2({ dataDir: 'C:/tmp/atlas', host: '10.0.0.8', port: 22100 });
    refs.httpClient.getContradictions.mockRejectedValueOnce(new Error('remote contradiction fetch failed'));

    await expect(bridge.syncFromKnowledgeLayer()).resolves.toEqual({
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      errors: ['Error: remote contradiction fetch failed'],
    });

    expect(httpClientConfigSpy).toHaveBeenCalledWith({ host: '10.0.0.8', port: 22100 });
    expect(syncEngineCtorSpy).toHaveBeenCalledWith(path.join('C:/tmp/atlas', 'sync-state.db'));
    expect(nullApiCtorSpy).not.toHaveBeenCalled();
  });
});
