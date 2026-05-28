import type { interfaces } from 'inversify';

import {
  ServiceTypes,
  type IMemoryEngine,
  type IGraphEngine,
  type ISearchEngine,
  type IWorkflowEngine,
  type ICriticEngine,
  type IAgentFactory,
  type IBackupManager,
  type ITokenService,
  type IObsidianService,
  type IMCPGateway,
  type IDistillationService,
  type ILLMService,
  type IEmbeddingService,
  type IKnowledgeService,
  type ISmartSearch,
  type IHybridSearch,
  type IVectorSearch,
  type ILearningOrchestrator,
  type INowledgeMemService,
  type IRevisionService,
  type ISessionIntelligence,
  type IPersonalizationService,
  type IPhaseOrchestrator,
  type IWebSocketRelayService,
  type IDistillationNowledgeBridge,
  type IConflictNowledgeBridge,
  type IFileSyncAdapter,
  type IEventBus,
  type IEventLog,
  type IDeadLetterQueue,
  type ISearchStrategyConfig,
  type IUnifiedSearchPipeline,
  type IMCPRequestRouter,
  type INowledgeGraphSync,
  type IObsidianKnowledgeSync,
  type ILLMFallbackChain,
  type IMCPServiceDiscovery,
  type IMCPHealthMonitor,
  type ISearchRelevanceScorer,
  type ISearchCacheManager,
  type IParallelResultAggregator,
  type IQualityGateFeedbackLoop,
  type IWaveExecutionEngine,
  type IGraphWikiLinkBridge,
} from './types';
import {
  DistillationService,
  EmbeddingServiceImpl,
  LLMServiceImpl,
  KnowledgeServiceImpl,
  RevisionServiceImpl,
  SessionIntelligenceServiceImpl,
  PersonalizationServiceImpl,
} from '../services';
import { ProviderType as EmbeddingProviderType } from '../services/embedding-service';
import {
  SmartSearch,
  HybridSearch,
  VectorSearch,
} from '../search';
import { LocalEmbeddingProvider } from '../knowledge/providers';
import { createIntegrationAdapters, type IntegrationAdapterBundle } from '../integrations';
import {
  MemoryEngineAdapter,
  GraphEngineAdapter,
  SearchEngineAdapter,
  WorkflowEngineAdapter,
  CriticEngineAdapter,
  AgentFactoryAdapter,
  BackupManagerAdapter,
  TokenServiceAdapter,
  ObsidianServiceAdapter,
  MCPGatewayAdapter,
  NowledgeMemServiceAdapter,
} from './adapters';
import {
  PhaseOrchestratorAdapter,
  WebSocketRelayServiceAdapter,
  DistillationNowledgeBridgeAdapter,
  ConflictNowledgeBridgeAdapter,
  ObsidianSyncAdapter,
  CloudSyncAdapter,
  KnowledgeSyncAdapter,
  EventBusAdapter,
  SearchStrategyConfigAdapter,
  UnifiedSearchPipelineAdapter,
  MCPRequestRouterAdapter,
  NowledgeGraphSyncAdapter,
  ObsidianKnowledgeSyncAdapter,
  LLMFallbackChainAdapter,
  EventLogAdapter,
  DeadLetterQueueAdapter,
  MCPServiceDiscoveryAdapter,
  MCPHealthMonitorAdapter,
  SearchRelevanceScorerAdapter,
  SearchCacheManagerAdapter,
  ResultAggregatorAdapter,
  QualityGateFeedbackLoopAdapter,
  WaveExecutionEngineAdapter,
  GraphWikiLinkBridgeAdapter,
} from './adapters';
import { NowledgeMemKnowledgeBridge } from '../services/nowledge-mem-knowledge-bridge';
import { CompositeKnowledgeMemoryBridge } from '../services/composite-knowledge-memory-bridge';
import { CircuitBreakerRegistry } from '../services/circuit-breaker';
import {
  LearningOrchestrator,
  ImportLearningPipeline,
  SelfEvolvingAgent,
  RuleEvolver,
  PreferenceTracker,
  ReadingLearningPipeline,
  type LearningOrchestratorDeps,
} from '../learning';
import {
  LearningCapability,
  type ILearningPipeline,
  type LearningConfig,
} from '../learning/learning-types';
import type {
  BatchEmbeddingResponse,
  EmbeddingProvider as VectorEmbeddingProvider,
  EmbeddingService as VectorEmbeddingService,
} from '../protocols/embedding';

