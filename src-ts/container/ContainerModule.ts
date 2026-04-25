/**
 * ContainerModule - InversifyJS Bindings Configuration
 *
 * Defines service bindings for dependency injection container
 */

import { ContainerModule as InversifyContainerModule, interfaces } from 'inversify';
import { createHash } from 'node:crypto';
import {
  ServiceTypes,
  IMemoryEngine,
  IGraphEngine,
  ISearchEngine,
  IWorkflowEngine,
  ICriticEngine,
  IAgentFactory,
  IBackupManager,
  ITokenService,
  IObsidianService,
  IMCPGateway,
  IDistillationService,
  ILLMService,
  IEmbeddingService,
  IKnowledgeService,
  ISmartSearch,
  IHybridSearch,
  IVectorSearch,
} from './types';
import {
  DistillationService,
  LLMServiceImpl,
  EmbeddingServiceImpl,
  KnowledgeServiceImpl,
} from '../services';
import {
  SmartSearch,
  HybridSearch,
  VectorSearch,
} from '../search';
import type { EmbeddingService as VectorEmbeddingService } from '../protocols/embedding';
import { createIntegrationAdapters } from '../integrations';
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

const integrationAdapters = createIntegrationAdapters();

function createLocalVectorEmbeddingService(dimension: number): VectorEmbeddingService {
  const normalize = (text: string): number[] => {
    const values = new Array<number>(dimension).fill(0);
    for (let i = 0; i < dimension; i += 1) {
      const hash = createHash('sha256').update(`${text}:${i}`).digest();
      values[i] = hash.readUInt32LE(0) / 0xffffffff;
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
      for (let i = 0; i < embedding1.length; i += 1) {
        dotProduct += embedding1[i] * embedding2[i];
        normA += embedding1[i] * embedding1[i];
        normB += embedding2[i] * embedding2[i];
      }
      if (normA === 0 || normB === 0) return 0;
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    },
    getDimensions(): number {
      return dimension;
    },
  };
}

/**
 * Create service instances with default configurations
 * These factory functions provide minimal configuration for services
 */
function createDistillationService(): IDistillationService {
  return new DistillationService();
}

function createLLMService(): ILLMService {
  // Create LLMService with empty providers map (will be configured later)
  return new LLMServiceImpl(new Map(), {});
}

function createEmbeddingService(): IEmbeddingService {
  // Create EmbeddingService with empty providers map (will be configured later)
  return new EmbeddingServiceImpl(new Map(), {});
}

function createKnowledgeService(): IKnowledgeService {
  // Create KnowledgeService with default configuration
  return new KnowledgeServiceImpl({
    dbPath: '.writing/knowledge.db',
    enableDistillation: true,
    memoryEngine: new MemoryEngineAdapter({
      flags: integrationAdapters.flags,
      storageShadow: integrationAdapters.storageShadow,
    }),
    graphEngine: new GraphEngineAdapter(),
  });
}

function createSmartSearch(): ISmartSearch {
  // Create SmartSearch with default configuration
  return new SmartSearch({});
}

function createHybridSearch(): IHybridSearch {
  // Create HybridSearch with default configuration
  return new HybridSearch({
    strategies: [],
    rrfK: 60,
    defaultTopK: 10,
    parallelExecution: true,
  });
}

function createVectorSearch(): IVectorSearch {
  const dimension = 384;
  return new VectorSearch({
    dbPath: '.writing/vectors.db',
    dimension,
    modelName: 'BAAI/bge-small-en-v1.5',
    embeddingService: createLocalVectorEmbeddingService(dimension),
  });
}

/**
 * Container Module for Service Registration
 *
 * All migrated services are registered with lazy initialization support.
 * Services are created on first access and cached as singletons.
 */
