import type { interfaces } from 'inversify';

import {
  ServiceTypes,
  AgentType,
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
import { ProviderType } from '../services/llm-service';
import type { LLMProvider } from '../protocols/llm';
import {
  SmartSearch,
  HybridSearch,
  VectorSearch,
} from '../search';
import { LocalEmbeddingProvider } from '../knowledge/providers';
import { OpenAILLMProvider, AnthropicLLMProvider } from '../knowledge/providers';
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
  FileSyncServiceAdapter,
  FileSyncAdapterChain,
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
import { CommanderAgent } from '../agents/commander';
import { ArchitectAgent } from '../agents/architect';
import { WriterAgent } from '../agents/writer';
import { CriticAgent } from '../agents/critic';
import { PlotAgent } from '../agents/plot';
import { AgentType as BaseAgentType } from '../agents/base';
import type { AgentConstructor } from '../agents/factory';
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

  // Q4: DistillationService wired to LLMService so distillation can use
  // actual LLM calls instead of falling back to simple extraction.
  bindSingleton<IDistillationService>(
    ServiceTypes.DistillationService,
    (context) => {
      const distillationService = new DistillationService();
      const llmService = context.container.get<ILLMService>(ServiceTypes.LLMService);
      // Wire LLMService into DistillationService for actual content analysis
      if (llmService) {
        distillationService.setLLMClient(llmService as any);
      }
      return distillationService;
    },
  );

    // Q2: LLM providers registered in DI — OpenAI and Anthropic providers
  // are instantiated from env vars and injected into LLMServiceImpl.
  // Q7: TokenService wired into LLMService for session-level budget tracking.
  bindSingleton<ILLMService>(
    ServiceTypes.LLMService,
    (context) => {
      const providers = new Map<ProviderType, LLMProvider>();

      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        providers.set(ProviderType.OPENAI, new OpenAILLMProvider({ apiKey: openaiKey }) as unknown as LLMProvider);
      }

      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        providers.set(ProviderType.ANTHROPIC, new AnthropicLLMProvider({ apiKey: anthropicKey }) as unknown as LLMProvider);
      }

      return new LLMServiceImpl(providers, {
        tokenService: context.container.get<ITokenService>(ServiceTypes.TokenService),
      });
    },
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
        eventBus: context.container.get<IEventBus>(ServiceTypes.EventBus),
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

    // Q1: WorkflowEngine wired to PhaseOrchestrator — quality gates are invoked
  // during step execution (before phase transitions, after task completion).
  bindSingleton<IWorkflowEngine>(
    ServiceTypes.WorkflowEngine,
    (context) => {
      const phaseOrchAdapter = context.container.get<IPhaseOrchestrator>(ServiceTypes.PhaseOrchestrator);
      // Extract the underlying PhaseOrchestrator from the adapter for injection
      const engine = phaseOrchAdapter instanceof PhaseOrchestratorAdapter
        ? new WorkflowEngine(undefined, undefined, undefined, undefined, undefined,
            (phaseOrchAdapter as unknown as { orchestrator: PhaseOrchestrator }).orchestrator)
        : new WorkflowEngine();
      return new WorkflowEngineAdapter(engine);
    },
  );

  bindSingleton<ICriticEngine>(
    ServiceTypes.CriticEngine,
    () => new CriticEngineAdapter(),
  );

  // G10: AgentFactory wired with agent registry — DI-injected constructors
  // take precedence over built-in direct construction.
  bindSingleton<IAgentFactory>(
    ServiceTypes.AgentFactory,
    () => {
      const registry = new Map<AgentType, AgentConstructor>();
      registry.set(AgentType.Commander, (llmService) => new CommanderAgent(llmService));
      registry.set(AgentType.Architect, (llmService) => new ArchitectAgent(llmService));
      registry.set(AgentType.Writer, (llmService) => new WriterAgent({ llmService: llmService as import('../agents/base').IAgentLLMService }));
      registry.set(AgentType.Critic, (llmService) => new CriticAgent({ llmService: llmService as import('../agents/base').IAgentLLMService }));
      registry.set(AgentType.Plot, () => new PlotAgent());
      return new AgentFactoryAdapter(registry);
    },
  );

  bindSingleton<IBackupManager>(
    ServiceTypes.BackupManager,
    () => new BackupManagerAdapter(),
  );

  bindSingleton<ITokenService>(
    ServiceTypes.TokenService,
    () => new TokenServiceAdapter(),
  );

  // Q5: ConflictNowledgeBridge wired into ObsidianService — bidirectional
  // conflict detection works when Obsidian vault changes flow back to Knowledge.
  bindSingleton<IObsidianService>(
    ServiceTypes.ObsidianService,
    (context) => new ObsidianServiceAdapter(
      context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
      context.container.get<IConflictNowledgeBridge>(ServiceTypes.ConflictNowledgeBridge),
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

  // Q1: PhaseOrchestrator wired to WebSocketRelayService so phase transitions
  // are broadcast to connected browser clients in real-time.
  bindSingleton<IPhaseOrchestrator>(
    ServiceTypes.PhaseOrchestrator,
    (context) => new PhaseOrchestratorAdapter(
      undefined,
      context.container.get<IWebSocketRelayService>(ServiceTypes.WebSocketRelayService),
    ),
  );

  bindSingleton<IWebSocketRelayService>(
    ServiceTypes.WebSocketRelayService,
    () => new WebSocketRelayServiceAdapter(),
  );

  // Q4: DistillationNowledgeBridge wired to DistillationService — when
  // distill() is called, the bridge performs actual LLM-based distillation
  // before persisting to Nowledge Mem (Obsidian vault format).
  bindSingleton<IDistillationNowledgeBridge>(
    ServiceTypes.DistillationNowledgeBridge,
    (context) => new DistillationNowledgeBridgeAdapter(
      context.container.get<INowledgeMemService>(ServiceTypes.NowledgeMemService),
      context.container.get<IDistillationService>(ServiceTypes.DistillationService),
    ),
  );

  bindSingleton<IConflictNowledgeBridge>(
    ServiceTypes.ConflictNowledgeBridge,
    (context) => new ConflictNowledgeBridgeAdapter(
      context.container.get<INowledgeMemService>(ServiceTypes.NowledgeMemService),
    ),
  );

  // ─── File Sync Adapters (T08 — Q8: unified adapter chain) ──────────────────

  bindSingleton<IFileSyncAdapter>(
    ServiceTypes.FileSyncService,
    (context) => new FileSyncAdapterChain({
      obsidian: new ObsidianSyncAdapter(
        context.container.get<IObsidianService>(ServiceTypes.ObsidianService),
      ),
      cloud: new CloudSyncAdapter(),
      knowledge: new KnowledgeSyncAdapter(
        context.container.get<IKnowledgeService>(ServiceTypes.KnowledgeService),
      ),
    }, context.container.get<IEventBus>(ServiceTypes.EventBus)),
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

  // ─── EventBus (T01) ────────────────────────────────────────────────
  // G16: EventLog wired into EventBus for event persistence and replay.
  // DeadLetterQueue is NOT wired here to avoid circular DI (DLQ needs EventBus).
  // Handler errors still fall back to console.error when DLQ is absent from config.

  bindSingleton<IEventBus>(
    ServiceTypes.EventBus,
    (context) => new EventBusAdapter(
      context.container.get<IWebSocketRelayService>(ServiceTypes.WebSocketRelayService),
      {
        eventLog: context.container.get<IEventLog>(ServiceTypes.EventLog),
      },
    ),
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
      context.container.get<IConflictNowledgeBridge>(ServiceTypes.ConflictNowledgeBridge),
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