export type CanonicalServiceIdentifier = (typeof ServiceTypes)[keyof typeof ServiceTypes];

export const CANONICAL_SERVICE_IDENTIFIERS = Object.values(ServiceTypes) as CanonicalServiceIdentifier[];

export interface BindingRegistryOptions {
  integrationAdapters?: IntegrationAdapterBundle;
}

const DEFAULT_VECTOR_DIMENSION = 384;
const DEFAULT_VECTOR_MODEL = 'BAAI/bge-small-en-v1.5';

function createProductionEmbeddingService(): IEmbeddingService & VectorEmbeddingService {
  const localProvider = new LocalEmbeddingProvider({
    modelName: DEFAULT_VECTOR_MODEL,
    backend: 'fastembed',
  });
  const productionProvider: VectorEmbeddingProvider = {
    providerType: EmbeddingProviderType.LOCAL,
    async embed(texts: string[], model: string, options?: { dimensions?: number }): Promise<BatchEmbeddingResponse> {
      const response = await localProvider.embed(texts, model, options);
      return {
        embeddings: response.embeddings,
        model: response.modelUsed,
        provider: response.provider,
        dimensions: response.dimensions,
        usage: response.usage,
        latencyMs: response.latencyMs,
        cacheHits: response.cacheHits,
      };
    },
    async healthCheck(): Promise<boolean> {
      return localProvider.healthCheck();
    },
    getDimensions(model: string): number {
      return localProvider.getDimensions(model);
    },
  };
  const dimension = productionProvider.getDimensions(DEFAULT_VECTOR_MODEL);
  if (dimension !== DEFAULT_VECTOR_DIMENSION) {
    throw new Error(
      `Production embedding invariant violation: expected ${DEFAULT_VECTOR_DIMENSION} dimensions for ${DEFAULT_VECTOR_MODEL}, got ${dimension}`,
    );
  }

  return new EmbeddingServiceImpl(
    new Map<EmbeddingProviderType, VectorEmbeddingProvider>([[EmbeddingProviderType.LOCAL, productionProvider]]),
    {
      defaultProvider: EmbeddingProviderType.LOCAL,
      defaultModel: DEFAULT_VECTOR_MODEL,
    },
  ) as IEmbeddingService & VectorEmbeddingService;
}