export const ContainerModule = new InversifyContainerModule((bind) => {
  // ============ Migrated Services (TypeScript) ============

  // Distillation Service
  bind<IDistillationService>(ServiceTypes.DistillationService)
    .toDynamicValue(() => createDistillationService())
    .inSingletonScope();

  // LLM Service
  bind<ILLMService>(ServiceTypes.LLMService)
    .toDynamicValue(() => createLLMService())
    .inSingletonScope();

  // Embedding Service
  bind<IEmbeddingService>(ServiceTypes.EmbeddingService)
    .toDynamicValue(() => createEmbeddingService())
    .inSingletonScope();

  // Knowledge Service
  bind<IKnowledgeService>(ServiceTypes.KnowledgeService)
    .toDynamicValue(() => createKnowledgeService())
    .inSingletonScope();

  // Smart Search
  bind<ISmartSearch>(ServiceTypes.SmartSearch)
    .toDynamicValue(() => createSmartSearch())
    .inSingletonScope();

  // Hybrid Search
  bind<IHybridSearch>(ServiceTypes.HybridSearch)
    .toDynamicValue(() => createHybridSearch())
    .inSingletonScope();

  // Vector Search
  bind<IVectorSearch>(ServiceTypes.VectorSearch)
    .toDynamicValue(() => createVectorSearch())
    .inSingletonScope();

  // Memory Engine Binding
  bind<IMemoryEngine>(ServiceTypes.MemoryEngine)
    .toDynamicValue(() => new MemoryEngineAdapter({
      flags: integrationAdapters.flags,
      storageShadow: integrationAdapters.storageShadow,
    }))
    .inSingletonScope();

  // Graph Engine Binding
  bind<IGraphEngine>(ServiceTypes.GraphEngine)
    .toDynamicValue(() => new GraphEngineAdapter())
    .inSingletonScope();

  // Search Engine Binding
  bind<ISearchEngine>(ServiceTypes.SearchEngine)
    .toDynamicValue(() => new SearchEngineAdapter(undefined, integrationAdapters))
    .inSingletonScope();

  // Workflow Engine Binding
  bind<IWorkflowEngine>(ServiceTypes.WorkflowEngine)
    .toDynamicValue(() => new WorkflowEngineAdapter())
    .inSingletonScope();

  // Critic Engine Binding
  bind<ICriticEngine>(ServiceTypes.CriticEngine)
    .toDynamicValue(() => new CriticEngineAdapter())
    .inSingletonScope();

  // Agent Factory Binding
  bind<IAgentFactory>(ServiceTypes.AgentFactory)
    .toDynamicValue(() => new AgentFactoryAdapter())
    .inSingletonScope();

  // Backup Manager Binding
  bind<IBackupManager>(ServiceTypes.BackupManager)
    .toDynamicValue(() => new BackupManagerAdapter())
    .inSingletonScope();

  // Token Service Binding
  bind<ITokenService>(ServiceTypes.TokenService)
    .toDynamicValue(() => new TokenServiceAdapter())
    .inSingletonScope();

  // Obsidian Service Binding
  bind<IObsidianService>(ServiceTypes.ObsidianService)
    .toDynamicValue(() => new ObsidianServiceAdapter())
    .inSingletonScope();

  // MCP Gateway Binding
  bind<IMCPGateway>(ServiceTypes.MCPGateway)
    .toDynamicValue(() => new MCPGatewayAdapter())
    .inSingletonScope();
});

/**
 * Service Binding Helper Functions
 *
 * These functions allow consumers to override the default adapter bindings
 * with custom implementations (e.g., for testing or specialized configurations).
 */

export function bindMemoryEngine(bind: interfaces.Bind, implementation: new () => IMemoryEngine): void {
  bind<IMemoryEngine>(ServiceTypes.MemoryEngine)
    .to(implementation)
    .inSingletonScope();
}

export function bindGraphEngine(bind: interfaces.Bind, implementation: new () => IGraphEngine): void {
  bind<IGraphEngine>(ServiceTypes.GraphEngine)
    .to(implementation)
    .inSingletonScope();
}

export function bindSearchEngine(bind: interfaces.Bind, implementation: new () => ISearchEngine): void {
  bind<ISearchEngine>(ServiceTypes.SearchEngine)
    .to(implementation)
    .inSingletonScope();
}

export function bindWorkflowEngine(bind: interfaces.Bind, implementation: new () => IWorkflowEngine): void {
  bind<IWorkflowEngine>(ServiceTypes.WorkflowEngine)
    .to(implementation)
    .inSingletonScope();
}

export function bindCriticEngine(bind: interfaces.Bind, implementation: new () => ICriticEngine): void {
  bind<ICriticEngine>(ServiceTypes.CriticEngine)
    .to(implementation)
    .inSingletonScope();
}

export function bindAgentFactory(bind: interfaces.Bind, implementation: new () => IAgentFactory): void {
  bind<IAgentFactory>(ServiceTypes.AgentFactory)
    .to(implementation)
    .inSingletonScope();
}

export function bindBackupManager(bind: interfaces.Bind, implementation: new () => IBackupManager): void {
  bind<IBackupManager>(ServiceTypes.BackupManager)
    .to(implementation)
    .inSingletonScope();
}

export function bindTokenService(bind: interfaces.Bind, implementation: new () => ITokenService): void {
  bind<ITokenService>(ServiceTypes.TokenService)
    .to(implementation)
    .inSingletonScope();
}

export function bindObsidianService(bind: interfaces.Bind, implementation: new () => IObsidianService): void {
  bind<IObsidianService>(ServiceTypes.ObsidianService)
    .to(implementation)
    .inSingletonScope();
}

export function bindMCPGateway(bind: interfaces.Bind, implementation: new () => IMCPGateway): void {
  bind<IMCPGateway>(ServiceTypes.MCPGateway)
    .to(implementation)
    .inSingletonScope();
}
