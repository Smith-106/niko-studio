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
} from './types';
import {
  DistillationService,
  EmbeddingServiceImpl,
  LLMServiceImpl,
  KnowledgeServiceImpl,
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
} from './adapters';
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
    (context) => new KnowledgeServiceImpl({
      dbPath: '.writing/knowledge.db',
      enableDistillation: true,
      embeddingService: context.container.get<IEmbeddingService & VectorEmbeddingService>(ServiceTypes.EmbeddingService),
      memoryEngine: context.container.get<IMemoryEngine>(ServiceTypes.MemoryEngine),
      graphEngine: context.container.get<IGraphEngine>(ServiceTypes.GraphEngine),
    }),
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
    () => new ObsidianServiceAdapter(),
  );

  bindSingleton<IMCPGateway>(
    ServiceTypes.MCPGateway,
    () => new MCPGatewayAdapter(),
  );
}