export function registerCanonicalBindings(
  bind: interfaces.Bind,
  options: BindingRegistryOptions = {},
): void {
  const integrationAdapters = options.integrationAdapters ?? createIntegrationAdapters();
  const bindSingleton = <T>(
    serviceIdentifier: interfaces.ServiceIdentifier<T>,
    factory: interfaces.DynamicValue<T>,
  ): void => {
    bind<T>(serviceIdentifier)
      .toDynamicValue(factory)
      .inSingletonScope();
  };

  bindSingleton<IDistillationService>(
    ServiceTypes.DistillationService,
    () => new DistillationService(),
  );

  bindSingleton<ILLMService>(
    ServiceTypes.LLMService,
    () => new LLMServiceImpl(new Map(), {}),
  );

  bindSingleton<IEmbeddingService>(
    ServiceTypes.EmbeddingService,
    () => createProductionEmbeddingService(),
  );

  bindSingleton<IKnowledgeService>(
    ServiceTypes.KnowledgeService,
    (context) => {
      const primaryEngine = context.container.get<IMemoryEngine>(ServiceTypes.MemoryEngine);
      const nowledgeMemService = context.container.get<INowledgeMemService>(ServiceTypes.NowledgeMemService);
      const nowledgeBridge = new NowledgeMemKnowledgeBridge(nowledgeMemService);
      const compositeEngine = new CompositeKnowledgeMemoryBridge(
        primaryEngine as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter,
        nowledgeBridge,
      );
      return new KnowledgeServiceImpl({
        dbPath: '.writing/knowledge.db',
        enableDistillation: true,
        embeddingService: context.container.get<IEmbeddingService & VectorEmbeddingService>(ServiceTypes.EmbeddingService),
        memoryEngine: compositeEngine,
        graphEngine: context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
      });
    },
  );

  bindSingleton<ISmartSearch>(
    ServiceTypes.SmartSearch,
    () => new SmartSearch({}),
  );

  bindSingleton<IHybridSearch>(
    ServiceTypes.HybridSearch,
    () => new HybridSearch({
      strategies: [],
      rrfK: 60,
      defaultTopK: 10,
      parallelExecution: true,
    }),
  );

  bindSingleton<IVectorSearch>(
    ServiceTypes.VectorSearch,
    (context) => new VectorSearch({
      dbPath: '.writing/vectors.db',
      dimension: DEFAULT_VECTOR_DIMENSION,
      modelName: DEFAULT_VECTOR_MODEL,
      embeddingService: context.container.get<IEmbeddingService & VectorEmbeddingService>(ServiceTypes.EmbeddingService),
    }),
  );

  bindSingleton<IMemoryEngine>(
    ServiceTypes.MemoryEngine,
    () => new MemoryEngineAdapter({
      flags: integrationAdapters.flags,
      storageShadow: integrationAdapters.storageShadow,
    }),
  );

  bindSingleton<IGraphEngine>(
    ServiceTypes.GraphEngine,
    () => new GraphEngineAdapter(),
  );

  bindSingleton<ISearchEngine>(
    ServiceTypes.SearchEngine,
    () => new SearchEngineAdapter(undefined, integrationAdapters),
  );

  bindSingleton<IWorkflowEngine>(
    ServiceTypes.WorkflowEngine,
    () => new WorkflowEngineAdapter(),
  );

  bindSingleton<ICriticEngine>(
    ServiceTypes.CriticEngine,
    () => new CriticEngineAdapter(),
  );

  bindSingleton<IAgentFactory>(
    ServiceTypes.AgentFactory,
    () => new AgentFactoryAdapter(),
  );

  bindSingleton<IBackupManager>(
    ServiceTypes.BackupManager,
    () => new BackupManagerAdapter(),
  );

  bindSingleton<ITokenService>(
    ServiceTypes.TokenService,
    () => new TokenServiceAdapter(),
  );

  bindSingleton<IObsidianService>(
    ServiceTypes.ObsidianService,
    (context) => new ObsidianServiceAdapter(
      context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
    ),
  );

  bindSingleton<IMCPGateway>(
    ServiceTypes.MCPGateway,
    () => new MCPGatewayAdapter(),
  );

  bindSingleton<ILearningOrchestrator>(
    ServiceTypes.LearningOrchestrator,
    (context) => {
      const orchestrator = new LearningOrchestrator({
        knowledgeService: context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
        graphEngine: context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
      });
      orchestrator.registerPipeline(new ImportLearningPipeline({
        knowledgeService: context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
        graphEngine: context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
      }));
      orchestrator.registerPipeline(new SelfEvolvingAgent({
        ruleEvolver: new RuleEvolver(),
        preferenceTracker: new PreferenceTracker(),
      }));
      orchestrator.registerPipeline(new ReadingLearningPipeline({
        knowledgeService: context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
        graphEngine: context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
      }));
      return orchestrator;
    },
  );

  bindSingleton<ILearningPipeline>(
    ServiceTypes.ImportLearning,
    (ctx) => {
      const orchestrator = ctx.container.get<ILearningOrchestrator>(ServiceTypes.LearningOrchestrator);
      return orchestrator.getPipeline(LearningCapability.IMPORT)!;
    },
  );

  bindSingleton<ILearningPipeline>(
    ServiceTypes.SelfEvolvingWriting,
    (ctx) => {
      const orchestrator = ctx.container.get<ILearningOrchestrator>(ServiceTypes.LearningOrchestrator);
      return orchestrator.getPipeline(LearningCapability.SELF_EVOLVING)!;
    },
  );

  bindSingleton<ILearningPipeline>(
    ServiceTypes.ReadingLearning,
    (ctx) => {
      const orchestrator = ctx.container.get<ILearningOrchestrator>(ServiceTypes.LearningOrchestrator);
      return orchestrator.getPipeline(LearningCapability.READING)!;
    },
  );

  bindSingleton<INowledgeMemService>(
    ServiceTypes.NowledgeMemService,
    () => new NowledgeMemServiceAdapter(),
  );

  bindSingleton<IRevisionService>(
    ServiceTypes.RevisionService,
    () => new RevisionServiceImpl(),
  );

  bindSingleton<ISessionIntelligence>(
    ServiceTypes.SessionIntelligenceService,
    () => new SessionIntelligenceServiceImpl(),
  );

  bindSingleton<IPersonalizationService>(
    ServiceTypes.PersonalizationService,
    (context) => new PersonalizationServiceImpl({
      persistenceBridge: context.container.get<IMemoryEngine>(ServiceTypes.MemoryEngine) as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter,
    }),
  );

  // ─── Collaboration Layer (Phase 1 Quick Wins) ────────────────────

  bindSingleton<IPhaseOrchestrator>(
    ServiceTypes.PhaseOrchestrator,
    () => new PhaseOrchestratorAdapter(),
  );

  bindSingleton<IWebSocketRelayService>(
    ServiceTypes.WebSocketRelayService,
    () => new WebSocketRelayServiceAdapter(),
  );

  bindSingleton<IDistillationNowledgeBridge>(
    ServiceTypes.DistillationNowledgeBridge,
    (context) => new DistillationNowledgeBridgeAdapter(
      context.container.get<INowledgeMemService>(ServiceTypes.NowledgeMemService),
    ),
  );

  bindSingleton<IConflictNowledgeBridge>(
    ServiceTypes.ConflictNowledgeBridge,
    (context) => new ConflictNowledgeBridgeAdapter(
      context.container.get<INowledgeMemService>(ServiceTypes.NowledgeMemService),
    ),
  );

  // ─── File Sync Adapters (T08) ─────────────────────────────────────

  bindSingleton<IFileSyncAdapter>(
    ServiceTypes.FileSyncService,
    (context) => new ObsidianSyncAdapter(
      context.container.get<IObsidianService>(ServiceTypes.ObsidianService),
    ),
  );

  // ─── EventBus (T01) ────────────────────────────────────────────────

  bindSingleton<IEventBus>(
    ServiceTypes.EventBus,
    (context) => new EventBusAdapter(
      context.container.get<IWebSocketRelayService>(ServiceTypes.WebSocketRelayService),
    ),
  );

  // ─── EventLog & DeadLetterQueue ─────────────────────────────────────

  bindSingleton<IEventLog>(
    ServiceTypes.EventLog,
    () => new EventLogAdapter(),
  );

  bindSingleton<IDeadLetterQueue>(
    ServiceTypes.DeadLetterQueue,
    (context) => new DeadLetterQueueAdapter({
      eventBus: context.container.get<IEventBus>(ServiceTypes.EventBus),
    }),
  );

  // ─── SearchStrategyConfig (T04) ───────────────────────────────────────

  bindSingleton<ISearchStrategyConfig>(
    ServiceTypes.SearchStrategyConfig,
    () => new SearchStrategyConfigAdapter(),
  );

  // ─── UnifiedSearchPipeline (T05) ────────────────────────────────────────

  bindSingleton<IUnifiedSearchPipeline>(
    ServiceTypes.UnifiedSearchPipeline,
    (context) => new UnifiedSearchPipelineAdapter({
      knowledgeService: context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
      smartSearch: context.container.get<ISmartSearch>(ServiceTypes.SmartSearch),
      hybridSearch: context.container.get<IHybridSearch>(ServiceTypes.HybridSearch),
      vectorSearch: context.container.get<IVectorSearch>(ServiceTypes.VectorSearch),
      obsidianService: context.container.get<IObsidianService>(ServiceTypes.ObsidianService),
      strategyConfig: context.container.get<ISearchStrategyConfig>(ServiceTypes.SearchStrategyConfig),
    }),
  );

  // ─── MCPRequestRouter (T07) ────────────────────────────────────────────

  bindSingleton<IMCPRequestRouter>(
    ServiceTypes.MCPRequestRouter,
    () => new MCPRequestRouterAdapter(),
  );

  // ─── NowledgeGraphSync (T08 — Knowledge ↔ Graph bidirectional sync) ──────

  bindSingleton<INowledgeGraphSync>(
    ServiceTypes.NowledgeGraphSync,
    (context) => new NowledgeGraphSyncAdapter(
      context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
      context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
      context.container.get<IEventBus>(ServiceTypes.EventBus),
      context.container.get<IConflictNowledgeBridge>(ServiceTypes.ConflictNowledgeBridge),
    ),
  );

  // ─── ObsidianKnowledgeSync (Obsidian ↔ Knowledge bidirectional sync) ──────

  bindSingleton<IObsidianKnowledgeSync>(
    ServiceTypes.ObsidianKnowledgeSync,
    (context) => new ObsidianKnowledgeSyncAdapter(
      context.container.get<IObsidianService>(ServiceTypes.ObsidianService),
      context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── GraphWikiLinkBridge (Graph entity ID ↔ Wiki page path resolution) ──────

  bindSingleton<IGraphWikiLinkBridge>(
    ServiceTypes.GraphWikiLinkBridge,
    (context) => new GraphWikiLinkBridgeAdapter(
      context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
      context.container.get<IObsidianService>(ServiceTypes.ObsidianService),
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── LLMFallbackChain ─────────────────────────────────────────────────────

  bindSingleton<ILLMFallbackChain>(
    ServiceTypes.LLMFallbackChain,
    (context) => new LLMFallbackChainAdapter(
      undefined,
      undefined,
      undefined,
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── SearchRelevanceScorer ──────────────────────────────────────────────

  bindSingleton<ISearchRelevanceScorer>(
    ServiceTypes.SearchRelevanceScorer,
    () => new SearchRelevanceScorerAdapter(),
  );

  // ─── SearchCacheManager ─────────────────────────────────────────────────

  bindSingleton<ISearchCacheManager>(
    ServiceTypes.SearchCacheManager,
    (context) => new SearchCacheManagerAdapter(
      undefined,
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── MCPServiceDiscovery ──────────────────────────────────────────────

  bindSingleton<IMCPServiceDiscovery>(
    ServiceTypes.MCPServiceDiscovery,
    (context) => new MCPServiceDiscoveryAdapter(
      context.container.get<IMCPRequestRouter>(ServiceTypes.MCPRequestRouter),
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── MCPHealthMonitor ─────────────────────────────────────────────────

  bindSingleton<IMCPHealthMonitor>(
    ServiceTypes.MCPHealthMonitor,
    (context) => new MCPHealthMonitorAdapter(
      context.container.get<IMCPRequestRouter>(ServiceTypes.MCPRequestRouter),
      new CircuitBreakerRegistry(),
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── ResultAggregator ─────────────────────────────────────────────────────

  bindSingleton<IParallelResultAggregator>(
    ServiceTypes.ResultAggregator,
    (context) => new ResultAggregatorAdapter(
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── QualityGateFeedbackLoop ──────────────────────────────────────────────────

  bindSingleton<IQualityGateFeedbackLoop>(
    ServiceTypes.QualityGateFeedbackLoop,
    (context) => new QualityGateFeedbackLoopAdapter(
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );

  // ─── WaveExecutionEngine ────────────────────────────────────────────────────

  bindSingleton<IWaveExecutionEngine>(
    ServiceTypes.WaveExecutionEngine,
    (context) => new WaveExecutionEngineAdapter(
      context.container.get<IEventBus>(ServiceTypes.EventBus),
    ),
  );
}
