import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearningCapability } from '../../learning/learning-types';
import { ProviderType } from '../../services/llm-service';
import { ServiceTypes, type AgentType } from '../../container/types';

const distillationServiceSetLlmClient = vi.hoisted(() => vi.fn());
const localEmbeddingProviderCtor = vi.hoisted(() => vi.fn());
const localEmbeddingProviderMethods = vi.hoisted(() => ({
  embed: vi.fn().mockResolvedValue({
    embeddings: [[0.1, 0.2, 0.3]],
    modelUsed: 'BAAI/bge-small-en-v1.5',
    provider: 'local',
    dimensions: 384,
    usage: { promptTokens: 3, totalTokens: 3 },
    latencyMs: 9,
    cacheHits: 1,
  }),
  healthCheck: vi.fn().mockResolvedValue(true),
  getDimensions: vi.fn().mockReturnValue(384),
}));
const openAiProviderCtor = vi.hoisted(() => vi.fn());
const anthropicProviderCtor = vi.hoisted(() => vi.fn());
const integrationAdaptersFactory = vi.hoisted(() => vi.fn(() => ({
  flags: {
    postgresEnabled: false,
    redisCacheEnabled: false,
    elasticsearchEnabled: false,
    neo4jEnabled: false,
    langflowEnabled: false,
  },
  storageShadow: {
    shadowWriteMemory: vi.fn(),
  },
})));
const embeddingServiceCtor = vi.hoisted(() => vi.fn());
const llmServiceCtor = vi.hoisted(() => vi.fn());
const knowledgeServiceCtor = vi.hoisted(() => vi.fn());
const revisionServiceCtor = vi.hoisted(() => vi.fn());
const sessionIntelligenceCtor = vi.hoisted(() => vi.fn());
const personalizationServiceCtor = vi.hoisted(() => vi.fn());
const smartSearchCtor = vi.hoisted(() => vi.fn());
const hybridSearchCtor = vi.hoisted(() => vi.fn());
const vectorSearchCtor = vi.hoisted(() => vi.fn());
const workflowEngineCtor = vi.hoisted(() => vi.fn());
const nowledgeBridgeCtor = vi.hoisted(() => vi.fn());
const compositeBridgeCtor = vi.hoisted(() => vi.fn());
const circuitBreakerRegistryCtor = vi.hoisted(() => vi.fn());
const commanderAgentCtor = vi.hoisted(() => vi.fn());
const architectAgentCtor = vi.hoisted(() => vi.fn());
const writerAgentCtor = vi.hoisted(() => vi.fn());
const criticAgentCtor = vi.hoisted(() => vi.fn());
const plotAgentCtor = vi.hoisted(() => vi.fn());
const learningOrchestratorCtor = vi.hoisted(() => vi.fn());
const importLearningPipelineCtor = vi.hoisted(() => vi.fn());
const selfEvolvingAgentCtor = vi.hoisted(() => vi.fn());
const ruleEvolverCtor = vi.hoisted(() => vi.fn());
const preferenceTrackerCtor = vi.hoisted(() => vi.fn());
const readingLearningPipelineCtor = vi.hoisted(() => vi.fn());

const memoryEngineAdapterCtor = vi.hoisted(() => vi.fn());
const graphEngineAdapterCtor = vi.hoisted(() => vi.fn());
const searchEngineAdapterCtor = vi.hoisted(() => vi.fn());
const workflowEngineAdapterCtor = vi.hoisted(() => vi.fn());
const criticEngineAdapterCtor = vi.hoisted(() => vi.fn());
const agentFactoryAdapterCtor = vi.hoisted(() => vi.fn());
const backupManagerAdapterCtor = vi.hoisted(() => vi.fn());
const tokenServiceAdapterCtor = vi.hoisted(() => vi.fn());
const obsidianServiceAdapterCtor = vi.hoisted(() => vi.fn());
const mcpGatewayAdapterCtor = vi.hoisted(() => vi.fn());
const nowledgeMemServiceAdapterCtor = vi.hoisted(() => vi.fn());
const phaseOrchestratorAdapterCtor = vi.hoisted(() => vi.fn());
const webSocketRelayServiceAdapterCtor = vi.hoisted(() => vi.fn());
const distillationNowledgeBridgeAdapterCtor = vi.hoisted(() => vi.fn());
const conflictNowledgeBridgeAdapterCtor = vi.hoisted(() => vi.fn());
const obsidianSyncAdapterCtor = vi.hoisted(() => vi.fn());
const cloudSyncAdapterCtor = vi.hoisted(() => vi.fn());
const knowledgeSyncAdapterCtor = vi.hoisted(() => vi.fn());
const fileSyncAdapterChainCtor = vi.hoisted(() => vi.fn());
const eventBusAdapterCtor = vi.hoisted(() => vi.fn());
const searchStrategyConfigAdapterCtor = vi.hoisted(() => vi.fn());
const unifiedSearchPipelineAdapterCtor = vi.hoisted(() => vi.fn());
const mcpRequestRouterAdapterCtor = vi.hoisted(() => vi.fn());
const nowledgeGraphSyncAdapterCtor = vi.hoisted(() => vi.fn());
const obsidianKnowledgeSyncAdapterCtor = vi.hoisted(() => vi.fn());
const llmFallbackChainAdapterCtor = vi.hoisted(() => vi.fn());
const eventLogAdapterCtor = vi.hoisted(() => vi.fn());
const deadLetterQueueAdapterCtor = vi.hoisted(() => vi.fn());
const mcpServiceDiscoveryAdapterCtor = vi.hoisted(() => vi.fn());
const mcpHealthMonitorAdapterCtor = vi.hoisted(() => vi.fn());
const searchRelevanceScorerAdapterCtor = vi.hoisted(() => vi.fn());
const searchCacheManagerAdapterCtor = vi.hoisted(() => vi.fn());
const resultAggregatorAdapterCtor = vi.hoisted(() => vi.fn());
const qualityGateFeedbackLoopAdapterCtor = vi.hoisted(() => vi.fn());
const waveExecutionEngineAdapterCtor = vi.hoisted(() => vi.fn());
const graphWikiLinkBridgeAdapterCtor = vi.hoisted(() => vi.fn());
const phaseOrchestratorCtor = vi.hoisted(() => vi.fn());

