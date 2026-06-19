import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ProviderType } from '../../services/llm-service';
import { AggregationStrategy } from '../../workflow/delegate/result-aggregator';
import { TeamPhase } from '../../workflow/team/phase-gate-evaluator';

const nowledgeMemCtor = vi.hoisted(() => vi.fn());
const unifiedSearchPipelineCtor = vi.hoisted(() => vi.fn());
const mcpRouterCtor = vi.hoisted(() => vi.fn());
const nowledgeGraphSyncCtor = vi.hoisted(() => vi.fn());
const obsidianKnowledgeSyncCtor = vi.hoisted(() => vi.fn());
const llmFallbackChainCtor = vi.hoisted(() => vi.fn());
const mcpServiceDiscoveryCtor = vi.hoisted(() => vi.fn());
const mcpHealthMonitorCtor = vi.hoisted(() => vi.fn());
const graphWikiLinkBridgeCtor = vi.hoisted(() => vi.fn());

const nowledgeMemMethods = vi.hoisted(() => ({
  status: vi.fn().mockResolvedValue(undefined),
  addMemory: vi.fn().mockResolvedValue(undefined),
  searchMemories: vi.fn().mockResolvedValue(undefined),
  searchByTimeRange: vi.fn().mockResolvedValue(undefined),
  getMemory: vi.fn().mockResolvedValue(undefined),
  listMemories: vi.fn().mockResolvedValue(undefined),
  updateMemory: vi.fn().mockResolvedValue(undefined),
  deleteMemory: vi.fn().mockResolvedValue(undefined),
  moveMemory: vi.fn().mockResolvedValue(undefined),
  expandGraph: vi.fn().mockResolvedValue(undefined),
  createRelation: vi.fn().mockResolvedValue(undefined),
  getRelatedMemories: vi.fn().mockResolvedValue(undefined),
  searchRelations: vi.fn().mockResolvedValue(undefined),
  getEvolvesChain: vi.fn().mockResolvedValue(undefined),
  addSource: vi.fn().mockResolvedValue(undefined),
  listSources: vi.fn().mockResolvedValue(undefined),
  getSource: vi.fn().mockResolvedValue(undefined),
  deleteSource: vi.fn().mockResolvedValue(undefined),
  ingestSource: vi.fn().mockResolvedValue(undefined),
  searchSourceChunks: vi.fn().mockResolvedValue(undefined),
  createSpace: vi.fn().mockResolvedValue(undefined),
  listSpaces: vi.fn().mockResolvedValue(undefined),
  getSpace: vi.fn().mockResolvedValue(undefined),
  switchSpace: vi.fn().mockResolvedValue(undefined),
  addSpaceMember: vi.fn().mockResolvedValue(undefined),
  removeSpaceMember: vi.fn().mockResolvedValue(undefined),
  addToLibrary: vi.fn().mockResolvedValue(undefined),
  searchLibrary: vi.fn().mockResolvedValue(undefined),
  readArtifact: vi.fn().mockResolvedValue(undefined),
  getWorkingMemory: vi.fn().mockResolvedValue(undefined),
  setWorkingMemory: vi.fn().mockResolvedValue(undefined),
  listCommunities: vi.fn().mockResolvedValue(undefined),
  getFeed: vi.fn().mockResolvedValue(undefined),
  summarizeMemories: vi.fn().mockResolvedValue(undefined),
  addThread: vi.fn().mockResolvedValue(undefined),
  searchThreads: vi.fn().mockResolvedValue(undefined),
  getThread: vi.fn().mockResolvedValue(undefined),
  appendThread: vi.fn().mockResolvedValue(undefined),
  importThread: vi.fn().mockResolvedValue(undefined),
  saveThread: vi.fn().mockResolvedValue(undefined),
  reconcileTail: vi.fn().mockResolvedValue(undefined),
  importFromLibrary: vi.fn().mockResolvedValue(undefined),
  initialize: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
}));

const unifiedSearchPipelineMethods = vi.hoisted(() => ({
  search: vi.fn().mockResolvedValue({ items: ['search'] }),
  searchByPhase: vi.fn().mockResolvedValue({ items: ['phase'] }),
}));

