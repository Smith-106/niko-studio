import { afterEach, describe, expect, it, vi } from 'vitest';

const workflowEventRelayCtor = vi.hoisted(() => vi.fn());
const workflowEventRelayMethods = vi.hoisted(() => ({
  broadcast: vi.fn(),
}));

const distillationBridgeCtor = vi.hoisted(() => vi.fn());
const distillationBridgeMethods = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  persistDistillation: vi.fn().mockResolvedValue('distilled-memory'),
  getDistilledMemoryIds: vi.fn().mockReturnValue([]),
}));

const conflictBridgeCtor = vi.hoisted(() => vi.fn());
const conflictBridgeMethods = vi.hoisted(() => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  detectReverseConflicts: vi.fn().mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]),
}));

const fileSyncServiceCtor = vi.hoisted(() => vi.fn());
const fileSyncServiceMethods = vi.hoisted(() => ({
  syncDirectory: vi.fn().mockResolvedValue([]),
  getSyncHistory: vi.fn().mockReturnValue([]),
  getIndexedFiles: vi.fn().mockReturnValue({}),
}));

const syncEngineCtor = vi.hoisted(() => vi.fn());
const syncEngineMethods = vi.hoisted(() => ({
  syncFull: vi.fn().mockResolvedValue({ pushed: 1, pulled: 2, conflicts: 3 }),
  push: vi.fn().mockResolvedValue({ pushed: 4, pulled: 0, conflicts: 1 }),
  pull: vi.fn().mockResolvedValue({ pushed: 0, pulled: 5, conflicts: 2 }),
}));

vi.mock('../../mcp/gateway-ws', () => ({
  WorkflowEventRelay: vi.fn().mockImplementation(function WorkflowEventRelay(
    this: Record<string, unknown>,
    server: unknown,
  ) {
    workflowEventRelayCtor(server);
    Object.assign(this, workflowEventRelayMethods);
  }),
}));

vi.mock('../../services/distillation-nowledge-bridge', () => ({
  DistillationNowledgeBridge: vi.fn().mockImplementation(function DistillationNowledgeBridge(
    this: Record<string, unknown>,
    service: unknown,
  ) {
    distillationBridgeCtor(service);
    Object.assign(this, distillationBridgeMethods);
  }),
}));

vi.mock('../../services/conflict-nowledge-bridge', () => ({
  ConflictNowledgeBridge: vi.fn().mockImplementation(function ConflictNowledgeBridge(
    this: Record<string, unknown>,
    service: unknown,
  ) {
    conflictBridgeCtor(service);
    Object.assign(this, conflictBridgeMethods);
  }),
}));

vi.mock('../../services/file-sync', () => ({
  FileSyncService: vi.fn().mockImplementation(function FileSyncService(
    this: Record<string, unknown>,
    knowledgeLayer: unknown,
    watchPaths: unknown,
    writingRoot: unknown,
  ) {
    fileSyncServiceCtor(knowledgeLayer, watchPaths, writingRoot);
    Object.assign(this, fileSyncServiceMethods);
  }),
}));

vi.mock('../../sync/sync-engine', () => ({
  SyncEngine: vi.fn().mockImplementation(function SyncEngine(
    this: Record<string, unknown>,
    local: unknown,
    remote: unknown,
  ) {
    syncEngineCtor(local, remote);
    Object.assign(this, syncEngineMethods);
  }),
}));