vi.mock('../../services', () => ({
  DistillationService: vi.fn().mockImplementation(function DistillationService(this: Record<string, unknown>) {
    Object.assign(this, {
      setLLMClient: distillationServiceSetLlmClient,
    });
  }),
  EmbeddingServiceImpl: vi.fn().mockImplementation(function EmbeddingServiceImpl(
    this: Record<string, unknown>,
    providers: Map<unknown, unknown>,
    config: unknown,
  ) {
    embeddingServiceCtor(providers, config);
    Object.assign(this, { providers, config });
  }),
  LLMServiceImpl: vi.fn().mockImplementation(function LLMServiceImpl(
    this: Record<string, unknown>,
    providers: Map<unknown, unknown>,
    options: unknown,
  ) {
    llmServiceCtor(providers, options);
    Object.assign(this, { providers, options });
  }),
  KnowledgeServiceImpl: vi.fn().mockImplementation(function KnowledgeServiceImpl(this: Record<string, unknown>, config: unknown) {
    knowledgeServiceCtor(config);
    Object.assign(this, { config });
  }),
  RevisionServiceImpl: vi.fn().mockImplementation(function RevisionServiceImpl(this: Record<string, unknown>) {
    revisionServiceCtor();
    Object.assign(this, { kind: 'revision-service' });
  }),
  SessionIntelligenceServiceImpl: vi.fn().mockImplementation(function SessionIntelligenceServiceImpl(this: Record<string, unknown>) {
    sessionIntelligenceCtor();
    Object.assign(this, { kind: 'session-intelligence-service' });
  }),
  PersonalizationServiceImpl: vi.fn().mockImplementation(function PersonalizationServiceImpl(
    this: Record<string, unknown>,
    config: unknown,
  ) {
    personalizationServiceCtor(config);
    Object.assign(this, { config });
  }),
}));

vi.mock('../../knowledge/providers', () => ({
  LocalEmbeddingProvider: vi.fn().mockImplementation(function LocalEmbeddingProvider(
    this: Record<string, unknown>,
    config: unknown,
  ) {
    localEmbeddingProviderCtor(config);
    Object.assign(this, localEmbeddingProviderMethods);
  }),
  OpenAILLMProvider: vi.fn().mockImplementation(function OpenAILLMProvider(
    this: Record<string, unknown>,
    config: unknown,
  ) {
    openAiProviderCtor(config);
    Object.assign(this, { provider: 'openai', config });
  }),
  AnthropicLLMProvider: vi.fn().mockImplementation(function AnthropicLLMProvider(
    this: Record<string, unknown>,
    config: unknown,
  ) {
    anthropicProviderCtor(config);
    Object.assign(this, { provider: 'anthropic', config });
  }),
}));

vi.mock('../../integrations', () => ({
  createIntegrationAdapters: integrationAdaptersFactory,
}));

vi.mock('../../search', () => ({
  SmartSearch: vi.fn().mockImplementation(function SmartSearch(this: Record<string, unknown>, config: unknown) {
    smartSearchCtor(config);
    Object.assign(this, { config });
  }),
  HybridSearch: vi.fn().mockImplementation(function HybridSearch(this: Record<string, unknown>, config: unknown) {
    hybridSearchCtor(config);
    Object.assign(this, { config });
  }),
  VectorSearch: vi.fn().mockImplementation(function VectorSearch(this: Record<string, unknown>, config: unknown) {
    vectorSearchCtor(config);
    Object.assign(this, { config });
  }),
}));

vi.mock('../../workflow/workflow-engine-core', () => ({
  WorkflowEngine: vi.fn().mockImplementation(function WorkflowEngine(this: Record<string, unknown>, ...args: unknown[]) {
    workflowEngineCtor(...args);
    Object.assign(this, { args });
  }),
}));

vi.mock('../../workflow/team/phase-orchestrator', () => ({
  PhaseOrchestrator: vi.fn().mockImplementation(function PhaseOrchestrator(this: Record<string, unknown>, ...args: unknown[]) {
    phaseOrchestratorCtor(...args);
    Object.assign(this, { args });
  }),
}));

vi.mock('../../services/nowledge-mem-knowledge-bridge', () => ({
  NowledgeMemKnowledgeBridge: vi.fn().mockImplementation(function NowledgeMemKnowledgeBridge(
    this: Record<string, unknown>,
    service: unknown,
  ) {
    nowledgeBridgeCtor(service);
    Object.assign(this, { service });
  }),
}));

vi.mock('../../services/composite-knowledge-memory-bridge', () => ({
  CompositeKnowledgeMemoryBridge: vi.fn().mockImplementation(function CompositeKnowledgeMemoryBridge(
    this: Record<string, unknown>,
    primaryEngine: unknown,
    bridge: unknown,
  ) {
    compositeBridgeCtor(primaryEngine, bridge);
    Object.assign(this, { primaryEngine, bridge });
  }),
}));

vi.mock('../../services/circuit-breaker', () => ({
  CircuitBreakerRegistry: vi.fn().mockImplementation(function CircuitBreakerRegistry(this: Record<string, unknown>) {
    circuitBreakerRegistryCtor();
    Object.assign(this, { kind: 'circuit-breaker-registry' });
  }),
}));