const mcpRouterMethods = vi.hoisted(() => ({
  route: vi.fn().mockResolvedValue({ provider: 'router-a', result: { ok: true } }),
  registerProvider: vi.fn(),
  getProviders: vi.fn().mockReturnValue([{ name: 'router-a' }]),
}));

const nowledgeGraphSyncMethods = vi.hoisted(() => ({
  syncEntityToGraph: vi.fn().mockResolvedValue({ ok: 'entity' }),
  syncRelationToGraph: vi.fn().mockResolvedValue({ ok: 'relation' }),
  syncGraphToKnowledge: vi.fn().mockResolvedValue({ ok: 'graph' }),
  syncAll: vi.fn().mockResolvedValue({ synced: 3 }),
  getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle' }),
}));

const obsidianKnowledgeSyncMethods = vi.hoisted(() => ({
  startSync: vi.fn().mockResolvedValue(undefined),
  stopSync: vi.fn(),
  syncVaultToKnowledge: vi.fn().mockResolvedValue({ added: 2, modified: 1, deleted: 0 }),
  syncKnowledgeToVault: vi.fn().mockResolvedValue({ added: 1, modified: 0, deleted: 0 }),
  getSyncStatus: vi.fn().mockReturnValue({
    running: true,
    lastVaultSync: 1,
    lastKnowledgeSync: 2,
    pendingConflicts: 0,
  }),
  resolveConflict: vi.fn().mockResolvedValue(undefined),
}));

const llmFallbackChainMethods = vi.hoisted(() => ({
  executeWithFallback: vi.fn().mockResolvedValue('fallback-result'),
  getLatencyStats: vi.fn().mockReturnValue({ openai: { avgMs: 10, p95Ms: 20, callCount: 2 } }),
  getChainConfig: vi.fn().mockReturnValue({ timeoutMs: 1000 }),
}));

const mcpServiceDiscoveryMethods = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  discoverProviders: vi.fn().mockResolvedValue([{ name: 'remote-a' }]),
  getDiscoveredProviders: vi.fn().mockReturnValue([{ name: 'remote-a' }]),
}));

const mcpHealthMonitorMethods = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
  probeProvider: vi.fn().mockResolvedValue({ healthy: true }),
  probeAllProviders: vi.fn().mockResolvedValue({ remote: { healthy: true } }),
  getHealthStatus: vi.fn().mockReturnValue({ remote: { healthy: true } }),
}));

const graphWikiLinkBridgeMethods = vi.hoisted(() => ({
  resolveGraphToWiki: vi.fn().mockResolvedValue('/vault/hero.md'),
  resolveWikiToGraph: vi.fn().mockResolvedValue('entity-1'),
  resolveWikiLinks: vi.fn().mockResolvedValue([{ linkText: 'Hero', entityId: 'entity-1' }]),
  rebuildIndex: vi.fn().mockResolvedValue(5),
  detectOrphanedLinks: vi.fn().mockResolvedValue([{ wikiPath: '/vault/orphan.md', orphanType: 'missing-entity' }]),
  getLinkIndex: vi.fn().mockReturnValue([{ entityId: 'entity-1', wikiPath: '/vault/hero.md' }]),
  checkIntegrity: vi.fn().mockResolvedValue({ ok: true, missingEntities: [], danglingLinks: [] }),
}));

vi.mock('../../services/nowledge-mem-adapter', () => ({
  NowledgeMemAdapter: vi.fn().mockImplementation(function NowledgeMemAdapter(
    this: Record<string, unknown>,
    config?: unknown,
  ) {
    nowledgeMemCtor(config);
    Object.assign(this, nowledgeMemMethods);
  }),
}));

vi.mock('../../search/unified-pipeline', () => ({
  UnifiedSearchPipeline: vi.fn().mockImplementation(function UnifiedSearchPipeline(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    unifiedSearchPipelineCtor(deps);
    Object.assign(this, unifiedSearchPipelineMethods);
  }),
}));

vi.mock('../../gateway/mcp-router', () => ({
  MCPRequestRouter: vi.fn().mockImplementation(function MCPRequestRouter(
    this: Record<string, unknown>,
    registry?: unknown,
  ) {
    mcpRouterCtor(registry);
    Object.assign(this, mcpRouterMethods);
  }),
}));

