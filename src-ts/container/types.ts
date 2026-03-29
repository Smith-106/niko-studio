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
   * Retrieve a memory entry
   */
  retrieve(key: string): Promise<unknown>;

  /**
   * Search memories by query
   */
  search(query: string, limit?: number): Promise<unknown[]>;

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
