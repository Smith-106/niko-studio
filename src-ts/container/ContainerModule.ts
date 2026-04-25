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
import { registerCanonicalBindings } from './bindings';

/**
 * Container Module for Service Registration
 *
 * All migrated services are registered with lazy initialization support.
 * Services are created on first access and cached as singletons.
 */
export const ContainerModule = new InversifyContainerModule((bind) => {
  registerCanonicalBindings(bind);
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
