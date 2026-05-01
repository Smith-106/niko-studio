/**
 * TypeScript Service Interfaces for Dependency Injection
 * 
 * These interfaces define the contracts for all services registered in the ServiceContainer.
 * Each interface corresponds to a Python service that will be migrated to TypeScript.
 */

export const ServiceTypes = {
  MemoryEngine: Symbol.for('MemoryEngine'),
  GraphEngine: Symbol.for('GraphEngine'),
  SearchEngine: Symbol.for('SearchEngine'),
  WorkflowEngine: Symbol.for('WorkflowEngine'),
  CriticEngine: Symbol.for('CriticEngine'),
  AgentFactory: Symbol.for('AgentFactory'),
  BackupManager: Symbol.for('BackupManager'),
  TokenService: Symbol.for('TokenService'),
  ObsidianService: Symbol.for('ObsidianService'),
  MCPGateway: Symbol.for('MCPGateway'),
  DistillationService: Symbol.for('DistillationService'),
  KnowledgeService: Symbol.for('KnowledgeService'),
  LLMService: Symbol.for('LLMService'),
  EmbeddingService: Symbol.for('EmbeddingService'),
  SmartSearch: Symbol.for('SmartSearch'),
  HybridSearch: Symbol.for('HybridSearch'),
  VectorSearch: Symbol.for('VectorSearch'),
} as const;

export type ServiceIdentifier<T = unknown> = symbol;

/**
 * Memory Engine Interface
 * Manages narrative memory, context storage, and retrieval
 */
export interface IMemoryEngine {
  /**
   * Initialize the memory engine
   */
  initialize(): Promise<void>;

  /**
   * Store a memory entry
   */
  store(key: string, value: unknown): Promise<void>;

  /**
   * Add a rich memory entry through the unified memory surface.
   */
  add(params: {
    content: string;
    layer?: string;
    dimension?: string | null;
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    importance?: number;
    tags?: string[];
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    source?: string;
    confidence?: number;
  }): Promise<Record<string, unknown>>;

  /**
   * Retrieve a memory entry
   */
  retrieve(key: string): Promise<unknown>;

  /**
   * Search memories by query
   */
  search(query: string, limit?: number): Promise<unknown[]>;

  /**
   * Search memories with the richer MCP-facing filter shape.
   */
  search(params: {
    query: string;
    layer?: string | null;
    dimensions?: string[] | null;
    entityId?: string | null;
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    atTime?: string | null;
    limit?: number;
    minScore?: number | null;
  }): Promise<unknown[]>;

  /**
   * Get temporal facts for an entity at a point in time.
   */
  getTemporalFacts(params: {
    entityId: string;
    atTime?: string | null;
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
  }): Promise<unknown[]>;

  /**
   * Detect conflicts for an entity.
   */
  detectConflicts(
    entityId: string,
    scope?: {
      userId?: string | null;
      projectId?: string | null;
      sessionId?: string | null;
    }
  ): Promise<unknown[]>;

  /**
   * Resolve a conflict between two memories.
   */
  resolveConflict(params: {
    memoryIdA: string;
    memoryIdB: string;
    resolution?: string;
  }): Promise<Record<string, unknown>>;

  /**
   * Clear all memories
   */
  clear(): Promise<void>;
}

/**
 * Graph Engine Interface
 * Manages narrative graph structure and relationships
 */
export interface IGraphEngine {
  /**
   * Initialize the graph engine
   */
  initialize(): Promise<void>;

  /**
   * Add a node to the graph
   */
  addNode(id: string, data: unknown): Promise<void>;

  /**
   * Add an edge between nodes
   */
  addEdge(from: string, to: string, relationship: string): Promise<void>;

  /**
   * Get node by ID
   */
  getNode(id: string): Promise<unknown>;

  /**
   * Traverse graph from start node
   */
  traverse(startId: string, depth?: number): Promise<unknown[]>;
}

/**
 * Search Engine Interface
 * Iterative retrieval and search functionality
 */
export interface ISearchEngine {
  /**
   * Initialize the search engine
   */
  initialize(): Promise<void>;

  /**
   * Search for documents
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Index a document
   */
  index(document: Document): Promise<void>;

  /**
   * Clear search index
   */
  clear(): Promise<void>;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filters?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow Engine Interface
 * Orchestrates narrative generation workflow
 */
export interface IWorkflowEngine {
  /**
   * Initialize the workflow engine
   */
  initialize(): Promise<void>;

  /**
   * Build a workflow runtime for a specific workspace/session namespace.
   * Returns IWorkflowEngineRuntime; left optional so legacy adapters/mocks remain valid.
   */
  createRuntime?(params: { workspace: string; sessionNamespace: string }): import('./workflow-runtime-provider').IWorkflowEngineRuntime;

  /**
   * Execute a workflow level
   */
  executeLevel(level: string, context: WorkflowContext): Promise<WorkflowResult>;