vi.mock('../../agents/commander', () => ({
  CommanderAgent: vi.fn().mockImplementation(function CommanderAgent(this: Record<string, unknown>, llmService: unknown) {
    commanderAgentCtor(llmService);
    Object.assign(this, { llmService, type: 'commander' });
  }),
}));

vi.mock('../../agents/architect', () => ({
  ArchitectAgent: vi.fn().mockImplementation(function ArchitectAgent(this: Record<string, unknown>, llmService: unknown) {
    architectAgentCtor(llmService);
    Object.assign(this, { llmService, type: 'architect' });
  }),
}));

vi.mock('../../agents/writer', () => ({
  WriterAgent: vi.fn().mockImplementation(function WriterAgent(this: Record<string, unknown>, config: unknown) {
    writerAgentCtor(config);
    Object.assign(this, { config, type: 'writer' });
  }),
}));

vi.mock('../../agents/critic', () => ({
  CriticAgent: vi.fn().mockImplementation(function CriticAgent(this: Record<string, unknown>, config: unknown) {
    criticAgentCtor(config);
    Object.assign(this, { config, type: 'critic' });
  }),
}));

vi.mock('../../agents/plot', () => ({
  PlotAgent: vi.fn().mockImplementation(function PlotAgent(this: Record<string, unknown>) {
    plotAgentCtor();
    Object.assign(this, { type: 'plot' });
  }),
}));

vi.mock('../../learning', () => ({
  LearningOrchestrator: vi.fn().mockImplementation(function LearningOrchestrator(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    learningOrchestratorCtor(deps);
    const pipelines = new Map<string, unknown>();
    Object.assign(this, {
      deps,
      pipelines,
      registerPipeline: (pipeline: { capability: string }) => {
        pipelines.set(pipeline.capability, pipeline);
      },
      getPipeline: (capability: string) => pipelines.get(capability),
    });
  }),
  ImportLearningPipeline: vi.fn().mockImplementation(function ImportLearningPipeline(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    importLearningPipelineCtor(deps);
    Object.assign(this, { capability: LearningCapability.IMPORT, deps });
  }),
  SelfEvolvingAgent: vi.fn().mockImplementation(function SelfEvolvingAgent(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    selfEvolvingAgentCtor(deps);
    Object.assign(this, { capability: LearningCapability.SELF_EVOLVING, deps });
  }),
  RuleEvolver: vi.fn().mockImplementation(function RuleEvolver(this: Record<string, unknown>) {
    ruleEvolverCtor();
    Object.assign(this, { kind: 'rule-evolver' });
  }),
  PreferenceTracker: vi.fn().mockImplementation(function PreferenceTracker(this: Record<string, unknown>) {
    preferenceTrackerCtor();
    Object.assign(this, { kind: 'preference-tracker' });
  }),
  ReadingLearningPipeline: vi.fn().mockImplementation(function ReadingLearningPipeline(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    readingLearningPipelineCtor(deps);
    Object.assign(this, { capability: LearningCapability.READING, deps });
  }),
}));

