/**
 * ContainerModule - InversifyJS Bindings Configuration
 *
 * Defines service bindings for dependency injection container
 */

import { ContainerModule as InversifyContainerModule, interfaces } from 'inversify';
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
  // Create VectorSearch with default configuration
  // Note: Requires embedding service in production
  return new VectorSearch({
    dbPath: '.writing/vectors.db',
    dimension: 384,
    modelName: 'BAAI/bge-small-en-v1.5',
    embeddingService: null as any, // Will be injected later
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

  // ============ Placeholder Services (To Be Migrated) ============

  // Memory Engine Binding
  // Will be implemented when MemoryEngine is migrated from Python
  // bind<IMemoryEngine>(ServiceTypes.MemoryEngine)
  //   .toDynamicValue(() => new MemoryEngine())
  //   .inSingletonScope();

  // Graph Engine Binding
  // Will be implemented when GraphEngine is migrated from Python
  // bind<IGraphEngine>(ServiceTypes.GraphEngine)
  //   .toDynamicValue(() => new GraphEngine())
  //   .inSingletonScope();

  // Search Engine Binding
  // Will be implemented when SearchEngine is migrated from Python
  // bind<ISearchEngine>(ServiceTypes.SearchEngine)
  //   .toDynamicValue(() => new IterativeRetriever())
  //   .inSingletonScope();

  // Workflow Engine Binding
  // Will be implemented when WorkflowEngine is migrated from Python
  // bind<IWorkflowEngine>(ServiceTypes.WorkflowEngine)
  //   .toDynamicValue(() => new WorkflowEngine())
  //   .inSingletonScope();

  // Critic Engine Binding
  // Will be implemented when CriticEngine is migrated from Python
  // bind<ICriticEngine>(ServiceTypes.CriticEngine)
  //   .toDynamicValue(() => new CriticEngine())
  //   .inSingletonScope();

  // Agent Factory Binding
  // Will be implemented when AgentFactory is migrated from Python
  // bind<IAgentFactory>(ServiceTypes.AgentFactory)
  //   .toDynamicValue(() => new AgentFactory())
  //   .inSingletonScope();

  // Backup Manager Binding
  // Will be implemented when BackupManager is migrated from Python
  // bind<IBackupManager>(ServiceTypes.BackupManager)
  //   .toDynamicValue(() => new BackupManager())
  //   .inSingletonScope();

  // Token Service Binding
  // Will be implemented when TokenService is migrated from Python
  // bind<ITokenService>(ServiceTypes.TokenService)
  //   .toDynamicValue(() => new TokenService())
  //   .inSingletonScope();

  // Obsidian Service Binding
  // Will be implemented when ObsidianService is migrated from Python
  // bind<IObsidianService>(ServiceTypes.ObsidianService)
  //   .toDynamicValue(() => new ObsidianService())
  //   .inSingletonScope();

  // MCP Gateway Binding
  // Will be implemented when MCPGateway is migrated from Python
  // bind<IMCPGateway>(ServiceTypes.MCPGateway)
  //   .toDynamicValue(() => new MCPGateway())
  //   .inSingletonScope();
});

/**
 * Service Binding Helper Functions
 * 
 * These functions will be used when actual implementations are available
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
