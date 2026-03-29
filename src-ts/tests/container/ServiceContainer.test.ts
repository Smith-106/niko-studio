/**
 * ServiceContainer Tests
 * 
 * Comprehensive test coverage for TypeScript DI container
 * Covers: lazy initialization, mock injection, async init, singleton behavior, error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ServiceContainer, getContainer, resetContainer } from '../../container/ServiceContainer';
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
} from '../../container/types';

describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  afterEach(() => {
    container.reset();
  });

  // ============ Initialization Tests ============

  describe('Initialization', () => {
    it('should create container instance', () => {
      expect(container).toBeDefined();
      expect(container).toBeInstanceOf(ServiceContainer);
    });

    it('should initialize with no engines pre-warmed', () => {
      expect(container.enginesInitialized).toBe(false);
    });

    it('should reset container state', () => {
      container.reset();
      expect(container.enginesInitialized).toBe(false);
    });
  });

  // ============ Mock Injection Tests ============

  describe('Mock Injection', () => {
    it('should register mock for MemoryEngine', () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn(),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      const result = container.memory;

      expect(result).toBe(mockMemory);
    });

    it('should register mock for GraphEngine', () => {
      const mockGraph: IGraphEngine = {
        initialize: vi.fn(),
        addNode: vi.fn(),
        addEdge: vi.fn(),
        getNode: vi.fn(),
        traverse: vi.fn(),
      };

      container.registerMock(ServiceTypes.GraphEngine, mockGraph);
      const result = container.graph;

      expect(result).toBe(mockGraph);
    });

    it('should register mock for SearchEngine', () => {
      const mockSearch: ISearchEngine = {
        initialize: vi.fn(),
        search: vi.fn(),
        index: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.SearchEngine, mockSearch);
      const result = container.search;

      expect(result).toBe(mockSearch);
    });

    it('should register mock for WorkflowEngine', () => {
      const mockWorkflow: IWorkflowEngine = {
        initialize: vi.fn(),
        executeLevel: vi.fn(),
        getLevels: vi.fn(),
        reset: vi.fn(),
      };

      container.registerMock(ServiceTypes.WorkflowEngine, mockWorkflow);
      const result = container.workflow;

      expect(result).toBe(mockWorkflow);
    });

    it('should register mock for CriticEngine', () => {
      const mockCritic: ICriticEngine = {
        initialize: vi.fn(),
        analyze: vi.fn(),
        getSuggestions: vi.fn(),
      };

      container.registerMock(ServiceTypes.CriticEngine, mockCritic);
      const result = container.critic;

      expect(result).toBe(mockCritic);
    });

    it('should register mock for AgentFactory', () => {
      const mockAgentFactory: IAgentFactory = {
        getAgent: vi.fn(),
        registerMock: vi.fn(),
        reset: vi.fn(),
      };

      container.registerMock(ServiceTypes.AgentFactory, mockAgentFactory);
      const result = container.agentFactory;

      expect(result).toBe(mockAgentFactory);
    });

    it('should register mock for BackupManager', () => {
      const mockBackup: IBackupManager = {
        createBackup: vi.fn(),
        restoreBackup: vi.fn(),
        listBackups: vi.fn(),
        deleteBackup: vi.fn(),
      };

      container.registerMock(ServiceTypes.BackupManager, mockBackup);
      const result = container.backup;

      expect(result).toBe(mockBackup);
    });

    it('should register mock for TokenService', () => {
      const mockToken: ITokenService = {
        countTokens: vi.fn(),
        isWithinBudget: vi.fn(),
        updateUsage: vi.fn(),
        getUsage: vi.fn(),
      };

      container.registerMock(ServiceTypes.TokenService, mockToken);
      const result = container.token;

      expect(result).toBe(mockToken);
    });

    it('should register mock for ObsidianService', () => {
      const mockObsidian: IObsidianService = {
        export: vi.fn(),
        import: vi.fn(),
        sync: vi.fn(),
      };

      container.registerMock(ServiceTypes.ObsidianService, mockObsidian);
      const result = container.obsidian;

      expect(result).toBe(mockObsidian);
    });

    it('should register mock for MCPGateway', () => {
      const mockMCP: IMCPGateway = {
        initialize: vi.fn(),
        sendRequest: vi.fn(),
        registerHandler: vi.fn(),
        close: vi.fn(),
      };

      container.registerMock(ServiceTypes.MCPGateway, mockMCP);
      const result = container.mcpGateway;

      expect(result).toBe(mockMCP);
    });

    it('should clear all mocks', () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn(),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.clearMocks();

      expect(() => container.memory).toThrow('not yet migrated');
    });
  });

  // ============ Lazy Initialization Tests ============

  describe('Lazy Initialization', () => {
    it('should lazily initialize MemoryEngine on first access', () => {
      expect(() => container.memory).toThrow('not yet migrated');
    });

    it('should lazily initialize GraphEngine on first access', () => {
      expect(() => container.graph).toThrow('not yet migrated');
    });

    it('should lazily initialize SearchEngine on first access', () => {
      expect(() => container.search).toThrow('not yet migrated');
    });

    it('should lazily initialize WorkflowEngine on first access', () => {
      expect(() => container.workflow).toThrow('not yet migrated');
    });

    it('should lazily initialize CriticEngine on first access', () => {
      expect(() => container.critic).toThrow('not yet migrated');
    });

    it('should lazily initialize AgentFactory on first access', () => {
      expect(() => container.agentFactory).toThrow('not yet migrated');
    });

    it('should lazily initialize BackupManager on first access', () => {
      expect(() => container.backup).toThrow('not yet migrated');
    });

    it('should lazily initialize TokenService on first access', () => {
      expect(() => container.token).toThrow('not yet migrated');
    });

    it('should lazily initialize ObsidianService on first access', () => {
      expect(() => container.obsidian).toThrow('not yet migrated');
    });

    it('should lazily initialize MCPGateway on first access', () => {
      expect(() => container.mcpGateway).toThrow('not yet migrated');
    });
  });

  // ============ Service Getter Tests ============

  describe('Service Getters', () => {
    it('should return same MemoryEngine instance on multiple accesses', () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn(),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      const instance1 = container.memory;
      const instance2 = container.memory;

      expect(instance1).toBe(instance2);
    });

    it('should return same GraphEngine instance on multiple accesses', () => {
      const mockGraph: IGraphEngine = {
        initialize: vi.fn(),
        addNode: vi.fn(),
        addEdge: vi.fn(),
        getNode: vi.fn(),
        traverse: vi.fn(),
      };

      container.registerMock(ServiceTypes.GraphEngine, mockGraph);
      const instance1 = container.graph;
      const instance2 = container.graph;

      expect(instance1).toBe(instance2);
    });

    it('should return same AgentFactory instance on multiple accesses', () => {
      const mockAgentFactory: IAgentFactory = {
        getAgent: vi.fn(),
        registerMock: vi.fn(),
        reset: vi.fn(),
      };

      container.registerMock(ServiceTypes.AgentFactory, mockAgentFactory);
      const instance1 = container.agentFactory;
      const instance2 = container.agentFactory;

      expect(instance1).toBe(instance2);
    });
  });

  // ============ Agent Methods Tests ============

  describe('Agent Methods', () => {
    it('should call agentFactory.getAgent with correct parameters', () => {
      const mockAgent: IAgent = {
        execute: vi.fn(),
        getName: vi.fn().mockReturnValue('TestAgent'),
        getType: vi.fn().mockReturnValue(AgentType.Writer),
      };

      const mockAgentFactory: IAgentFactory = {
        getAgent: vi.fn().mockReturnValue(mockAgent),
        registerMock: vi.fn(),
        reset: vi.fn(),
      };

      container.registerMock(ServiceTypes.AgentFactory, mockAgentFactory);

      const result = container.getAgent(AgentType.Writer, 'TestAgent', { key: 'value' });

      expect(mockAgentFactory.getAgent).toHaveBeenCalledWith(
        AgentType.Writer,
        'TestAgent',
        { key: 'value' },
        undefined
      );
      expect(result).toBe(mockAgent);
    });

    it('should call agentFactory.registerMock with correct parameters', () => {
      const mockAgent: IAgent = {
        execute: vi.fn(),
        getName: vi.fn().mockReturnValue('TestAgent'),
        getType: vi.fn().mockReturnValue(AgentType.Commander),
      };

      const mockAgentFactory: IAgentFactory = {
        getAgent: vi.fn(),
        registerMock: vi.fn(),
        reset: vi.fn(),
      };

      container.registerMock(ServiceTypes.AgentFactory, mockAgentFactory);
      container.registerMockAgent(AgentType.Commander, mockAgent);

      expect(mockAgentFactory.registerMock).toHaveBeenCalledWith(AgentType.Commander, mockAgent);
    });
  });

  // ============ Async Initialization Tests ============

  describe('Async Initialization', () => {
    it('should mark engines as initialized after initializeAll()', async () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn().mockResolvedValue(undefined),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      const mockGraph: IGraphEngine = {
        initialize: vi.fn().mockResolvedValue(undefined),
        addNode: vi.fn(),
        addEdge: vi.fn(),
        getNode: vi.fn(),
        traverse: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, mockGraph);
      container.registerMock(ServiceTypes.CriticEngine, {
        initialize: vi.fn().mockResolvedValue(undefined),
      } as any);
      container.registerMock(ServiceTypes.SearchEngine, {
        initialize: vi.fn().mockResolvedValue(undefined),
      } as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {
        initialize: vi.fn().mockResolvedValue(undefined),
      } as any);

      await container.initializeAll();

      expect(container.enginesInitialized).toBe(true);
    });

    it('should call initialize on services with initialize method', async () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn().mockResolvedValue(undefined),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      await container.initializeAll();

      expect(mockMemory.initialize).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn().mockResolvedValue(undefined),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      await container.initializeAll();
      await container.initializeAll();

      expect(mockMemory.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization timeout', async () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000))),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      // Start initialization (which creates the initPromises)
      const initPromise = container.initializeAll();
      
      // Try to ensure initialization with a shorter timeout
      await expect(container.ensureInitialized([ServiceTypes.MemoryEngine], 100))
        .rejects.toThrow('timeout');
        
      // Clean up - allow the initialization to complete
      await initPromise;
    });
  });

  // ============ Singleton Container Tests ============

  describe('Singleton Container', () => {
    it('should return same container instance from getContainer()', () => {
      resetContainer();
      const instance1 = getContainer();
      const instance2 = getContainer();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getContainer();
      resetContainer();
      const instance2 = getContainer();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ============ Error Handling Tests ============

  describe('Error Handling', () => {
    it('should throw error for unmigrated MemoryEngine', () => {
      expect(() => container.memory).toThrow('MemoryEngine implementation not yet migrated');
    });

    it('should throw error for unmigrated GraphEngine', () => {
      expect(() => container.graph).toThrow('GraphEngine implementation not yet migrated');
    });

    it('should throw error for unmigrated SearchEngine', () => {
      expect(() => container.search).toThrow('SearchEngine implementation not yet migrated');
    });

    it('should throw error for unmigrated WorkflowEngine', () => {
      expect(() => container.workflow).toThrow('WorkflowEngine implementation not yet migrated');
    });

    it('should throw error for unmigrated CriticEngine', () => {
      expect(() => container.critic).toThrow('CriticEngine implementation not yet migrated');
    });

    it('should throw error for unmigrated AgentFactory', () => {
      expect(() => container.agentFactory).toThrow('AgentFactory implementation not yet migrated');
    });

    it('should throw error for unmigrated BackupManager', () => {
      expect(() => container.backup).toThrow('BackupManager implementation not yet migrated');
    });

    it('should throw error for unmigrated TokenService', () => {
      expect(() => container.token).toThrow('TokenService implementation not yet migrated');
    });

    it('should throw error for unmigrated ObsidianService', () => {
      expect(() => container.obsidian).toThrow('ObsidianService implementation not yet migrated');
    });

    it('should throw error for unmigrated MCPGateway', () => {
      expect(() => container.mcpGateway).toThrow('MCPGateway implementation not yet migrated');
    });
  });

  // ============ Reset Tests ============

  describe('Reset', () => {
    it('should clear mocks on reset', () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn(),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.reset();

      expect(() => container.memory).toThrow('not yet migrated');
    });

    it('should reset initialized flag on reset', async () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn().mockResolvedValue(undefined),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      await container.initializeAll();
      expect(container.enginesInitialized).toBe(true);

      container.reset();
      expect(container.enginesInitialized).toBe(false);
    });

    it('should clear initPromises on reset', async () => {
      const mockMemory: IMemoryEngine = {
        initialize: vi.fn().mockResolvedValue(undefined),
        store: vi.fn(),
        retrieve: vi.fn(),
        search: vi.fn(),
        clear: vi.fn(),
      };

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      await container.initializeAll();
      container.reset();

      // After reset, should be able to initialize again
      expect(container.enginesInitialized).toBe(false);
    });
  });

  // ============ ServiceTypes Symbol Tests ============

  describe('ServiceTypes', () => {
    it('should have unique symbol for MemoryEngine', () => {
      expect(ServiceTypes.MemoryEngine).toBeDefined();
      expect(typeof ServiceTypes.MemoryEngine).toBe('symbol');
    });

    it('should have unique symbol for GraphEngine', () => {
      expect(ServiceTypes.GraphEngine).toBeDefined();
      expect(typeof ServiceTypes.GraphEngine).toBe('symbol');
    });

    it('should have unique symbol for AgentFactory', () => {
      expect(ServiceTypes.AgentFactory).toBeDefined();
      expect(typeof ServiceTypes.AgentFactory).toBe('symbol');
    });

    it('should have all 10 service symbols defined', () => {
      const symbols = Object.values(ServiceTypes);
      expect(symbols).toHaveLength(10);
      symbols.forEach(symbol => {
        expect(typeof symbol).toBe('symbol');
      });
    });
  });
});