vi.mock('../../container/adapters', () => ({
  MemoryEngineAdapter: vi.fn().mockImplementation(function MemoryEngineAdapter(this: Record<string, unknown>, config: unknown) {
    memoryEngineAdapterCtor(config);
    Object.assign(this, { config });
  }),
  GraphEngineAdapter: vi.fn().mockImplementation(function GraphEngineAdapter(this: Record<string, unknown>) {
    graphEngineAdapterCtor();
    Object.assign(this, { kind: 'graph-engine-adapter' });
  }),
  SearchEngineAdapter: vi.fn().mockImplementation(function SearchEngineAdapter(
    this: Record<string, unknown>,
    arg0: unknown,
    arg1: unknown,
  ) {
    searchEngineAdapterCtor(arg0, arg1);
    Object.assign(this, { arg0, arg1 });
  }),
  WorkflowEngineAdapter: vi.fn().mockImplementation(function WorkflowEngineAdapter(this: Record<string, unknown>, engine: unknown) {
    workflowEngineAdapterCtor(engine);
    Object.assign(this, { engine });
  }),
  CriticEngineAdapter: vi.fn().mockImplementation(function CriticEngineAdapter(this: Record<string, unknown>) {
    criticEngineAdapterCtor();
    Object.assign(this, { kind: 'critic-engine-adapter' });
  }),
  AgentFactoryAdapter: vi.fn().mockImplementation(function AgentFactoryAdapter(
    this: Record<string, unknown>,
    registry: Map<AgentType, (llmService: unknown) => unknown>,
  ) {
    agentFactoryAdapterCtor(registry);
    Object.assign(this, {
      registry,
      getAgent(agentType: AgentType, _name?: string, _config?: Record<string, unknown>, llm?: unknown) {
        const factory = registry.get(agentType);
        if (!factory) {
          throw new Error(`Unknown agent type: ${String(agentType)}`);
        }
        return factory(llm);
      },
    });
  }),
  BackupManagerAdapter: vi.fn().mockImplementation(function BackupManagerAdapter(this: Record<string, unknown>) {
    backupManagerAdapterCtor();
    Object.assign(this, { kind: 'backup-manager-adapter' });
  }),
  TokenServiceAdapter: vi.fn().mockImplementation(function TokenServiceAdapter(this: Record<string, unknown>) {
    tokenServiceAdapterCtor();
    Object.assign(this, { kind: 'token-service-adapter' });
  }),
  ObsidianServiceAdapter: vi.fn().mockImplementation(function ObsidianServiceAdapter(
    this: Record<string, unknown>,
    knowledgeService: unknown,
    conflictBridge: unknown,
  ) {
    obsidianServiceAdapterCtor(knowledgeService, conflictBridge);
    Object.assign(this, { knowledgeService, conflictBridge });
  }),
  MCPGatewayAdapter: vi.fn().mockImplementation(function MCPGatewayAdapter(this: Record<string, unknown>) {
    mcpGatewayAdapterCtor();
    Object.assign(this, { kind: 'mcp-gateway-adapter' });
  }),
  NowledgeMemServiceAdapter: vi.fn().mockImplementation(function NowledgeMemServiceAdapter(this: Record<string, unknown>) {
    nowledgeMemServiceAdapterCtor();
    Object.assign(this, { kind: 'nowledge-mem-service-adapter' });
  }),
  PhaseOrchestratorAdapter: vi.fn().mockImplementation(function PhaseOrchestratorAdapter(
    this: Record<string, unknown>,
    arg0?: unknown,
    relay?: unknown,
    arg2?: unknown,
    arg3?: unknown,
  ) {
    phaseOrchestratorAdapterCtor(arg0, relay, arg2, arg3);
    Object.assign(this, { relay, orchestrator: { source: 'phase-orchestrator' } });
  }),
  WebSocketRelayServiceAdapter: vi.fn().mockImplementation(function WebSocketRelayServiceAdapter(this: Record<string, unknown>) {
    webSocketRelayServiceAdapterCtor();
    Object.assign(this, { kind: 'websocket-relay-service-adapter' });
  }),
  DistillationNowledgeBridgeAdapter: vi.fn().mockImplementation(function DistillationNowledgeBridgeAdapter(
    this: Record<string, unknown>,
    service: unknown,
  ) {
    distillationNowledgeBridgeAdapterCtor(service);
    Object.assign(this, { service });
  }),
  ConflictNowledgeBridgeAdapter: vi.fn().mockImplementation(function ConflictNowledgeBridgeAdapter(
    this: Record<string, unknown>,
    service: unknown,
  ) {
    conflictNowledgeBridgeAdapterCtor(service);
    Object.assign(this, { service });
  }),
  ObsidianSyncAdapter: vi.fn().mockImplementation(function ObsidianSyncAdapter(
    this: Record<string, unknown>,
    obsidianService: unknown,
  ) {
    obsidianSyncAdapterCtor(obsidianService);
    Object.assign(this, { obsidianService });
  }),
  CloudSyncAdapter: vi.fn().mockImplementation(function CloudSyncAdapter(this: Record<string, unknown>) {
    cloudSyncAdapterCtor();
    Object.assign(this, { kind: 'cloud-sync-adapter' });
  }),
  KnowledgeSyncAdapter: vi.fn().mockImplementation(function KnowledgeSyncAdapter(
    this: Record<string, unknown>,
    knowledgeService: unknown,
  ) {
    knowledgeSyncAdapterCtor(knowledgeService);
    Object.assign(this, { knowledgeService });
  }),
  FileSyncServiceAdapter: vi.fn().mockImplementation(function FileSyncServiceAdapter(this: Record<string, unknown>) {
    Object.assign(this, { kind: 'file-sync-service-adapter' });
  }),
  FileSyncAdapterChain: vi.fn().mockImplementation(function FileSyncAdapterChain(
    this: Record<string, unknown>,
    adapters: unknown,
    eventBus: unknown,
  ) {
    fileSyncAdapterChainCtor(adapters, eventBus);
    Object.assign(this, { adapters, eventBus });
  }),
  EventBusAdapter: vi.fn().mockImplementation(function EventBusAdapter(
    this: Record<string, unknown>,
    relayService: unknown,
    options: unknown,
  ) {
    eventBusAdapterCtor(relayService, options);
    Object.assign(this, { relayService, options });
  }),
  SearchStrategyConfigAdapter: vi.fn().mockImplementation(function SearchStrategyConfigAdapter(this: Record<string, unknown>) {
    searchStrategyConfigAdapterCtor();
    Object.assign(this, { kind: 'search-strategy-config-adapter' });
  }),
  UnifiedSearchPipelineAdapter: vi.fn().mockImplementation(function UnifiedSearchPipelineAdapter(
    this: Record<string, unknown>,
    deps: unknown,
  ) {
    unifiedSearchPipelineAdapterCtor(deps);
    Object.assign(this, { deps });
  }),
  MCPRequestRouterAdapter: vi.fn().mockImplementation(function MCPRequestRouterAdapter(this: Record<string, unknown>) {
    mcpRequestRouterAdapterCtor();
    Object.assign(this, { kind: 'mcp-request-router-adapter' });
  }),
  NowledgeGraphSyncAdapter: vi.fn().mockImplementation(function NowledgeGraphSyncAdapter(
    this: Record<string, unknown>,
    knowledgeService: unknown,
    graphEngine: unknown,
    eventBus: unknown,
    conflictBridge: unknown,
  ) {
    nowledgeGraphSyncAdapterCtor(knowledgeService, graphEngine, eventBus, conflictBridge);
    Object.assign(this, { knowledgeService, graphEngine, eventBus, conflictBridge });
  }),
  ObsidianKnowledgeSyncAdapter: vi.fn().mockImplementation(function ObsidianKnowledgeSyncAdapter(
    this: Record<string, unknown>,
    obsidianService: unknown,
    knowledgeService: unknown,
    eventBus: unknown,
    conflictBridge: unknown,
  ) {
    obsidianKnowledgeSyncAdapterCtor(obsidianService, knowledgeService, eventBus, conflictBridge);
    Object.assign(this, { obsidianService, knowledgeService, eventBus, conflictBridge });
  }),
  LLMFallbackChainAdapter: vi.fn().mockImplementation(function LLMFallbackChainAdapter(this: Record<string, unknown>, ...args: unknown[]) {
    llmFallbackChainAdapterCtor(...args);
    Object.assign(this, { args });
  }),
  EventLogAdapter: vi.fn().mockImplementation(function EventLogAdapter(this: Record<string, unknown>) {
    eventLogAdapterCtor();
    Object.assign(this, { kind: 'event-log-adapter' });
  }),
  DeadLetterQueueAdapter: vi.fn().mockImplementation(function DeadLetterQueueAdapter(this: Record<string, unknown>, config: unknown) {
    deadLetterQueueAdapterCtor(config);
    Object.assign(this, { config });
  }),
  MCPServiceDiscoveryAdapter: vi.fn().mockImplementation(function MCPServiceDiscoveryAdapter(
    this: Record<string, unknown>,
    router: unknown,
    eventBus: unknown,
  ) {
    mcpServiceDiscoveryAdapterCtor(router, eventBus);
    Object.assign(this, { router, eventBus });
  }),
  MCPHealthMonitorAdapter: vi.fn().mockImplementation(function MCPHealthMonitorAdapter(
    this: Record<string, unknown>,
    router: unknown,
    registry: unknown,
    eventBus: unknown,
  ) {
    mcpHealthMonitorAdapterCtor(router, registry, eventBus);
    Object.assign(this, { router, registry, eventBus });
  }),
  SearchRelevanceScorerAdapter: vi.fn().mockImplementation(function SearchRelevanceScorerAdapter(this: Record<string, unknown>) {
    searchRelevanceScorerAdapterCtor();
    Object.assign(this, { kind: 'search-relevance-scorer-adapter' });
  }),
  SearchCacheManagerAdapter: vi.fn().mockImplementation(function SearchCacheManagerAdapter(
    this: Record<string, unknown>,
    arg0: unknown,
    eventBus: unknown,
  ) {
    searchCacheManagerAdapterCtor(arg0, eventBus);
    Object.assign(this, { arg0, eventBus });
  }),
  ResultAggregatorAdapter: vi.fn().mockImplementation(function ResultAggregatorAdapter(this: Record<string, unknown>, eventBus: unknown) {
    resultAggregatorAdapterCtor(eventBus);
    Object.assign(this, { eventBus });
  }),
  QualityGateFeedbackLoopAdapter: vi.fn().mockImplementation(function QualityGateFeedbackLoopAdapter(
    this: Record<string, unknown>,
    eventBus: unknown,
  ) {
    qualityGateFeedbackLoopAdapterCtor(eventBus);
    Object.assign(this, { eventBus });
  }),
  WaveExecutionEngineAdapter: vi.fn().mockImplementation(function WaveExecutionEngineAdapter(
    this: Record<string, unknown>,
    eventBus: unknown,
  ) {
    waveExecutionEngineAdapterCtor(eventBus);
    Object.assign(this, { eventBus });
  }),
  GraphWikiLinkBridgeAdapter: vi.fn().mockImplementation(function GraphWikiLinkBridgeAdapter(
    this: Record<string, unknown>,
    graphEngine: unknown,
    obsidianService: unknown,
    eventBus: unknown,
  ) {
    graphWikiLinkBridgeAdapterCtor(graphEngine, obsidianService, eventBus);
    Object.assign(this, { graphEngine, obsidianService, eventBus });
  }),
}));

