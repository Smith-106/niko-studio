/**
 * ServiceContainer - TypeScript Dependency Injection Container
 * 
 * Migrated from Python ServiceContainer (src/container.py)
 * Uses InversifyJS for dependency injection with lazy initialization pattern
 */

import 'reflect-metadata';
import { Container, injectable } from 'inversify';
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
  AgentType,
  IAgent,
} from './types';

/**
 * ServiceContainer - Lightweight DI Container with Lazy Initialization
 * 
 * This container manages service lifecycle with:
 * - Lazy initialization (services created on first access)
 * - Singleton pattern (same instance reused)
 * - Mock injection for testing
 * - Async initialization support
 */
export class ServiceContainer {
  private container: Container;
  private mocks: Map<symbol, unknown> = new Map();
  private initialized: boolean = false;
  private initPromises: Map<symbol, Promise<void>> = new Map();

  constructor() {
    this.container = new Container();
    this.registerServices();
  }

  /**
   * Register all services with InversifyJS container
   * Uses toDynamicValue for lazy initialization
   */
  private registerServices(): void {
    // Memory Engine
    this.container.bind<IMemoryEngine>(ServiceTypes.MemoryEngine).toDynamicValue(() => {
      return this.createMemoryEngine();
    }).inSingletonScope();

    // Graph Engine
    this.container.bind<IGraphEngine>(ServiceTypes.GraphEngine).toDynamicValue(() => {
      return this.createGraphEngine();
    }).inSingletonScope();

    // Search Engine
    this.container.bind<ISearchEngine>(ServiceTypes.SearchEngine).toDynamicValue(() => {
      return this.createSearchEngine();
    }).inSingletonScope();

    // Workflow Engine
    this.container.bind<IWorkflowEngine>(ServiceTypes.WorkflowEngine).toDynamicValue(() => {
      return this.createWorkflowEngine();
    }).inSingletonScope();

    // Critic Engine
    this.container.bind<ICriticEngine>(ServiceTypes.CriticEngine).toDynamicValue(() => {
      return this.createCriticEngine();
    }).inSingletonScope();

    // Agent Factory
    this.container.bind<IAgentFactory>(ServiceTypes.AgentFactory).toDynamicValue(() => {
      return this.createAgentFactory();
    }).inSingletonScope();

    // Backup Manager
    this.container.bind<IBackupManager>(ServiceTypes.BackupManager).toDynamicValue(() => {
      return this.createBackupManager();
    }).inSingletonScope();

    // Token Service
    this.container.bind<ITokenService>(ServiceTypes.TokenService).toDynamicValue(() => {
      return this.createTokenService();
    }).inSingletonScope();

    // Obsidian Service
    this.container.bind<IObsidianService>(ServiceTypes.ObsidianService).toDynamicValue(() => {
      return this.createObsidianService();
    }).inSingletonScope();

    // MCP Gateway
    this.container.bind<IMCPGateway>(ServiceTypes.MCPGateway).toDynamicValue(() => {
      return this.createMCPGateway();
    }).inSingletonScope();
  }

  // ============ Mock Registration ============

  /**
   * Register a mock service for testing
   * @param serviceIdentifier - Service identifier symbol
   * @param mock - Mock implementation
   */
  registerMock<T>(serviceIdentifier: symbol, mock: T): void {
    this.mocks.set(serviceIdentifier, mock);
  }

  /**
   * Clear all mocks (for testing)
   */
  clearMocks(): void {
    this.mocks.clear();
  }

  // ============ Service Getters with Lazy Initialization ============

  /**
   * Get Memory Engine (lazy loaded)
   */
  get memory(): IMemoryEngine {
    if (this.mocks.has(ServiceTypes.MemoryEngine)) {
      return this.mocks.get(ServiceTypes.MemoryEngine) as IMemoryEngine;
    }
    return this.container.get<IMemoryEngine>(ServiceTypes.MemoryEngine);
  }

  /**
   * Get Graph Engine (lazy loaded)
   */
  get graph(): IGraphEngine {
    if (this.mocks.has(ServiceTypes.GraphEngine)) {
      return this.mocks.get(ServiceTypes.GraphEngine) as IGraphEngine;
    }
    return this.container.get<IGraphEngine>(ServiceTypes.GraphEngine);
  }

