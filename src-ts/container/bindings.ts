import { createHash } from 'node:crypto';
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
  LLMServiceImpl,
  KnowledgeServiceImpl,
} from '../services';
import {
  SmartSearch,
  HybridSearch,
  VectorSearch,
} from '../search';
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
import type { EmbeddingService as VectorEmbeddingService } from '../protocols/embedding';

export type CanonicalServiceIdentifier = (typeof ServiceTypes)[keyof typeof ServiceTypes];

export const CANONICAL_SERVICE_IDENTIFIERS = Object.values(ServiceTypes) as CanonicalServiceIdentifier[];

export interface BindingRegistryOptions {
  integrationAdapters?: IntegrationAdapterBundle;
}

const DEFAULT_VECTOR_DIMENSION = 384;
const DEFAULT_VECTOR_MODEL = 'BAAI/bge-small-en-v1.5';

function createLocalEmbeddingService(
  dimension: number = DEFAULT_VECTOR_DIMENSION,
): IEmbeddingService & VectorEmbeddingService {
  const normalize = (text: string): number[] => {
    const values = new Array<number>(dimension).fill(0);
    for (let index = 0; index < dimension; index += 1) {
      const hash = createHash('sha256').update(`${text}:${index}`).digest();
      values[index] = hash.readUInt32LE(0) / 0xffffffff;
    }
    return values;
  };

  return {
    async embed(text: string): Promise<number[]> {
      return normalize(text);
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return texts.map((text) => normalize(text));
    },
    async embedWithMetadata(request: { text: string; model?: string }): Promise<{ embedding: number[]; metadata: Record<string, unknown> }> {
      const embedding = normalize(request.text);
      return {
        embedding,
        metadata: {
          model: request.model ?? 'local-vector-fallback',
          dimensions: dimension,
          provider: 'local',
        },
      };
    },
    similarity(embedding1: number[], embedding2: number[]): number {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let index = 0; index < embedding1.length; index += 1) {
        dotProduct += embedding1[index] * embedding2[index];
        normA += embedding1[index] * embedding1[index];
        normB += embedding2[index] * embedding2[index];
      }

      if (normA === 0 || normB === 0) {
        return 0;
      }

      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },
    getDimensions(): number {
      return dimension;
    },
  };
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
    () => createLocalEmbeddingService(),
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