vi.mock('../../services/nowledge-graph-sync', () => ({
  NowledgeGraphSync: vi.fn().mockImplementation(function NowledgeGraphSync(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    nowledgeGraphSyncCtor(deps);
    Object.assign(this, nowledgeGraphSyncMethods);
  }),
}));

vi.mock('../../services/obsidian-knowledge-sync', () => ({
  ObsidianKnowledgeSyncImpl: vi.fn().mockImplementation(function ObsidianKnowledgeSyncImpl(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    obsidianKnowledgeSyncCtor(deps);
    Object.assign(this, obsidianKnowledgeSyncMethods);
  }),
}));

vi.mock('../../services/llm-fallback-chain', () => ({
  LLMFallbackChainImpl: vi.fn().mockImplementation(function LLMFallbackChainImpl(
    this: Record<string, unknown>,
    registry: unknown,
    providers: unknown,
    config: unknown,
    eventBus: unknown,
  ) {
    llmFallbackChainCtor(registry, providers, config, eventBus);
    Object.assign(this, llmFallbackChainMethods);
  }),
}));

vi.mock('../../gateway/service-discovery', () => ({
  MCPServiceDiscoveryImpl: vi.fn().mockImplementation(function MCPServiceDiscoveryImpl(
    this: Record<string, unknown>,
    router: unknown,
    eventBus: unknown,
    config: unknown,
  ) {
    mcpServiceDiscoveryCtor(router, eventBus, config);
    Object.assign(this, mcpServiceDiscoveryMethods);
  }),
}));

vi.mock('../../gateway/health-monitor', () => ({
  MCPHealthMonitorImpl: vi.fn().mockImplementation(function MCPHealthMonitorImpl(
    this: Record<string, unknown>,
    router: unknown,
    registry: unknown,
    eventBus: unknown,
    config: unknown,
  ) {
    mcpHealthMonitorCtor(router, registry, eventBus, config);
    Object.assign(this, mcpHealthMonitorMethods);
  }),
}));

vi.mock('../../services/graph-wiki-bridge.js', () => ({
  GraphWikiLinkBridgeImpl: vi.fn().mockImplementation(function GraphWikiLinkBridgeImpl(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    graphWikiLinkBridgeCtor(deps);
    Object.assign(this, graphWikiLinkBridgeMethods);
  }),
}));