  /**
   * Get Search Engine (lazy loaded)
   */
  get search(): ISearchEngine {
    if (this.mocks.has(ServiceTypes.SearchEngine)) {
      return this.mocks.get(ServiceTypes.SearchEngine) as ISearchEngine;
    }
    return this.container.get<ISearchEngine>(ServiceTypes.SearchEngine);
  }

  /**
   * Get Workflow Engine (lazy loaded)
   */
  get workflow(): IWorkflowEngine {
    if (this.mocks.has(ServiceTypes.WorkflowEngine)) {
      return this.mocks.get(ServiceTypes.WorkflowEngine) as IWorkflowEngine;
    }
    return this.container.get<IWorkflowEngine>(ServiceTypes.WorkflowEngine);
  }

  /**
   * Get Critic Engine (lazy loaded)
   */
  get critic(): ICriticEngine {
    if (this.mocks.has(ServiceTypes.CriticEngine)) {
      return this.mocks.get(ServiceTypes.CriticEngine) as ICriticEngine;
    }
    return this.container.get<ICriticEngine>(ServiceTypes.CriticEngine);
  }

  /**
   * Get Agent Factory (lazy loaded)
   */
  get agentFactory(): IAgentFactory {
    if (this.mocks.has(ServiceTypes.AgentFactory)) {
      return this.mocks.get(ServiceTypes.AgentFactory) as IAgentFactory;
    }
    return this.container.get<IAgentFactory>(ServiceTypes.AgentFactory);
  }

  /**
   * Get Backup Manager (lazy loaded)
   */
  get backup(): IBackupManager {
    if (this.mocks.has(ServiceTypes.BackupManager)) {
      return this.mocks.get(ServiceTypes.BackupManager) as IBackupManager;
    }
    return this.container.get<IBackupManager>(ServiceTypes.BackupManager);
  }

  /**
   * Get Token Service (lazy loaded)
   */
  get token(): ITokenService {
    if (this.mocks.has(ServiceTypes.TokenService)) {
      return this.mocks.get(ServiceTypes.TokenService) as ITokenService;
    }
    return this.container.get<ITokenService>(ServiceTypes.TokenService);
  }

  /**
   * Get Obsidian Service (lazy loaded)
   */
  get obsidian(): IObsidianService {
    if (this.mocks.has(ServiceTypes.ObsidianService)) {
      return this.mocks.get(ServiceTypes.ObsidianService) as IObsidianService;
    }
    return this.container.get<IObsidianService>(ServiceTypes.ObsidianService);
  }

  /**
   * Get MCP Gateway (lazy loaded)
   */
  get mcpGateway(): IMCPGateway {
    if (this.mocks.has(ServiceTypes.MCPGateway)) {
      return this.mocks.get(ServiceTypes.MCPGateway) as IMCPGateway;
    }
    return this.container.get<IMCPGateway>(ServiceTypes.MCPGateway);
  }

  // ============ Agent Shortcut Methods ============

  /**
   * Get agent instance via factory (lazy loaded with caching)
   */
  getAgent(
    agentType: AgentType,
    name?: string,
    config?: Record<string, unknown>,
    llm?: unknown
  ): IAgent {
    return this.agentFactory.getAgent(agentType, name, config, llm);
  }

  /**
   * Register mock agent for testing
   */
  registerMockAgent(agentType: AgentType, mock: IAgent): void {
    this.agentFactory.registerMock(agentType, mock);
  }

  // ============ Lifecycle Management ============

  /**
   * Check if engines have been pre-warmed
   */
  get enginesInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Wait for specified engines to complete initialization
   * @param serviceIdentifiers - Service identifiers to wait for
   * @param timeout - Maximum wait time in milliseconds
   */
  async ensureInitialized(
    serviceIdentifiers: symbol[],
    timeout: number = 30000
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const identifier of serviceIdentifiers) {
      const initPromise = this.initPromises.get(identifier);
      if (initPromise) {
        promises.push(initPromise);
      }
    }

