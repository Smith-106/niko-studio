/**
 * TypeScript Service Interfaces for Dependency Injection
 *
 * These interfaces define the contracts for all services registered in the ServiceContainer.
 * Each interface corresponds to a Python service that will be migrated to TypeScript.
 */

export type { ISearchStrategyConfig } from '../search/strategy-config';
export type { IUnifiedSearchPipeline } from '../search/unified-pipeline';
export type { ISearchRelevanceScorer, ScoringConfig, ScoredResult, RelevanceSignal } from '../search/relevance-scorer';
export type { ISearchCacheManager, CacheConfig, CachedSearchResult } from '../search/cache-manager';

export type { INowledgeMemService } from '../protocols/nowledge-mem';
export type { IRevisionService } from '../protocols/revision';
export type { ISessionIntelligence } from '../protocols/session-intelligence';
export type { IPersonalizationService } from '../protocols/personalization';
export type { IEventBus } from '../services/event-bus';
export type { IMCPServiceDiscovery, DiscoveredProvider } from '../gateway/service-discovery';
export type { IMCPHealthMonitor, HealthProbeResult, ProviderHealthState } from '../gateway/health-monitor';
export type { IEventLog } from '../services/event-log';
export type { IDeadLetterQueue, DeadLetterEntry } from '../services/dead-letter-queue';
export type { INowledgeGraphSync } from '../services/nowledge-graph-sync';
export type { IGraphWikiLinkBridge, LinkIndexEntry, OrphanType, OrphanedLink, IntegrityReport } from '../services/graph-wiki-bridge';
export type { IObsidianKnowledgeSync, SyncDirectionResult, SyncConflict, ConflictStrategy } from '../services/obsidian-knowledge-sync';
export type { ILLMFallbackChain } from '../services/llm-fallback-chain';
export type { SyncResult as NowledgeSyncResult, BatchSyncResult as NowledgeBatchSyncResult, SyncStatus as NowledgeSyncStatus } from '../services/nowledge-graph-sync';

export type { IMCPRequestRouter } from '../gateway/mcp-router';

export type { IArtifactContract, ArtifactResolver, StateArtifact } from '../workflow/artifact-contract';
export { STAGE_CONTRACTS } from '../workflow/artifact-contract';

export type { SubPlanSpec, SubPlanResult, SubTaskSpec, SubTaskResult } from '../workflow/delegate/sub-plan';

export type { IParallelResultAggregator, AggregationStrategy, AggregationConfig, AggregatedResult } from '../workflow/delegate/result-aggregator';

export type { IWaveExecutionEngine, WaveSpec, WaveResult, WaveExecutionConfig } from '../workflow/wave-engine';

export type { IQualityGateFeedbackLoop, VerificationGap, RemediationPlan, FeedbackLoopResult, RemediationResult, FeedbackLoopConfig } from '../workflow/quality-gate-loop';

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
  LearningOrchestrator: Symbol.for('LearningOrchestrator'),
  ImportLearning: Symbol.for('ImportLearning'),
  SelfEvolvingWriting: Symbol.for('SelfEvolvingWriting'),
  ReadingLearning: Symbol.for('ReadingLearning'),
  NowledgeMemService: Symbol.for('NowledgeMemService'),
  RevisionService: Symbol.for('RevisionService'),
  SessionIntelligenceService: Symbol.for('SessionIntelligenceService'),
  PersonalizationService: Symbol.for('PersonalizationService'),
  PhaseOrchestrator: Symbol.for('PhaseOrchestrator'),
  WebSocketRelayService: Symbol.for('WebSocketRelayService'),
  DistillationNowledgeBridge: Symbol.for('DistillationNowledgeBridge'),
  ConflictNowledgeBridge: Symbol.for('ConflictNowledgeBridge'),
  FileSyncService: Symbol.for('FileSyncService'),
  EventBus: Symbol.for('EventBus'),
  EventLog: Symbol.for('EventLog'),
  DeadLetterQueue: Symbol.for('DeadLetterQueue'),
  SearchStrategyConfig: Symbol.for('SearchStrategyConfig'),
  UnifiedSearchPipeline: Symbol.for('UnifiedSearchPipeline'),
  MCPRequestRouter: Symbol.for('MCPRequestRouter'),
  NowledgeGraphSync: Symbol.for('NowledgeGraphSync'),
  GraphWikiLinkBridge: Symbol.for('GraphWikiLinkBridge'),
  ObsidianKnowledgeSync: Symbol.for('ObsidianKnowledgeSync'),
  LLMFallbackChain: Symbol.for('LLMFallbackChain'),
  MCPServiceDiscovery: Symbol.for('MCPServiceDiscovery'),
  MCPHealthMonitor: Symbol.for('MCPHealthMonitor'),
  SearchRelevanceScorer: Symbol.for('SearchRelevanceScorer'),
  SearchCacheManager: Symbol.for('SearchCacheManager'),
  ResultAggregator: Symbol.for('ResultAggregator'),
  QualityGateFeedbackLoop: Symbol.for('QualityGateFeedbackLoop'),
  WaveExecutionEngine: Symbol.for('WaveExecutionEngine'),
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

  /**
   * Read content of a vault note
   */
  readNote(vaultPath: string, notePath: string): Promise<string | null>;

  /**
   * Write content to a vault note (creates if not exists)
   */
  writeNote(vaultPath: string, notePath: string, content: string): Promise<void>;

  /**
   * Update an existing vault note
   */
  updateNote(vaultPath: string, notePath: string, content: string): Promise<void>;

  /**
   * Create a new note with optional frontmatter
   */
  createNote(vaultPath: string, notePath: string, content: string, frontmatter?: Record<string, unknown>): Promise<void>;

  /**
   * Delete a vault note
   */
  deleteNote(vaultPath: string, notePath: string): Promise<void>;

  /**
   * Read YAML frontmatter from a vault note
   */
  readFrontmatter(vaultPath: string, notePath: string): Promise<Record<string, unknown> | null>;

  /**
   * Update YAML frontmatter fields (shallow merge)
   */
  updateFrontmatter(vaultPath: string, notePath: string, updates: Record<string, unknown>): Promise<void>;

  /**
   * Deep-merge frontmatter fields
   */
  mergeFrontmatter(vaultPath: string, notePath: string, data: Record<string, unknown>): Promise<void>;

  /**
   * Resolve a wiki-link to an actual file path
   */
  resolveWikiLink(vaultPath: string, link: string): Promise<string | null>;

  /**
   * Get all notes that link back to the given note
   */
  getBacklinks(vaultPath: string, notePath: string): Promise<Array<{ name: string; path: string; relativePath: string }>>;

  /**
   * Create a daily note for a given date
   */
  createDailyNote(vaultPath: string, date?: Date, template?: string): Promise<string>;

  /**
   * Read a daily note for a given date
   */
  getDailyNote(vaultPath: string, date?: Date): Promise<string | null>;

  /**
   * Append content to a daily note (creates if not exists)
   */
  appendToDailyNote(vaultPath: string, content: string, date?: Date): Promise<string>;

  // ── Search & enumeration ────────────────────────────────────────────

  /** Search notes by query (delegates to underlying searchNotes) */
  search(vaultPath: string, query: string, searchContent?: boolean, limit?: number): Array<{ name: string; path: string; relativePath: string }>;

  /** List files in vault matching a glob pattern */
  getFiles(vaultPath: string, pattern?: string): string[];
}