import { CANONICAL_SERVICE_IDENTIFIERS, registerCanonicalBindings } from '../../container/bindings';

type FactoryMap = Map<symbol, (context: { container: { get: (serviceId: symbol) => unknown } }) => unknown>;

function collectFactories(): FactoryMap {
  const factories: FactoryMap = new Map();
  const bind = <T>(serviceIdentifier: symbol) => ({
    toDynamicValue(factory: (context: { container: { get: (serviceId: symbol) => unknown } }) => T) {
      factories.set(serviceIdentifier, factory as (context: { container: { get: (serviceId: symbol) => unknown } }) => unknown);
      return {
        inSingletonScope() {
          return undefined;
        },
      };
    },
  });

  registerCanonicalBindings(bind as never);
  return factories;
}

function createContext(overrides: Partial<Record<symbol, unknown>> = {}) {
  return {
    container: {
      get(serviceId: symbol) {
        if (serviceId in overrides) {
          return overrides[serviceId];
        }
        throw new Error(`Missing dependency for ${String(serviceId.description ?? serviceId.toString())}`);
      },
    },
  };
}

describe('container/bindings canonical resolution', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    localEmbeddingProviderMethods.getDimensions.mockReturnValue(384);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it('registers all canonical service identifiers through the binding registry', () => {
    const factories = collectFactories();

    expect(new Set(factories.keys())).toEqual(new Set(CANONICAL_SERVICE_IDENTIFIERS));
    expect(integrationAdaptersFactory).toHaveBeenCalledTimes(1);
  });

  it('covers llm, embedding, workflow, learning, and agent factory branches', async () => {
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.ANTHROPIC_API_KEY = 'sk-anthropic';

    const factories = collectFactories();
    const tokenService = { id: 'token-service' };
    const llmContext = createContext({
      [ServiceTypes.TokenService]: tokenService,
    });

    const llmService = factories.get(ServiceTypes.LLMService)?.(llmContext) as { providers: Map<ProviderType, unknown>; options: unknown };
    expect(llmServiceCtor).toHaveBeenCalledTimes(1);
    expect(Array.from(llmService.providers.keys())).toEqual([ProviderType.OPENAI, ProviderType.ANTHROPIC]);
    expect(openAiProviderCtor).toHaveBeenCalledWith({ apiKey: 'sk-openai' });
    expect(anthropicProviderCtor).toHaveBeenCalledWith({ apiKey: 'sk-anthropic' });
    expect(llmService.options).toEqual({ tokenService });

    process.env.OPENAI_API_KEY = '';
    process.env.ANTHROPIC_API_KEY = '';
    factories.get(ServiceTypes.LLMService)?.(llmContext);
    const emptyProviders = llmServiceCtor.mock.calls[1]?.[0] as Map<ProviderType, unknown>;
    expect(Array.from(emptyProviders.keys())).toEqual([]);

    const embeddingService = factories.get(ServiceTypes.EmbeddingService)?.(createContext()) as {
      providers: Map<string, { embed: (texts: string[], model: string, options?: { dimensions?: number }) => Promise<unknown>; healthCheck: () => Promise<boolean>; getDimensions: (model: string) => number }>;
      config: unknown;
    };
    expect(localEmbeddingProviderCtor).toHaveBeenCalledWith({
      modelName: 'BAAI/bge-small-en-v1.5',
      backend: 'fastembed',
    });
    const localProvider = embeddingService.providers.get('local');
    expect(localProvider).toBeDefined();
    await expect(localProvider?.embed(['alpha'], 'BAAI/bge-small-en-v1.5', { dimensions: 384 })).resolves.toEqual({
      embeddings: [[0.1, 0.2, 0.3]],
      model: 'BAAI/bge-small-en-v1.5',
      provider: 'local',
      dimensions: 384,
      usage: { promptTokens: 3, totalTokens: 3 },
      latencyMs: 9,
      cacheHits: 1,
    });
    await expect(localProvider?.healthCheck()).resolves.toBe(true);
    expect(localProvider?.getDimensions('BAAI/bge-small-en-v1.5')).toBe(384);
    expect(embeddingService.config).toEqual({
      defaultProvider: 'local',
      defaultModel: 'BAAI/bge-small-en-v1.5',
    });

    localEmbeddingProviderMethods.getDimensions.mockReturnValueOnce(256);
    expect(() => factories.get(ServiceTypes.EmbeddingService)?.(createContext())).toThrow(
      'Production embedding invariant violation: expected 384 dimensions for BAAI/bge-small-en-v1.5, got 256',
    );

    const phaseOrchestratorAdapter = {
      relay: { id: 'relay' },
      orchestrator: { id: 'phase-orchestrator' },
    };
    Object.setPrototypeOf(phaseOrchestratorAdapter, (await import('../../container/adapters')).PhaseOrchestratorAdapter.prototype);
    const workflowContext = createContext({
      [ServiceTypes.PhaseOrchestrator]: phaseOrchestratorAdapter,
      [ServiceTypes.LLMService]: llmService,
    });
    const workflowAdapter = factories.get(ServiceTypes.WorkflowEngine)?.(workflowContext) as { engine: { args: unknown[] } };
    expect(workflowEngineCtor).toHaveBeenCalledWith(undefined, undefined, llmService, undefined, undefined, {
      id: 'phase-orchestrator',
    });
    expect(workflowEngineAdapterCtor).toHaveBeenCalledWith(workflowAdapter.engine);

    factories.get(ServiceTypes.WorkflowEngine)?.(createContext({
      [ServiceTypes.PhaseOrchestrator]: { orchestrator: { id: 'ignored' } },
      [ServiceTypes.LLMService]: llmService,
    }));
    expect(workflowEngineCtor.mock.calls[1]?.[5]).toBeUndefined();

    const knowledgeService = { id: 'knowledge-service' };
    const graphEngine = { id: 'graph-engine' };
    const learningOrchestrator = factories.get(ServiceTypes.LearningOrchestrator)?.(createContext({
      [ServiceTypes.KnowledgeService]: knowledgeService,
      [ServiceTypes.GraphEngine]: graphEngine,
    })) as {
      getPipeline: (capability: LearningCapability) => unknown;
    };
    expect(learningOrchestratorCtor).toHaveBeenCalledWith({
      knowledgeService,
      graphEngine,
    });
    expect(importLearningPipelineCtor).toHaveBeenCalledWith({
      knowledgeService,
      graphEngine,
    });
    expect(readingLearningPipelineCtor).toHaveBeenCalledWith({
      knowledgeService,
      graphEngine,
    });
    expect(ruleEvolverCtor).toHaveBeenCalledTimes(1);
    expect(preferenceTrackerCtor).toHaveBeenCalledTimes(1);
    expect(factories.get(ServiceTypes.ImportLearning)?.(createContext({
      [ServiceTypes.LearningOrchestrator]: learningOrchestrator,
    }))).toBe(learningOrchestrator.getPipeline(LearningCapability.IMPORT));
    expect(factories.get(ServiceTypes.SelfEvolvingWriting)?.(createContext({
      [ServiceTypes.LearningOrchestrator]: learningOrchestrator,
    }))).toBe(learningOrchestrator.getPipeline(LearningCapability.SELF_EVOLVING));
    expect(factories.get(ServiceTypes.ReadingLearning)?.(createContext({
      [ServiceTypes.LearningOrchestrator]: learningOrchestrator,
    }))).toBe(learningOrchestrator.getPipeline(LearningCapability.READING));

    const agentFactory = factories.get(ServiceTypes.AgentFactory)?.(createContext()) as {
      registry: Map<AgentType, (llmService: unknown) => unknown>;
      getAgent: (agentType: AgentType, name?: string, config?: Record<string, unknown>, llm?: unknown) => unknown;
    };
    const llmDependency = { id: 'agent-llm' };
    agentFactory.getAgent('commander' as AgentType, undefined, undefined, llmDependency);
    agentFactory.getAgent('architect' as AgentType, undefined, undefined, llmDependency);
    agentFactory.getAgent('writer' as AgentType, undefined, undefined, llmDependency);
    agentFactory.getAgent('critic' as AgentType, undefined, undefined, llmDependency);
    agentFactory.getAgent('plot' as AgentType);
    expect(agentFactory.registry.size).toBe(5);
    expect(commanderAgentCtor).toHaveBeenCalledWith(llmDependency);
    expect(architectAgentCtor).toHaveBeenCalledWith(llmDependency);
    expect(writerAgentCtor).toHaveBeenCalledWith({ llmService: llmDependency });
    expect(criticAgentCtor).toHaveBeenCalledWith({ llmService: llmDependency });
    expect(plotAgentCtor).toHaveBeenCalledTimes(1);
  });

  it('covers knowledge, collaboration, sync, and gateway-adjacent factories', () => {
    const factories = collectFactories();

    const primaryEngine = { id: 'memory-engine' };
    const nowledgeMemService = { id: 'nowledge-mem-service' };
    const graphEngine = { id: 'graph-engine' };
    const eventBus = { id: 'event-bus' };
    const llmService = { id: 'llm-service' };
    const embeddingService = { id: 'embedding-service' };
    const conflictBridge = { id: 'conflict-bridge' };
    const obsidianService = { id: 'obsidian-service' };
    const webSocketRelayService = { id: 'websocket-relay-service' };
    const mcpRouter = { id: 'mcp-router' };
    const smartSearch = { id: 'smart-search' };
    const hybridSearch = { id: 'hybrid-search' };
    const vectorSearch = { id: 'vector-search' };
    const strategyConfig = { id: 'strategy-config' };

    const knowledgeContext = createContext({
      [ServiceTypes.MemoryEngine]: primaryEngine,
      [ServiceTypes.NowledgeMemService]: nowledgeMemService,
      [ServiceTypes.LLMService]: llmService,
      [ServiceTypes.EmbeddingService]: embeddingService,
      [ServiceTypes.GraphEngine]: graphEngine,
      [ServiceTypes.EventBus]: eventBus,
    });
    const knowledgeService = factories.get(ServiceTypes.KnowledgeService)?.(knowledgeContext) as { config: Record<string, unknown> };
    expect(nowledgeBridgeCtor).toHaveBeenCalledWith(nowledgeMemService);
    expect(compositeBridgeCtor).toHaveBeenCalledTimes(1);
    expect(knowledgeServiceCtor).toHaveBeenCalledWith(expect.objectContaining({
      dbPath: '.writing/knowledge.db',
      enableDistillation: true,
      llmService,
      embeddingService,
      graphEngine,
      eventBus,
    }));
    expect(knowledgeService.config.memoryEngine).toMatchObject({
      primaryEngine,
    });

    const distillationService = factories.get(ServiceTypes.DistillationService)?.(createContext({
      [ServiceTypes.LLMService]: llmService,
    }));
    expect(distillationServiceSetLlmClient).toHaveBeenCalledWith(llmService);
    expect(distillationService).toBeDefined();

    factories.get(ServiceTypes.DistillationService)?.(createContext({
      [ServiceTypes.LLMService]: undefined,
    }));
    expect(distillationServiceSetLlmClient).toHaveBeenCalledTimes(1);

    factories.get(ServiceTypes.SmartSearch)?.(createContext());
    factories.get(ServiceTypes.HybridSearch)?.(createContext());
    factories.get(ServiceTypes.VectorSearch)?.(createContext({
      [ServiceTypes.EmbeddingService]: embeddingService,
    }));
    factories.get(ServiceTypes.MemoryEngine)?.(createContext());
    factories.get(ServiceTypes.GraphEngine)?.(createContext());
    factories.get(ServiceTypes.SearchEngine)?.(createContext());
    factories.get(ServiceTypes.CriticEngine)?.(createContext());
    factories.get(ServiceTypes.BackupManager)?.(createContext());
    factories.get(ServiceTypes.TokenService)?.(createContext());
    factories.get(ServiceTypes.MCPGateway)?.(createContext());
    factories.get(ServiceTypes.NowledgeMemService)?.(createContext());
    factories.get(ServiceTypes.RevisionService)?.(createContext());
    factories.get(ServiceTypes.SessionIntelligenceService)?.(createContext());
    factories.get(ServiceTypes.PersonalizationService)?.(createContext({
      [ServiceTypes.MemoryEngine]: primaryEngine,
    }));
    factories.get(ServiceTypes.ObsidianService)?.(createContext({
      [ServiceTypes.KnowledgeService]: knowledgeService,
      [ServiceTypes.ConflictNowledgeBridge]: conflictBridge,
    }));
    factories.get(ServiceTypes.PhaseOrchestrator)?.(createContext({
      [ServiceTypes.WebSocketRelayService]: webSocketRelayService,
    }));
    factories.get(ServiceTypes.WebSocketRelayService)?.(createContext());
    factories.get(ServiceTypes.DistillationNowledgeBridge)?.(createContext({
      [ServiceTypes.NowledgeMemService]: nowledgeMemService,
    }));
    factories.get(ServiceTypes.ConflictNowledgeBridge)?.(createContext({
      [ServiceTypes.NowledgeMemService]: nowledgeMemService,
    }));
    factories.get(ServiceTypes.FileSyncService)?.(createContext({
      [ServiceTypes.ObsidianService]: obsidianService,
      [ServiceTypes.KnowledgeService]: knowledgeService,
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.EventLog)?.(createContext());
    factories.get(ServiceTypes.DeadLetterQueue)?.(createContext({
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.EventBus)?.(createContext({
      [ServiceTypes.WebSocketRelayService]: webSocketRelayService,
      [ServiceTypes.EventLog]: { id: 'event-log' },
    }));
    factories.get(ServiceTypes.SearchStrategyConfig)?.(createContext());
    factories.get(ServiceTypes.UnifiedSearchPipeline)?.(createContext({
      [ServiceTypes.KnowledgeService]: knowledgeService,
      [ServiceTypes.SmartSearch]: smartSearch,
      [ServiceTypes.HybridSearch]: hybridSearch,
      [ServiceTypes.VectorSearch]: vectorSearch,
      [ServiceTypes.ObsidianService]: obsidianService,
      [ServiceTypes.SearchStrategyConfig]: strategyConfig,
    }));
    factories.get(ServiceTypes.MCPRequestRouter)?.(createContext());
    factories.get(ServiceTypes.NowledgeGraphSync)?.(createContext({
      [ServiceTypes.KnowledgeService]: knowledgeService,
      [ServiceTypes.GraphEngine]: graphEngine,
      [ServiceTypes.EventBus]: eventBus,
      [ServiceTypes.ConflictNowledgeBridge]: conflictBridge,
    }));
    factories.get(ServiceTypes.ObsidianKnowledgeSync)?.(createContext({
      [ServiceTypes.ObsidianService]: obsidianService,
      [ServiceTypes.KnowledgeService]: knowledgeService,
      [ServiceTypes.EventBus]: eventBus,
      [ServiceTypes.ConflictNowledgeBridge]: conflictBridge,
    }));
    factories.get(ServiceTypes.GraphWikiLinkBridge)?.(createContext({
      [ServiceTypes.GraphEngine]: graphEngine,
      [ServiceTypes.ObsidianService]: obsidianService,
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.LLMFallbackChain)?.(createContext({
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.SearchRelevanceScorer)?.(createContext());
    factories.get(ServiceTypes.SearchCacheManager)?.(createContext({
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.MCPServiceDiscovery)?.(createContext({
      [ServiceTypes.MCPRequestRouter]: mcpRouter,
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.MCPHealthMonitor)?.(createContext({
      [ServiceTypes.MCPRequestRouter]: mcpRouter,
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.ResultAggregator)?.(createContext({
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.QualityGateFeedbackLoop)?.(createContext({
      [ServiceTypes.EventBus]: eventBus,
    }));
    factories.get(ServiceTypes.WaveExecutionEngine)?.(createContext({
      [ServiceTypes.EventBus]: eventBus,
    }));

    expect(memoryEngineAdapterCtor).toHaveBeenCalledWith({
      flags: {
        postgresEnabled: false,
        redisCacheEnabled: false,
        elasticsearchEnabled: false,
        neo4jEnabled: false,
        langflowEnabled: false,
      },
      storageShadow: {
        shadowWriteMemory: expect.any(Function),
      },
    });
    expect(searchEngineAdapterCtor).toHaveBeenCalledWith(undefined, {
      flags: {
        postgresEnabled: false,
        redisCacheEnabled: false,
        elasticsearchEnabled: false,
        neo4jEnabled: false,
        langflowEnabled: false,
      },
      storageShadow: {
        shadowWriteMemory: expect.any(Function),
      },
    });
    expect(vectorSearchCtor).toHaveBeenCalledWith({
      dbPath: '.writing/vectors.db',
      dimension: 384,
      modelName: 'BAAI/bge-small-en-v1.5',
      embeddingService,
    });
    expect(obsidianServiceAdapterCtor).toHaveBeenCalledWith(knowledgeService, conflictBridge);
    expect(phaseOrchestratorAdapterCtor).toHaveBeenCalledWith(undefined, webSocketRelayService, undefined, undefined);
    expect(fileSyncAdapterChainCtor).toHaveBeenCalledWith({
      obsidian: expect.objectContaining({ obsidianService }),
      cloud: expect.objectContaining({ kind: 'cloud-sync-adapter' }),
      knowledge: expect.objectContaining({ knowledgeService }),
    }, eventBus);
    expect(eventBusAdapterCtor).toHaveBeenCalledWith(webSocketRelayService, {
      eventLog: { id: 'event-log' },
    });
    expect(unifiedSearchPipelineAdapterCtor).toHaveBeenCalledWith({
      knowledgeService,
      smartSearch,
      hybridSearch,
      vectorSearch,
      obsidianService,
      strategyConfig,
    });
    expect(nowledgeGraphSyncAdapterCtor).toHaveBeenCalledWith(knowledgeService, graphEngine, eventBus, conflictBridge);
    expect(obsidianKnowledgeSyncAdapterCtor).toHaveBeenCalledWith(obsidianService, knowledgeService, eventBus, conflictBridge);
    expect(graphWikiLinkBridgeAdapterCtor).toHaveBeenCalledWith(graphEngine, obsidianService, eventBus);
    expect(llmFallbackChainAdapterCtor).toHaveBeenCalledWith(undefined, undefined, undefined, eventBus);
    expect(searchCacheManagerAdapterCtor).toHaveBeenCalledWith(undefined, eventBus);
    expect(mcpServiceDiscoveryAdapterCtor).toHaveBeenCalledWith(mcpRouter, eventBus);
    expect(circuitBreakerRegistryCtor).toHaveBeenCalledTimes(1);
    expect(mcpHealthMonitorAdapterCtor).toHaveBeenCalledWith(mcpRouter, expect.objectContaining({ kind: 'circuit-breaker-registry' }), eventBus);
    expect(resultAggregatorAdapterCtor).toHaveBeenCalledWith(eventBus);
    expect(qualityGateFeedbackLoopAdapterCtor).toHaveBeenCalledWith(eventBus);
    expect(waveExecutionEngineAdapterCtor).toHaveBeenCalledWith(eventBus);
  });
});