    if (promises.length > 0) {
      try {
        await Promise.race([
          Promise.all(promises),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Initialization timeout')), timeout)
          ),
        ]);
      } catch (error) {
        console.error('Engine initialization timed out or failed:', error);
        throw error;
      }
    }
  }

  /**
   * Pre-warm critical engines (parallel initialization)
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Pre-warming engines...');
    const startTime = Date.now();

    // Trigger lazy loading for all services
    const services = [
      { identifier: ServiceTypes.MemoryEngine, instance: () => this.memory },
      { identifier: ServiceTypes.GraphEngine, instance: () => this.graph },
      { identifier: ServiceTypes.CriticEngine, instance: () => this.critic },
      { identifier: ServiceTypes.SearchEngine, instance: () => this.search },
      { identifier: ServiceTypes.WorkflowEngine, instance: () => this.workflow },
    ];

    // Create initialization promises
    for (const service of services) {
      try {
        const instance = service.instance();
        if ('initialize' in instance && typeof instance.initialize === 'function') {
          const initPromise = instance.initialize();
          this.initPromises.set(service.identifier, initPromise);
        }
      } catch (error) {
        console.error(`Failed to initialize service ${String(service.identifier)}:`, error);
      }
    }

    // Wait for all initialization promises
    if (this.initPromises.size > 0) {
      await this.ensureInitialized(Array.from(this.initPromises.keys()), 60000);
    }

    this.initialized = true;
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`Engines pre-warmed in ${elapsed.toFixed(2)}s`);
  }

  /**
   * Reset container state (for testing)
   */
  reset(): void {
    this.mocks.clear();
    this.initPromises.clear();
    this.initialized = false;
  }

  // ============ Service Factories (Placeholder Implementations) ============
  // These will be replaced with actual implementations as services are migrated

  private createMemoryEngine(): IMemoryEngine {
    // Placeholder - will be implemented when MemoryEngine is migrated
    throw new Error('MemoryEngine implementation not yet migrated to TypeScript');
  }

  private createGraphEngine(): IGraphEngine {
    // Placeholder - will be implemented when GraphEngine is migrated
    throw new Error('GraphEngine implementation not yet migrated to TypeScript');
  }

  private createSearchEngine(): ISearchEngine {
    // Placeholder - will be implemented when SearchEngine is migrated
    throw new Error('SearchEngine implementation not yet migrated to TypeScript');
  }

  private createWorkflowEngine(): IWorkflowEngine {
    // Placeholder - will be implemented when WorkflowEngine is migrated
    throw new Error('WorkflowEngine implementation not yet migrated to TypeScript');
  }

  private createCriticEngine(): ICriticEngine {
    // Placeholder - will be implemented when CriticEngine is migrated
    throw new Error('CriticEngine implementation not yet migrated to TypeScript');
  }

  private createAgentFactory(): IAgentFactory {
    // Placeholder - will be implemented when AgentFactory is migrated
    throw new Error('AgentFactory implementation not yet migrated to TypeScript');
  }

  private createBackupManager(): IBackupManager {
    // Placeholder - will be implemented when BackupManager is migrated
    throw new Error('BackupManager implementation not yet migrated to TypeScript');
  }

  private createTokenService(): ITokenService {
    // Placeholder - will be implemented when TokenService is migrated
    throw new Error('TokenService implementation not yet migrated to TypeScript');
  }

  private createObsidianService(): IObsidianService {
    // Placeholder - will be implemented when ObsidianService is migrated
    throw new Error('ObsidianService implementation not yet migrated to TypeScript');
  }

  private createMCPGateway(): IMCPGateway {
    // Placeholder - will be implemented when MCPGateway is migrated
    throw new Error('MCPGateway implementation not yet migrated to TypeScript');
  }
}

// Singleton container instance
let containerInstance: ServiceContainer | null = null;

/**
 * Get the global container instance
 */
export function getContainer(): ServiceContainer {
  if (!containerInstance) {
    containerInstance = new ServiceContainer();
  }
  return containerInstance;
}

/**
 * Reset the global container (for testing)
 */
export function resetContainer(): void {
  if (containerInstance) {
    containerInstance.reset();
  }
  containerInstance = null;
}
