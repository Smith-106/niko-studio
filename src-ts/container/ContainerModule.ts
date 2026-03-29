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
} from './types';

/**
 * Container Module for Service Registration
 * 
 * This module will be updated as services are migrated from Python to TypeScript.
 * Each service binding uses toDynamicValue for lazy initialization.
 */
export const ContainerModule = new InversifyContainerModule((bind) => {
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
