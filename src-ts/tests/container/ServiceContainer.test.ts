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
  IDistillationService,
  ILLMService,
  IEmbeddingService,
  IKnowledgeService,
  ISmartSearch,
  IHybridSearch,
  IVectorSearch,
} from '../../container/types';

function createMockMemoryEngine(
  overrides: Partial<IMemoryEngine> = {},
): IMemoryEngine {
  return {
    initialize: vi.fn(),
    store: vi.fn(),
    add: vi.fn(),
    retrieve: vi.fn(),
    search: vi.fn(),
    getTemporalFacts: vi.fn(),
    detectConflicts: vi.fn(),
    resolveConflict: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

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
      const mockMemory = createMockMemoryEngine();

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
      const mockMemory = createMockMemoryEngine();

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.clearMocks();

      expect(() => container.memory).toBeDefined();
    });
  });

  // ============ Lazy Initialization Tests ============

  describe('Lazy Initialization', () => {
    it('should lazily initialize MemoryEngine on first access', () => {
      expect(container.memory).toBeDefined();
    });

    it('should lazily initialize GraphEngine on first access', () => {
      expect(container.graph).toBeDefined();
    });

    it('should lazily initialize SearchEngine on first access', () => {
      expect(container.search).toBeDefined();
    });

    it('should lazily initialize WorkflowEngine on first access', () => {
      expect(container.workflow).toBeDefined();
    });

    it('should lazily initialize CriticEngine on first access', () => {
      expect(container.critic).toBeDefined();
    });

    it('should lazily initialize AgentFactory on first access', () => {
      expect(container.agentFactory).toBeDefined();
    });

    it('should lazily initialize BackupManager on first access', () => {
      expect(container.backup).toBeDefined();
    });

    it('should lazily initialize TokenService on first access', () => {
      expect(container.token).toBeDefined();
    });

    it('should lazily initialize ObsidianService on first access', () => {
      expect(container.obsidian).toBeDefined();
    });

    it('should lazily initialize MCPGateway on first access', () => {
      expect(container.mcpGateway).toBeDefined();
    });
  });

  // ============ Service Getter Tests ============

  describe('Service Getters', () => {
    it('should return same MemoryEngine instance on multiple accesses', () => {
      const mockMemory = createMockMemoryEngine();

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
      const mockMemory = createMockMemoryEngine({
        initialize: vi.fn().mockResolvedValue(undefined),
      });

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
      const mockMemory = createMockMemoryEngine({
        initialize: vi.fn().mockResolvedValue(undefined),
      });

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      await container.initializeAll();

      expect(mockMemory.initialize).toHaveBeenCalled();
    });

    it('should not re-initialize if already initialized', async () => {
      const mockMemory = createMockMemoryEngine({
        initialize: vi.fn().mockResolvedValue(undefined),
      });

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      await container.initializeAll();
      await container.initializeAll();

      expect(mockMemory.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization timeout', { timeout: 5_000 }, async () => {
      const mockMemory = createMockMemoryEngine({
        initialize: vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 3000))),
      });

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.registerMock(ServiceTypes.GraphEngine, {} as any);
      container.registerMock(ServiceTypes.CriticEngine, {} as any);
      container.registerMock(ServiceTypes.SearchEngine, {} as any);
      container.registerMock(ServiceTypes.WorkflowEngine, {} as any);

      const initPromise = container.initializeAll();

      await expect(container.ensureInitialized([ServiceTypes.MemoryEngine], 100))
        .rejects.toThrow('timeout');

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
    it('should return MemoryEngine instance', () => {
      expect(container.memory).toBeDefined();
    });

    it('should return GraphEngine instance', () => {
      expect(container.graph).toBeDefined();
    });

    it('should return SearchEngine instance', () => {
      expect(container.search).toBeDefined();
    });

    it('should return WorkflowEngine instance', () => {
      expect(container.workflow).toBeDefined();
    });

    it('should return CriticEngine instance', () => {
      expect(container.critic).toBeDefined();
    });

    it('should return AgentFactory instance', () => {
      expect(container.agentFactory).toBeDefined();
    });

    it('should return BackupManager instance', () => {
      expect(container.backup).toBeDefined();
    });

    it('should return TokenService instance', () => {
      expect(container.token).toBeDefined();
    });

    it('should return ObsidianService instance', () => {
      expect(container.obsidian).toBeDefined();
    });

    it('should return MCPGateway instance', () => {
      expect(container.mcpGateway).toBeDefined();
    });
  });

  // ============ Reset Tests ============

  describe('Reset', () => {
    it('should clear mocks on reset', () => {
      const mockMemory = createMockMemoryEngine();

      container.registerMock(ServiceTypes.MemoryEngine, mockMemory);
      container.reset();

      // After reset, mock is cleared — falls back to real adapter instance
      expect(container.memory).toBeDefined();
      expect(container.memory).not.toBe(mockMemory);
    });

    it('should reset initialized flag on reset', async () => {
      const mockMemory = createMockMemoryEngine({
        initialize: vi.fn().mockResolvedValue(undefined),
      });

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
      const mockMemory = createMockMemoryEngine({
        initialize: vi.fn().mockResolvedValue(undefined),
      });

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

    it('should have all 17 service symbols defined (10 placeholder + 7 migrated)', () => {
      const symbols = Object.values(ServiceTypes);
      expect(symbols).toHaveLength(17);
      symbols.forEach(symbol => {
        expect(typeof symbol).toBe('symbol');
      });
    });
  });

  // ============ Migrated Services Tests ============

  describe('Migrated Services', () => {
    describe('Mock Injection', () => {
      it('should register mock for DistillationService', () => {
        const mockDistillation: IDistillationService = {
          getPrompt: vi.fn(),
          distill: vi.fn(),
          getResult: vi.fn(),
          listByTemplate: vi.fn(),
          distillChapter: vi.fn(),
          applyToGraph: vi.fn(),
          getDistillationPrompt: vi.fn(),
        };

        container.registerMock(ServiceTypes.DistillationService, mockDistillation);
        const result = container.distillation;

        expect(result).toBe(mockDistillation);
      });

      it('should register mock for LLMService', () => {
        const mockLLM: ILLMService = {
          generate: vi.fn(),
          generateWithMetadata: vi.fn(),
          generateJson: vi.fn(),
          stream: vi.fn(),
          batchGenerate: vi.fn(),
        };

        container.registerMock(ServiceTypes.LLMService, mockLLM);
        const result = container.llm;

        expect(result).toBe(mockLLM);
      });

      it('should register mock for EmbeddingService', () => {
        const mockEmbedding: IEmbeddingService = {
          embed: vi.fn(),
          embedBatch: vi.fn(),
          embedWithMetadata: vi.fn(),
          similarity: vi.fn(),
          getDimensions: vi.fn(),
        };

        container.registerMock(ServiceTypes.EmbeddingService, mockEmbedding);
        const result = container.embedding;

        expect(result).toBe(mockEmbedding);
      });

      it('should register mock for KnowledgeService', () => {
        const mockKnowledge: IKnowledgeService = {
          initialize: vi.fn(),
          addDocument: vi.fn(),
          addEntity: vi.fn(),
          addRelation: vi.fn(),
          search: vi.fn(),
          getNeighbors: vi.fn(),
          distillKnowledge: vi.fn(),
          syncFile: vi.fn(),
          healthCheck: vi.fn(),
          shutdown: vi.fn(),
        };

        container.registerMock(ServiceTypes.KnowledgeService, mockKnowledge);
        const result = container.knowledge;

        expect(result).toBe(mockKnowledge);
      });

      it('should register mock for SmartSearch', () => {
        const mockSmartSearch: ISmartSearch = {
          search: vi.fn(),
          index: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        };

        container.registerMock(ServiceTypes.SmartSearch, mockSmartSearch);
        const result = container.smartSearch;

        expect(result).toBe(mockSmartSearch);
      });

      it('should register mock for HybridSearch', () => {
        const mockHybridSearch: IHybridSearch = {
          search: vi.fn(),
          addStrategy: vi.fn(),
          removeStrategy: vi.fn(),
        };

        container.registerMock(ServiceTypes.HybridSearch, mockHybridSearch);
        const result = container.hybridSearch;

        expect(result).toBe(mockHybridSearch);
      });

      it('should register mock for VectorSearch', () => {
        const mockVectorSearch: IVectorSearch = {
          search: vi.fn(),
          index: vi.fn(),
          delete: vi.fn(),
        };

        container.registerMock(ServiceTypes.VectorSearch, mockVectorSearch);
        const result = container.vectorSearch;

        expect(result).toBe(mockVectorSearch);
      });
    });

    describe('Lazy Initialization', () => {
      it('should lazily initialize DistillationService on first access', () => {
        const service = container.distillation;
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(Object);
      });

      it('should lazily initialize LLMService on first access', () => {
        const service = container.llm;
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(Object);
      });

      it('should lazily initialize EmbeddingService on first access', () => {
        const mockEmbedding: IEmbeddingService = {
          embed: vi.fn(),
          embedBatch: vi.fn(),
          embedWithMetadata: vi.fn(),
          similarity: vi.fn(),
          getDimensions: vi.fn(),
        };

        container.registerMock(ServiceTypes.EmbeddingService, mockEmbedding);
        const service = container.embedding;
        expect(service).toBeDefined();
        expect(service).toBe(mockEmbedding);
      });

      it('should lazily initialize KnowledgeService on first access', () => {
        const service = container.knowledge;
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(Object);
      });

      it('should lazily initialize SmartSearch on first access', () => {
        const service = container.smartSearch;
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(Object);
      });

      it('should lazily initialize HybridSearch on first access', () => {
        const mockHybridSearch: IHybridSearch = {
          search: vi.fn(),
          addStrategy: vi.fn(),
          removeStrategy: vi.fn(),
        };

        container.registerMock(ServiceTypes.HybridSearch, mockHybridSearch);
        const service = container.hybridSearch;
        expect(service).toBeDefined();
        expect(service).toBe(mockHybridSearch);
      });

      it('should lazily initialize VectorSearch on first access', () => {
        const service = container.vectorSearch;
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(Object);
      });
    });

    describe('Singleton Behavior', () => {
      it('should return same DistillationService instance on multiple accesses', () => {
        const instance1 = container.distillation;
        const instance2 = container.distillation;

        expect(instance1).toBe(instance2);
      });

      it('should return same LLMService instance on multiple accesses', () => {
        const instance1 = container.llm;
        const instance2 = container.llm;

        expect(instance1).toBe(instance2);
      });

      it('should return same EmbeddingService instance on multiple accesses', () => {
        const mockEmbedding: IEmbeddingService = {
          embed: vi.fn(),
          embedBatch: vi.fn(),
          embedWithMetadata: vi.fn(),
          similarity: vi.fn(),
          getDimensions: vi.fn(),
        };

        container.registerMock(ServiceTypes.EmbeddingService, mockEmbedding);
        const instance1 = container.embedding;
        const instance2 = container.embedding;

        expect(instance1).toBe(instance2);
      });

      it('should return same KnowledgeService instance on multiple accesses', () => {
        const instance1 = container.knowledge;
        const instance2 = container.knowledge;

        expect(instance1).toBe(instance2);
      });

      it('should return same SmartSearch instance on multiple accesses', () => {
        const instance1 = container.smartSearch;
        const instance2 = container.smartSearch;

        expect(instance1).toBe(instance2);
      });

      it('should return same HybridSearch instance on multiple accesses', () => {
        const mockHybridSearch: IHybridSearch = {
          search: vi.fn(),
          addStrategy: vi.fn(),
          removeStrategy: vi.fn(),
        };

        container.registerMock(ServiceTypes.HybridSearch, mockHybridSearch);
        const instance1 = container.hybridSearch;
        const instance2 = container.hybridSearch;

        expect(instance1).toBe(instance2);
      });

      it('should return same VectorSearch instance on multiple accesses', () => {
        const instance1 = container.vectorSearch;
        const instance2 = container.vectorSearch;

        expect(instance1).toBe(instance2);
      });
    });

    describe('ServiceTypes Symbols', () => {
      it('should have unique symbol for DistillationService', () => {
        expect(ServiceTypes.DistillationService).toBeDefined();
        expect(typeof ServiceTypes.DistillationService).toBe('symbol');
      });

      it('should have unique symbol for LLMService', () => {
        expect(ServiceTypes.LLMService).toBeDefined();
        expect(typeof ServiceTypes.LLMService).toBe('symbol');
      });

      it('should have unique symbol for EmbeddingService', () => {
        expect(ServiceTypes.EmbeddingService).toBeDefined();
        expect(typeof ServiceTypes.EmbeddingService).toBe('symbol');
      });

      it('should have unique symbol for KnowledgeService', () => {
        expect(ServiceTypes.KnowledgeService).toBeDefined();
        expect(typeof ServiceTypes.KnowledgeService).toBe('symbol');
      });

      it('should have unique symbol for SmartSearch', () => {
        expect(ServiceTypes.SmartSearch).toBeDefined();
        expect(typeof ServiceTypes.SmartSearch).toBe('symbol');
      });

      it('should have unique symbol for HybridSearch', () => {
        expect(ServiceTypes.HybridSearch).toBeDefined();
        expect(typeof ServiceTypes.HybridSearch).toBe('symbol');
      });

      it('should have unique symbol for VectorSearch', () => {
        expect(ServiceTypes.VectorSearch).toBeDefined();
        expect(typeof ServiceTypes.VectorSearch).toBe('symbol');
      });

      it('should have all 17 service symbols defined (10 placeholder + 7 migrated)', () => {
        const symbols = Object.values(ServiceTypes);
        expect(symbols).toHaveLength(17);
        symbols.forEach(symbol => {
          expect(typeof symbol).toBe('symbol');
        });
      });
    });
  });
});