  /**
   * Get available workflow levels
   */
  getLevels(): string[];

  /**
   * Reset workflow state
   */
  reset(): void;
}

export interface WorkflowContext {
  sessionId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowResult {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Critic Engine Interface
 * Analyzes and critiques narrative content
 */
export interface ICriticEngine {
  /**
   * Initialize the critic engine
   */
  initialize(): Promise<void>;

  /**
   * Analyze narrative content
   */
  analyze(content: string): Promise<CritiqueResult>;

  /**
   * Get critique suggestions
   */
  getSuggestions(result: CritiqueResult): string[];
}

export interface CritiqueResult {
  score: number;
  issues: string[];
  strengths: string[];
  recommendations: string[];
}

/**
 * Agent Factory Interface
 * Creates and manages AI agents
 */
export enum AgentType {
  Commander = 'commander',
  Architect = 'architect',
  Writer = 'writer',
  Critic = 'critic',
  Plot = 'plot',
}

export interface IAgent {
  execute(task: string, context?: Record<string, unknown>): Promise<unknown>;
  getName(): string;
  getType(): AgentType;
}

export interface IAgentFactory {
  /**
   * Get an agent instance by type
   */
  getAgent(
    agentType: AgentType,
    name?: string,
    config?: Record<string, unknown>,
    llm?: unknown
  ): IAgent;

  /**
   * Register a mock agent for testing
   */
  registerMock(agentType: AgentType, mock: IAgent): void;

  /**
   * Reset factory state
   */
  reset(): void;
}

/**
 * Backup Manager Interface
 * Handles backup and restore operations
 */
export interface IBackupManager {
  /**
   * Create a backup
   */
  createBackup(options?: BackupOptions): Promise<string>;

  /**
   * Restore from backup
   */
  restoreBackup(backupId: string): Promise<void>;

  /**
   * List available backups
   */
  listBackups(): Promise<BackupInfo[]>;

  /**
   * Delete a backup
   */
  deleteBackup(backupId: string): Promise<void>;
}

export interface BackupOptions {
  includeMemory?: boolean;
  includeGraph?: boolean;
  includeWorkflows?: boolean;
}

export interface BackupInfo {
  id: string;
  createdAt: Date;
  size: number;
  type: string;
}

/**
 * Token Service Interface
 * Manages token counting and budgeting
 */
export interface ITokenService {
  /**
   * Count tokens in text
   */
  countTokens(text: string): number;

  /**
   * Check if within budget
   */
  isWithinBudget(sessionId: string, tokens: number): boolean;

  /**
   * Update token usage
   */
  updateUsage(sessionId: string, tokens: number): void;

  /**
   * Get token usage for session
   */
  getUsage(sessionId: string): TokenUsage;
}

export interface TokenUsage {
  used: number;
  budget: number;
  remaining: number;
}

/**
 * Obsidian Service Interface
 * Integration with Obsidian note-taking app
 */
export interface IObsidianService {
  /**
   * Export to Obsidian vault
   */
  export(vaultPath: string, content: string, options?: ExportOptions): Promise<void>;

  /**
   * Import from Obsidian vault
   */
  import(vaultPath: string): Promise<string>;

  /**
   * Sync with Obsidian vault
   */
  sync(vaultPath: string): Promise<SyncResult>;
}

export interface ExportOptions {
  format?: 'markdown' | 'html';
  template?: string;
}

export interface SyncResult {
  added: number;
  modified: number;
  deleted: number;
}

/**
 * MCP Gateway Interface
 * Model Context Protocol gateway for external integrations
 */
export interface IMCPGateway {
  /**
   * Initialize MCP gateway
   */
  initialize(): Promise<void>;

  /**
   * Send request to MCP server
   */
  sendRequest(method: string, params?: unknown): Promise<unknown>;

  /**
   * Register MCP handler
   */
  registerHandler(method: string, handler: MCPHandler): void;

  /**
   * Close gateway connection
   */
  close(): Promise<void>;
}

export type MCPHandler = (params: unknown) => Promise<unknown>;

/**
 * Distillation Service Interface
 * Knowledge distillation for extracting structured knowledge from content
 */
export interface IDistillationService {
  /**
   * Get the prompt template for a distillation type
   */
  getPrompt(template: string): string;

  /**
   * Perform distillation on source content
   */
  distill(
    sources: string[],
    template: string,
    sourceIds?: string[],
    metadata?: Record<string, unknown>
  ): Promise<unknown>;

  /**
   * Get distillation result by ID
   */
  getResult(resultId: string): unknown;

  /**
   * List all results by template
   */
  listByTemplate(template: string): unknown[];

  /**
   * Legacy compatibility: distill chapter
   */
  distillChapter(content: string): Promise<unknown>;

  /**
   * Legacy compatibility: apply to graph
   */
  applyToGraph(
    knowledgeLayer: unknown,
    distilledData: unknown
  ): void;

  /**
   * Legacy compatibility: get distillation prompt
   */
  getDistillationPrompt(taskType: string, content?: string): string;
}

/**
 * LLM Service Interface
 * Language model service for text generation
 */
export interface ILLMService {
  /**
   * Generate text response
   */
  generate(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): Promise<string>;

  /**
   * Generate text response with metadata
   */
  generateWithMetadata(request: unknown): Promise<unknown>;

  /**
   * Generate JSON format response
   */
  generateJson(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<Record<string, unknown>>;

  /**
   * Stream text response
   */
  stream(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncIterableIterator<unknown>;

  /**
   * Batch generate text responses
   */
  batchGenerate(
    prompts: string[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      maxConcurrency?: number;
    }
  ): Promise<string[]>;
}

/**
 * Embedding Service Interface
 * Text embedding service for vector representations
 */
export interface IEmbeddingService {
  /**
   * Generate vector representation for a single text
   */
  embed(
    text: string,
    options?: { model?: string }
  ): Promise<number[]>;

  /**
   * Batch generate vector representations for texts
   */
  embedBatch(
    texts: string[],
    options?: {
      model?: string;
      batchSize?: number;
    }
  ): Promise<number[][]>;

  /**
   * Generate vector representation (including metadata)
   */
  embedWithMetadata(request: unknown): Promise<unknown>;

  /**
   * Calculate similarity between two vectors
   */
  similarity(embedding1: number[], embedding2: number[]): number;

  /**
   * Get vector dimensions of the model
   */
  getDimensions(model?: string): number;
}

/**
 * Knowledge Service Interface
 * Unified knowledge management service
 */
export interface IKnowledgeService {
  /**
   * Initialize the knowledge service
   */
  initialize(): Promise<void>;

  /**
   * Add a document to the knowledge base
   */
  addDocument(
    docId: string,
    content: string,
    metadata?: Partial<unknown>
  ): Promise<void>;

  /**
   * Add an entity to the knowledge graph
   */
  addEntity(entity: unknown): Promise<void>;

  /**
   * Add a relation to the knowledge graph
   */
  addRelation(relation: unknown): Promise<void>;

  /**
   * Perform hybrid search (vector + graph)
   */
  search(
    query: string,
    options?: {
      topK?: number;
      entityFilter?: string[];
    }
  ): Promise<unknown>;

  /**
   * Get neighboring entities in the knowledge graph
   */
  getNeighbors(entityId: string): Promise<unknown[]>;

  /**
   * Distill knowledge from content using LLM
   */
  distillKnowledge(
    content: string,
    template: string,
    metadata?: Record<string, unknown>
  ): Promise<unknown>;

  /**
   * Sync a file to the knowledge base
   */
  syncFile(
    filePath: string,
    options?: {
      force?: boolean;
      sourceType?: 'citation' | 'memory' | 'document';
    }
  ): Promise<{
    success: boolean;
    action: string;
    message: string;
    docId?: string;
    contentHash?: string;
  }>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Shutdown the service
   */
  shutdown(): Promise<void>;
}

/**
 * Smart Search Interface
 * Intelligent search with multiple modes
 */
export interface ISmartSearch {
  /**
   * Search with automatic mode selection
   */
  search(
    query: string,
    options?: {
      mode?: 'auto' | 'vector' | 'keyword' | 'hybrid';
      topK?: number;
      minScore?: number;
      filters?: Record<string, unknown>;
    }
  ): Promise<unknown[]>;

  /**
   * Index a document
   */
  index(
    id: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Delete a document
   */
  delete(id: string): Promise<boolean>;

  /**
   * Hybrid search with RRF fusion
   */
  hybridSearch?(
    query: string,
    options?: {
      topK?: number;
      vectorWeight?: number;
      keywordWeight?: number;
      rrfK?: number;
    }
  ): Promise<unknown[]>;
}

/**
 * Hybrid Search Interface
 * Multi-strategy search combination
 */
export interface IHybridSearch {
  /**
   * Execute hybrid search
   */
  search(
    query: string,
    options?: {
      strategies?: string[];
      topK?: number;
      weights?: Record<string, number>;
    }
  ): Promise<unknown[]>;

  /**
   * Add search strategy
   */
  addStrategy(
    name: string,
    searcher: unknown,
    weight?: number
  ): void;

  /**
   * Remove search strategy
   */
  removeStrategy(name: string): boolean;
}

/**
 * Vector Search Interface
 * Vector-based similarity search
 */
export interface IVectorSearch {
  /**
   * Vector similarity search
   */
  search(
    query: string,
    options?: {
      topK?: number;
      minScore?: number;
      filters?: Record<string, unknown>;
    }
  ): Promise<unknown[]>;

  /**
   * Index document with vector
   */
  index(
    id: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Delete document
   */
  delete(id: string): Promise<boolean>;
}