describe('container/adapters sync and bridge seams', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('covers websocket relay, phase helper mutators, and bridge adapters', async () => {
    const {
      WebSocketRelayServiceAdapter,
      PhaseOrchestratorAdapter,
      DistillationNowledgeBridgeAdapter,
      ConflictNowledgeBridgeAdapter,
    } = await import('../../container/adapters.js');

    const relay = new WebSocketRelayServiceAdapter();
    expect(relay.isConnected()).toBe(false);
    relay.broadcast('delegate:status', { beforeInit: true });
    expect(workflowEventRelayMethods.broadcast).not.toHaveBeenCalled();

    const handler = vi.fn();
    const unsubscribe = relay.subscribe('workflow:step', handler);
    const handlerMap = (relay as unknown as { handlers: Map<string, Set<(payload: unknown) => void>> }).handlers;
    expect(handlerMap.get('workflow:step')?.size).toBe(1);
    unsubscribe();
    expect(handlerMap.has('workflow:step')).toBe(false);

    relay.initialize({ id: 'http-server' } as never);
    expect(relay.isConnected()).toBe(true);
    expect(workflowEventRelayCtor).toHaveBeenCalledWith({ id: 'http-server' });
    relay.broadcast('delegate:status', { afterInit: true });
    expect(workflowEventRelayMethods.broadcast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'delegate:status',
      payload: { afterInit: true },
    }));

    const phase = new PhaseOrchestratorAdapter();
    phase.setScratchDir('/tmp/scratch');
    phase.setArtifacts([{ type: 'plan', path: '/tmp/scratch/plan.json' }]);
    expect(await phase.validatePhase('planning', 'plan')).toBe(true);
    expect(await phase.validatePhase('execution', 'plan')).toBe(false);
    expect(await phase.checkQualityGate('planning', 'plan')).toBe(true);

    const distillation = new DistillationNowledgeBridgeAdapter({ id: 'nowledge' } as never);
    await distillation.initialize();
    await distillation.initialize();
    expect(distillationBridgeMethods.initialize).toHaveBeenCalledTimes(1);

    expect(await distillation.distill('knowledge-1', '/vault/story')).toBe('distilled-memory');
    expect(distillationBridgeMethods.persistDistillation).toHaveBeenCalledWith(expect.objectContaining({
      content: 'knowledge-1',
      metadata: { targetVaultPath: '/vault/story' },
    }));

    distillationBridgeMethods.persistDistillation.mockResolvedValueOnce(null);
    expect(await distillation.distill('knowledge-2')).toBe('');
    distillationBridgeMethods.getDistilledMemoryIds.mockReturnValueOnce([]).mockReturnValueOnce(['mem-1']);
    expect(await distillation.getDistillationStatus('knowledge-2')).toBe('not_found');
    expect(await distillation.getDistillationStatus('knowledge-2')).toBe('completed');

    const conflict = new ConflictNowledgeBridgeAdapter({ id: 'nowledge' } as never);
    await conflict.initialize();
    await conflict.initialize();
    expect(conflictBridgeMethods.initialize).toHaveBeenCalledTimes(1);
    expect(await conflict.detectConflicts('/vault/root', 'notes/ch1.md')).toEqual([
      { localPath: 'notes/ch1.md', knowledgeId: 'mem-1', conflictType: 'reverse-similarity' },
      { localPath: 'notes/ch1.md', knowledgeId: 'mem-2', conflictType: 'reverse-similarity' },
    ]);
    expect(conflictBridgeMethods.detectReverseConflicts).toHaveBeenCalledWith('/vault/root', 'notes/ch1.md');
    expect(await conflict.detectConflicts('/vault/root')).toEqual([
      { localPath: '/vault/root', knowledgeId: 'mem-1', conflictType: 'reverse-similarity' },
      { localPath: '/vault/root', knowledgeId: 'mem-2', conflictType: 'reverse-similarity' },
    ]);
    expect(await conflict.resolveConflict('conflict-1', 'merge')).toBe(true);
  });

  it('covers file-sync adapters, strategy defaults, and direct execute entrypoints', async () => {
    const {
      FileSyncServiceAdapter,
      ObsidianSyncAdapter,
      CloudSyncAdapter,
      KnowledgeSyncAdapter,
      SearchStrategyConfigAdapter,
      SearchRelevanceScorerAdapter,
      QualityGateFeedbackLoopAdapter,
      WaveExecutionEngineAdapter,
    } = await import('../../container/adapters.js');
    const { DEFAULT_STRATEGY_CONFIG } = await import('../../search/strategy-config.js');

    fileSyncServiceMethods.syncDirectory.mockResolvedValueOnce([
      { success: true },
      { success: false },
      { success: true },
    ]);
    fileSyncServiceMethods.getSyncHistory.mockReturnValueOnce([
      { timestamp: 1710000000, action: 'indexed' },
      { timestamp: 1710001000, action: undefined },
    ]);
    fileSyncServiceMethods.getIndexedFiles.mockReturnValueOnce({
      'chapter-1.md': { hash: 'a' },
      'chapter-2.md': { hash: 'b' },
    });

    const fileSync = new FileSyncServiceAdapter({ id: 'knowledge' }, ['notes'], '/workspace/.writing');
    expect(fileSyncServiceCtor).toHaveBeenCalledWith({ id: 'knowledge' }, ['notes'], '/workspace/.writing');
    await expect(fileSync.sync('push', 'notes', 'knowledge')).resolves.toEqual({ synced: 2, conflicts: 1 });
    await expect(fileSync.getSyncHistory('notes')).resolves.toEqual([
      {
        timestamp: new Date(1710000000 * 1000).toISOString(),
        direction: 'indexed',
        filesCount: 1,
      },
      {
        timestamp: new Date(1710001000 * 1000).toISOString(),
        direction: 'unknown',
        filesCount: 1,
      },
    ]);
    await expect(fileSync.getIndexedFiles('notes')).resolves.toEqual(['chapter-1.md', 'chapter-2.md']);

    const obsidianService = {
      sync: vi.fn().mockResolvedValue({ added: 1, modified: 2, deleted: 3 }),
    };
    const obsidian = new ObsidianSyncAdapter(obsidianService as never);
    await expect(obsidian.sync('pull', '/vault', '/target')).resolves.toEqual({ synced: 3, conflicts: 0 });
    await expect(obsidian.sync('push', '/vault', '/target')).resolves.toEqual({ synced: 0, conflicts: 0 });
    await expect(obsidian.getSyncHistory('/vault')).resolves.toEqual([]);
    await expect(obsidian.getIndexedFiles('/vault')).resolves.toEqual([]);

    const local = { id: 'local' };
    const remote = { id: 'remote' };
    const cloud = new CloudSyncAdapter(local as never, remote as never);
    expect(syncEngineCtor).toHaveBeenCalledWith(local, remote);
    await expect(cloud.sync('bidirectional', 'a', 'b')).resolves.toEqual({ synced: 3, conflicts: 3 });
    await expect(cloud.sync('push', 'a', 'b')).resolves.toEqual({ synced: 4, conflicts: 1 });
    await expect(cloud.sync('pull', 'a', 'b')).resolves.toEqual({ synced: 5, conflicts: 2 });
    await expect(cloud.getSyncHistory('a')).resolves.toEqual([]);
    await expect(cloud.getIndexedFiles('a')).resolves.toEqual([]);

    const cloudWithoutEngine = new CloudSyncAdapter();
    await expect(cloudWithoutEngine.sync('push', 'a', 'b')).resolves.toEqual({ synced: 0, conflicts: 0 });

    const knowledgeWithoutLayer = new KnowledgeSyncAdapter();
    await expect(knowledgeWithoutLayer.sync('push', 'a', 'b')).resolves.toEqual({ synced: 0, conflicts: 0 });
    await expect(knowledgeWithoutLayer.getSyncHistory('a')).resolves.toEqual([]);
    await expect(knowledgeWithoutLayer.getIndexedFiles('a')).resolves.toEqual([]);

    fileSyncServiceMethods.syncDirectory.mockResolvedValueOnce([{ success: true }]);
    fileSyncServiceMethods.getSyncHistory.mockReturnValueOnce([{ timestamp: 1710002000, action: 'updated' }]);
    fileSyncServiceMethods.getIndexedFiles.mockReturnValueOnce({ 'outline.md': true });
    const knowledgeWithLayer = new KnowledgeSyncAdapter({ id: 'kl' }, ['docs']);
    await expect(knowledgeWithLayer.sync('pull', 'docs', 'kl')).resolves.toEqual({ synced: 1, conflicts: 0 });
    await expect(knowledgeWithLayer.getSyncHistory('docs')).resolves.toEqual([
      {
        timestamp: new Date(1710002000 * 1000).toISOString(),
        direction: 'updated',
        filesCount: 1,
      },
    ]);
    await expect(knowledgeWithLayer.getIndexedFiles('docs')).resolves.toEqual(['outline.md']);

    const defaultStrategy = new SearchStrategyConfigAdapter();
    expect(defaultStrategy.name).toBe(DEFAULT_STRATEGY_CONFIG.name);
    expect(defaultStrategy.defaultTopK).toBe(DEFAULT_STRATEGY_CONFIG.defaultTopK);
    expect(defaultStrategy.minScore).toBe(DEFAULT_STRATEGY_CONFIG.minScore);
    expect(defaultStrategy.fallbackThreshold).toBe(DEFAULT_STRATEGY_CONFIG.fallbackThreshold);

    const configuredScorer = new SearchRelevanceScorerAdapter({ maxExpansionTerms: 1 });
    const scored = configuredScorer.score([
      {
        id: 'r1',
        content: 'alpha',
        source: 'knowledge',
        baseScore: 0.5,
        relevanceScore: 0.5,
        signals: {},
      },
    ], 'alpha');
    expect(scored).toHaveLength(1);

    const publish = vi.fn();
    const qualityLoop = new QualityGateFeedbackLoopAdapter({ publish } as never);
    await expect(qualityLoop.executeRemediation({
      gapId: 'gap-direct',
      gapTitle: 'direct execution',
      subPlanSpec: {
        parentTaskId: 'gap-direct',
        subTasks: [{ id: 'fix-gap-direct', task: 'fix gap', dependsOn: [] }],
        aggregation: 'sequential',
        maxParallelism: 1,
      },
      retryCount: 0,
      maxRetries: 1,
    })).resolves.toMatchObject({
      gapId: 'gap-direct',
      status: 'fixed',
      attempts: 1,
    });

    const waveEngine = new WaveExecutionEngineAdapter({ publish } as never);
    await expect(waveEngine.executeWave({
      wave: 7,
      tasks: ['task-1'],
      parallel: false,
    }, async () => {})).resolves.toMatchObject({
      waveNumber: 7,
      status: 'completed',
    });
  });
});