describe('container/adapters forwarders', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('forwards the full NowledgeMem surface to the underlying adapter', async () => {
    nowledgeMemMethods.status.mockResolvedValueOnce({ healthy: true });
    nowledgeMemMethods.searchMemories.mockResolvedValueOnce([{ id: 'm-1' }]);

    const { NowledgeMemServiceAdapter } = await import('../../container/adapters.js');
    const adapter = new NowledgeMemServiceAdapter({
      cliPath: '/tools/nowledge',
      apiUrl: 'http://127.0.0.1:3000',
    });

    expect(nowledgeMemCtor).toHaveBeenCalledWith({
      cliPath: '/tools/nowledge',
      apiUrl: 'http://127.0.0.1:3000',
    });

    expect(await adapter.status()).toEqual({ healthy: true });
    expect(await adapter.searchMemories('hero', { limit: 3 })).toEqual([{ id: 'm-1' }]);

    const calls: Array<[keyof typeof nowledgeMemMethods, unknown[]]> = [
      ['addMemory', ['scene note', { tags: ['draft'] }]],
      ['searchByTimeRange', [{ from: '2026-01-01', to: '2026-01-31' }]],
      ['getMemory', ['mem-1']],
      ['listMemories', [{ limit: 10 }]],
      ['updateMemory', ['mem-1', { title: 'updated' }]],
      ['deleteMemory', ['mem-1']],
      ['moveMemory', ['mem-1', 'space-2']],
      ['expandGraph', ['mem-1']],
      ['createRelation', ['mem-1', 'mem-2', { type: 'related' }]],
      ['getRelatedMemories', ['mem-1', 2]],
      ['searchRelations', [{ type: 'related' }]],
      ['getEvolvesChain', ['mem-1', { limit: 5 }]],
      ['addSource', ['book.md', { kind: 'vault' }]],
      ['listSources', [{ limit: 10 }]],
      ['getSource', ['src-1']],
      ['deleteSource', ['src-1']],
      ['ingestSource', ['src-1', { chunkSize: 200 }]],
      ['searchSourceChunks', ['src-1', 'query', { limit: 2 }]],
      ['createSpace', ['Writing', { color: 'blue' }]],
      ['listSpaces', []],
      ['getSpace', ['space-1']],
      ['switchSpace', ['space-1']],
      ['addSpaceMember', ['space-1', 'entity-1']],
      ['removeSpaceMember', ['space-1', 'entity-1']],
      ['addToLibrary', [['a.md', 'b.md']]],
      ['searchLibrary', ['outline', { limit: 4 }]],
      ['readArtifact', ['artifact-1']],
      ['getWorkingMemory', ['2026-06-04']],
      ['setWorkingMemory', ['working memory body']],
      ['listCommunities', [5]],
      ['getFeed', [7]],
      ['summarizeMemories', [['m-1', 'm-2']]],
      ['addThread', [[{ role: 'user', content: 'hello' }], { source: 'chat' }]],
      ['searchThreads', ['hello', { limit: 5 }]],
      ['getThread', ['thread-1']],
      ['appendThread', ['thread-1', [{ role: 'assistant', content: 'hi' }], { merge: true }]],
      ['importThread', [{ path: 'thread.json' }]],
      ['saveThread', [{ format: 'json' }]],
      ['reconcileTail', ['thread-1', { keepLast: 3 }]],
      ['importFromLibrary', ['vault/source', { strategy: 'merge' }]],
      ['initialize', []],
      ['healthCheck', []],
      ['shutdown', []],
    ];

    const instance = adapter as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    for (const [method, args] of calls) {
      await instance[method](...args);
      expect(nowledgeMemMethods[method]).toHaveBeenCalledWith(...args);
    }
  });

  it('routes file sync operations to the correct backend adapter and emits completion events', async () => {
    const { FileSyncAdapterChain } = await import('../../container/adapters.js');

    const obsidian = {
      sync: vi.fn().mockResolvedValue({ synced: 2, conflicts: 0 }),
      getSyncHistory: vi.fn().mockResolvedValue([{ timestamp: 't1', direction: 'pull', filesCount: 2 }]),
      getIndexedFiles: vi.fn().mockResolvedValue(['chapter-1.md']),
    };
    const cloud = {
      sync: vi.fn().mockResolvedValue({ synced: 3, conflicts: 1 }),
      getSyncHistory: vi.fn().mockResolvedValue([{ timestamp: 't2', direction: 'push', filesCount: 3 }]),
      getIndexedFiles: vi.fn().mockResolvedValue(['remote://draft']),
    };
    const knowledge = {
      sync: vi.fn().mockResolvedValue({ synced: 4, conflicts: 0 }),
      getSyncHistory: vi.fn().mockResolvedValue([{ timestamp: 't3', direction: 'pull', filesCount: 4 }]),
      getIndexedFiles: vi.fn().mockResolvedValue(['entity-1']),
    };
    const eventBus = { publish: vi.fn() };

    const adapter = new FileSyncAdapterChain({ obsidian, cloud, knowledge }, eventBus as never);

    await expect(adapter.sync('push', 'scene.md', 'vault')).resolves.toEqual({ synced: 2, conflicts: 0 });
    await expect(adapter.sync('pull', 'cloud:bucket', 'https://remote')).resolves.toEqual({ synced: 3, conflicts: 1 });
    await expect(adapter.sync('bidirectional', 'knowledge:entity', 'vault')).resolves.toEqual({ synced: 4, conflicts: 0 });
    await expect(adapter.sync('push', 'untyped-source', 'untyped-target')).resolves.toEqual({ synced: 2, conflicts: 0 });

    expect(obsidian.sync).toHaveBeenCalledWith('push', 'scene.md', 'vault');
    expect(cloud.sync).toHaveBeenCalledWith('pull', 'cloud:bucket', 'https://remote');
    expect(knowledge.sync).toHaveBeenCalledWith('bidirectional', 'knowledge:entity', 'vault');
    expect(eventBus.publish).toHaveBeenCalledTimes(4);

    await expect(adapter.getSyncHistory('cloud:bucket')).resolves.toEqual([
      { timestamp: 't2', direction: 'push', filesCount: 3 },
    ]);
    await expect(adapter.getIndexedFiles('knowledge:entity')).resolves.toEqual(['entity-1']);
  });

  it('exposes event bus, strategy config, event log, dead-letter queue, cache, scoring, aggregation, quality loop, wave execution, and phase routing behaviors', async () => {
    const {
      EventBusAdapter,
      SearchStrategyConfigAdapter,
      EventLogAdapter,
      DeadLetterQueueAdapter,
      SearchCacheManagerAdapter,
      SearchRelevanceScorerAdapter,
      ResultAggregatorAdapter,
      QualityGateFeedbackLoopAdapter,
      WaveExecutionEngineAdapter,
      PhaseOrchestratorAdapter,
    } = await import('../../container/adapters.js');

    const bus = new EventBusAdapter();
    const received: unknown[] = [];
    const handler = (payload: unknown) => received.push(payload);
    const unsubscribe = bus.subscribe('writing:done', handler);
    bus.publish('writing:done', { id: 1 });
    expect(received).toEqual([{ id: 1 }]);
    bus.unsubscribe('writing:done', handler);
    unsubscribe();
    bus.publish('writing:done', { id: 2 });
    expect(received).toEqual([{ id: 1 }]);

    const strategy = new SearchStrategyConfigAdapter({
      name: 'custom',
      defaultTopK: 12,
      fallbackThreshold: 0.42,
    });
    expect(strategy.name).toBe('custom');
    expect(strategy.defaultTopK).toBe(12);
    expect(strategy.fallbackThreshold).toBe(0.42);
    expect(strategy.minScore).toBeTypeOf('number');

    const eventLog = new EventLogAdapter({ maxRetention: 2 });
    const firstSeq = eventLog.append('alpha', { ok: 1 });
    const secondSeq = eventLog.append('beta', { ok: 2 });
    const thirdSeq = eventLog.append('alpha', { ok: 3 });
    expect(firstSeq).toBe(1);
    expect(eventLog.getLatestSeq()).toBe(3);
    expect(eventLog.getEvents({ channel: 'alpha' })).toHaveLength(1);
    expect(eventLog.replayFrom({ fromSeq: secondSeq })).toHaveLength(2);
    expect(thirdSeq).toBe(3);
    eventLog.clear();
    expect(eventLog.getLatestSeq()).toBe(0);

    const retryBus = { publish: vi.fn() };
    const dlq = new DeadLetterQueueAdapter({ maxEntries: 2, eventBus: retryBus as never });
    dlq.record({
      id: 'dlq-1',
      channel: 'writing:error',
      payload: { id: 1 },
      error: { message: 'boom', name: 'Error' },
      handlerIndex: 0,
      timestamp: Date.now(),
      retryCount: 0,
      lastRetryAt: null,
    });
    dlq.record({
      id: 'dlq-2',
      channel: 'writing:error',
      payload: { id: 2 },
      error: { message: 'boom-2', name: 'Error' },
      handlerIndex: 1,
      timestamp: Date.now(),
      retryCount: 0,
      lastRetryAt: null,
    });
    expect(dlq.getSize()).toBe(2);
    expect(dlq.getEntries({ channel: 'writing:error', limit: 1 })).toHaveLength(1);
    await dlq.retry('dlq-1');
    expect(retryBus.publish).toHaveBeenCalledWith('writing:error', { id: 1 });
    expect(dlq.getSize()).toBe(1);
    await dlq.retryAll('writing:error');
    dlq.purge();
    expect(dlq.getSize()).toBe(0);

    const warmupFn = vi.fn().mockImplementation(async (query: string) => ({
      query,
      results: [
        {
          id: `${query}-1`,
          content: `result:${query}`,
          source: 'knowledge',
          baseScore: 0.8,
          relevanceScore: 0.8,
          signals: {},
        },
      ],
      sources: ['knowledge'],
      cachedAt: 1,
      expiresAt: Date.now() + 1000,
    }));
    const cache = new SearchCacheManagerAdapter({
      maxSize: 2,
      ttlMs: 5_000,
      warmupQueries: ['hero'],
    }, undefined, warmupFn);
    await cache.warmup();
    expect(warmupFn).toHaveBeenCalledWith('hero');
    expect(cache.get('hero')?.query).toBe('hero');
    cache.set('villain', {
      query: 'villain',
      results: [],
      sources: ['obsidian'],
      cachedAt: Date.now(),
      expiresAt: Date.now() + 1000,
    });
    expect(cache.invalidateBySource('obsidian')).toBe(1);
    expect(cache.invalidate('missing')).toBe(false);
    expect(cache.getStats().maxSize).toBe(2);
    cache.invalidateAll();
    cache.dispose();

    const scorer = new SearchRelevanceScorerAdapter();
    const scored = scorer.score([
      {
        id: 'r1',
        content: 'alpha',
        source: 'knowledge',
        baseScore: 0.6,
        relevanceScore: 0.6,
        signals: {},
        timestamp: Date.now(),
      },
      {
        id: 'r2',
        content: 'beta',
        source: 'obsidian',
        baseScore: 0.4,
        relevanceScore: 0.4,
        signals: {},
        timestamp: Date.now() - 1000,
      },
    ], 'alpha');
    expect(scored).toHaveLength(2);
    scorer.recordSelection('r1', 'alpha');
    expect(scorer.getSelectionStats()['r1']).toMatchObject({
      query: 'alpha',
      selectedCount: 1,
    });

    const aggregator = new ResultAggregatorAdapter();
    const aggregate = aggregator.aggregate([
      {
        id: 'task-1',
        status: 'completed',
        result: { ok: 1 },
        error: null,
        completedAt: new Date().toISOString(),
      },
      {
        id: 'task-2',
        status: 'failed',
        result: null,
        error: 'boom',
        completedAt: null,
      },
    ], {
      strategy: AggregationStrategy.FIRST_N,
      firstNCount: 1,
    });
    expect(aggregate.status).toBe('partial');
    expect(aggregate.data).toEqual({ ok: 1 });
    aggregator.setBroker({} as never);
    await expect(aggregator.aggregateWithTimeout({
      parentTaskId: 'parent-1',
      subTasks: [{ id: 's1', task: 'do work' }],
      aggregation: 'parallel',
    }, {
      strategy: AggregationStrategy.MERGE_ALL,
      timeoutMs: 5,
    })).resolves.toMatchObject({
      status: 'failed',
      metadata: { totalCount: 1 },
    });

    const publish = vi.fn();
    const qualityLoop = new QualityGateFeedbackLoopAdapter({ publish } as never, undefined, undefined, {
      autoExecute: false,
      maxRetries: 1,
      escalationChannel: 'quality:manual',
    });
    const gap = {
      id: 'gap-1',
      title: 'missing assertion',
      status: 'FAILED' as const,
      evidence: 'reader-endpoints',
    };
    expect(qualityLoop.detectGaps({
      gaps: [gap, { ...gap, id: 'gap-2', status: 'PASSED' as never }],
    })).toEqual([gap]);
    expect(qualityLoop.generateRemediation([gap])).toHaveLength(1);
    expect(qualityLoop.getActiveRemediations()).toHaveLength(1);
    await expect(qualityLoop.runFeedbackLoop({ gaps: [gap] })).resolves.toMatchObject({
      totalGaps: 1,
      fixedGaps: 0,
      unfixedGaps: 1,
      iterations: 1,
    });
    qualityLoop.escalate(gap, 'manual review');
    expect(publish).toHaveBeenCalledWith('quality:manual', expect.objectContaining({
      gapId: 'gap-1',
      requiresHumanReview: true,
      reason: 'manual review',
    }));

    const waveEngine = new WaveExecutionEngineAdapter({ publish } as never, undefined, {
      failureStrategy: 'retry-failed',
      maxRetriesPerWave: 1,
      taskTimeoutMs: 200,
      waveTimeoutMs: 1000,
    });
    const attempts = new Map<string, number>();
    waveEngine.cancelWave(2);
    const waveResults = await waveEngine.executeWaves([
      { wave: 1, tasks: ['task-a', 'task-b'], parallel: true },
      { wave: 2, tasks: ['task-c'], parallel: false },
    ], async (taskId: string) => {
      const count = (attempts.get(taskId) ?? 0) + 1;
      attempts.set(taskId, count);
      if (taskId === 'task-b' && count === 1) {
        throw new Error('retry once');
      }
    });
    expect(waveResults[0]?.status).toBe('completed');
    expect(waveResults[1]?.status).toBe('completed');
    expect(waveEngine.getWaveStatus()).toHaveLength(2);

    const planningScratch = await mkdtemp(join(tmpdir(), 'phase-route-'));
    try {
      const phase = new PhaseOrchestratorAdapter(undefined, undefined, planningScratch, []);
      expect(phase.routeThroughOrchestrator('list', 'GET', '/chapters')).toMatchObject({
        allowed: true,
        currentPhase: TeamPhase.planning,
      });
      expect(phase.routeThroughOrchestrator('mutate', 'POST', '/story')).toMatchObject({
        allowed: false,
        statusCode: 503,
      });
      expect(phase.routeThroughOrchestrator('helper', 'POST', '/writing-helper/process')).toMatchObject({
        allowed: true,
      });
      expect(phase.getQualityGates('planning')[0]).toContain('execution');
      expect(await phase.advancePhase('planning', 'execute')).toBe(false);
      await writeFile(join(planningScratch, 'plan.json'), '{}', 'utf8');
      expect(await phase.advancePhase('planning', 'execute')).toBe(true);
      phase.orchestrator.reset(TeamPhase.fix);
      expect(phase.routeThroughOrchestrator('anything', 'GET', '/story')).toMatchObject({
        allowed: false,
        currentPhase: TeamPhase.fix,
      });
      phase.orchestrator.reset(TeamPhase.complete);
      expect(phase.routeThroughOrchestrator('anything', 'POST', '/story')).toMatchObject({
        allowed: true,
        currentPhase: TeamPhase.complete,
      });
    } finally {
      await rm(planningScratch, { recursive: true, force: true });
    }
  });

  it('forwards search, routing, sync, fallback, discovery, health, and wiki-bridge calls', async () => {
    const {
      UnifiedSearchPipelineAdapter,
      MCPRequestRouterAdapter,
      NowledgeGraphSyncAdapter,
      ObsidianKnowledgeSyncAdapter,
      LLMFallbackChainAdapter,
      MCPServiceDiscoveryAdapter,
      MCPHealthMonitorAdapter,
      GraphWikiLinkBridgeAdapter,
    } = await import('../../container/adapters.js');

    const unified = new UnifiedSearchPipelineAdapter({ knowledgeService: {} } as never);
    await expect(unified.search('hero', { limit: 3 } as never)).resolves.toEqual({ items: ['search'] });
    await expect(unified.searchByPhase('hero', 'draft', { limit: 1 } as never)).resolves.toEqual({ items: ['phase'] });
    expect(unifiedSearchPipelineCtor).toHaveBeenCalledWith({ knowledgeService: {} });

    const registry = { id: 'registry' };
    const router = new MCPRequestRouterAdapter(registry as never);
    expect(await router.route({ method: 'memory.search', params: { query: 'hero' } } as never)).toEqual({
      provider: 'router-a',
      result: { ok: true },
    });
    router.registerProvider({ name: 'provider-a' } as never);
    expect(router.getProviders()).toEqual([{ name: 'router-a' }]);
    expect(mcpRouterCtor).toHaveBeenCalledWith(registry);

    const eventBus = { publish: vi.fn() };
    const graphSync = new NowledgeGraphSyncAdapter(
      { id: 'knowledge' } as never,
      { id: 'graph' } as never,
      eventBus as never,
      { id: 'conflict' } as never,
    );
    await expect(graphSync.syncEntityToGraph('entity-1')).resolves.toEqual({ ok: 'entity' });
    await expect(graphSync.syncRelationToGraph('relation-1')).resolves.toEqual({ ok: 'relation' });
    await expect(graphSync.syncGraphToKnowledge('graph-1')).resolves.toEqual({ ok: 'graph' });
    await expect(graphSync.syncAll('bidirectional')).resolves.toEqual({ synced: 3 });
    await expect(graphSync.getSyncStatus('entity-1')).resolves.toEqual({ status: 'idle' });
    expect(nowledgeGraphSyncCtor).toHaveBeenCalledWith({
      knowledgeService: { id: 'knowledge' },
      graphEngine: { id: 'graph' },
      eventBus,
      conflictBridge: { id: 'conflict' },
    });

    const obsidianSync = new ObsidianKnowledgeSyncAdapter(
      { id: 'obsidian' } as never,
      { id: 'knowledge' } as never,
      eventBus as never,
      { id: 'conflict' } as never,
      { vaultRoot: '/vault' },
    );
    await obsidianSync.startSync();
    obsidianSync.stopSync();
    await expect(obsidianSync.syncVaultToKnowledge('/vault')).resolves.toEqual({
      added: 2,
      modified: 1,
      deleted: 0,
    });
    await expect(obsidianSync.syncKnowledgeToVault('entity-1')).resolves.toEqual({
      added: 1,
      modified: 0,
      deleted: 0,
    });
    expect(obsidianSync.getSyncStatus()).toMatchObject({ running: true });
    await obsidianSync.resolveConflict('conflict-1', 'merge');

    const providers = new Map([[ProviderType.OPENAI, { name: 'openai' }]]);
    const llmChain = new LLMFallbackChainAdapter(
      registry as never,
      providers as never,
      { timeoutMs: 1000 } as never,
      eventBus as never,
    );
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(llmChain.executeWithFallback(operation, 'generate', ProviderType.OPENAI)).resolves.toBe('fallback-result');
    expect(llmChain.getLatencyStats()).toMatchObject({
      openai: { avgMs: 10, p95Ms: 20, callCount: 2 },
    });
    expect(llmChain.getChainConfig()).toEqual({ timeoutMs: 1000 });

    const discovery = new MCPServiceDiscoveryAdapter(router as never, eventBus as never, { intervalMs: 1000 } as never);
    await discovery.start();
    discovery.stop();
    await expect(discovery.discoverProviders()).resolves.toEqual([{ name: 'remote-a' }]);
    expect(discovery.getDiscoveredProviders()).toEqual([{ name: 'remote-a' }]);

    const health = new MCPHealthMonitorAdapter(
      router as never,
      registry as never,
      eventBus as never,
      { intervalMs: 1000 } as never,
    );
    await health.start();
    health.stop();
    await expect(health.probeProvider('remote')).resolves.toEqual({ healthy: true });
    await expect(health.probeAllProviders()).resolves.toEqual({ remote: { healthy: true } });
    expect(health.getHealthStatus()).toEqual({ remote: { healthy: true } });

    const bridge = new GraphWikiLinkBridgeAdapter(
      { id: 'graph' } as never,
      { id: 'obsidian' } as never,
      eventBus as never,
      '/vault',
    );
    await expect(bridge.resolveGraphToWiki('entity-1')).resolves.toBe('/vault/hero.md');
    await expect(bridge.resolveWikiToGraph('/vault/hero.md')).resolves.toBe('entity-1');
    await expect(bridge.resolveWikiLinks('/vault/hero.md')).resolves.toEqual([
      { linkText: 'Hero', entityId: 'entity-1' },
    ]);
    await expect(bridge.rebuildIndex()).resolves.toBe(5);
    await expect(bridge.detectOrphanedLinks()).resolves.toEqual([
      { wikiPath: '/vault/orphan.md', orphanType: 'missing-entity' },
    ]);
    expect(bridge.getLinkIndex()).toEqual([{ entityId: 'entity-1', wikiPath: '/vault/hero.md' }]);
    await expect(bridge.checkIntegrity()).resolves.toEqual({
      ok: true,
      missingEntities: [],
      danglingLinks: [],
    });
  });
});