export interface IPhaseOrchestrator {
  validatePhase(phase: string, stage: string): Promise<boolean>;
  checkQualityGate(phase: string, stage: string): Promise<boolean>;
  getQualityGates(phase: string): string[];
  advancePhase(phase: string, nextStage: string): Promise<boolean>;
  /**
   * Route-through-orchestrator gate check.
   *
   * Validates whether the current phase state permits a given operation.
   * Returns a PhaseRouteResult that the gateway uses to decide whether
   * to forward the request or reject it.
   */
  routeThroughOrchestrator(operation: string, method: string, path: string): PhaseRouteResult;
}

/**
 * Result of the orchestrator route-through gate check.
 */
export interface PhaseRouteResult {
  /** Whether the operation is permitted at the current phase. */
  allowed: boolean;
  /** HTTP status code to use if not allowed (403 = forbidden, 503 = service unavailable). */
  statusCode: number;
  /** Human-readable reason for the gate decision. */
  reason: string;
  /** Current phase name at the time of the check. */
  currentPhase: string;
}

export interface IWebSocketRelayService {
  broadcast(channel: string, payload: unknown): void;
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;
  isConnected(): boolean;
}

export interface IDistillationNowledgeBridge {
  distill(knowledgeId: string, targetVaultPath?: string): Promise<string>;
  getDistillationStatus(knowledgeId: string): Promise<'pending' | 'completed' | 'failed' | 'not_found'>;
}

export interface IConflictNowledgeBridge {
  detectConflicts(vaultPath: string, notePath?: string): Promise<Array<{ localPath: string; knowledgeId: string; conflictType: string }>>;
  resolveConflict(conflictId: string, resolution: 'local' | 'knowledge' | 'merge'): Promise<boolean>;
}

export interface IFileSyncAdapter {
  sync(direction: 'push' | 'pull' | 'bidirectional', source: string, target: string): Promise<{ synced: number; conflicts: number }>;
  getSyncHistory(source: string): Promise<Array<{ timestamp: string; direction: string; filesCount: number }>>;
  getIndexedFiles(source: string): Promise<string[]>;
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
   * Remove search strategy — returns new instance or null if not found
   */
  removeStrategy(name: string): IHybridSearch | null;
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

/**
 * Learning Orchestrator Interface
 * Coordinates all learning pipelines
 */
export interface ILearningOrchestrator {
  getPipeline(capability: import('../learning/learning-types').LearningCapability): import('../learning/learning-types').ILearningPipeline | undefined;
  enable(capability: import('../learning/learning-types').LearningCapability): void;
  disable(capability: import('../learning/learning-types').LearningCapability): void;
  isEnabled(capability: import('../learning/learning-types').LearningCapability): boolean;
  getStatus(): Record<string, import('../learning/learning-types').PipelineStatusInfo | null>;
  getStatusSummary(): { totalPipelines: number; activePipelines: number; runningPipelines: number };
  getConfig(): import('../learning/learning-types').LearningConfig;
}
