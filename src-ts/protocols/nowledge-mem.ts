/**
 * Nowledge Mem Protocol
 *
 * Defines the interface for integrating with Nowledge Mem,
 * a local knowledge/memory management tool.
 *
 * Communication: CLI (`nmem`) as primary, HTTP API as fallback.
 * Graceful degradation when Nowledge Mem server is unavailable.
 */

export interface NowledgeMemConfig {
  /** CLI executable path (auto-detected if omitted) */
  cliPath?: string;
  /** HTTP API base URL (default: http://127.0.0.1:14242) */
  apiUrl?: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Space name for scoped operations */
  space?: string;
  /** Communication mode: 'cli' (default) or 'http' */
  mode?: 'cli' | 'http';
  /** Timeout for CLI/HTTP calls in ms (default: 10000) */
  timeout?: number;
}

export interface NowledgeMemMemory {
  id: string;
  content: string;
  labels?: string[];
  importance?: number;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NowledgeMemSearchResult {
  memories: NowledgeMemMemory[];
  total?: number;
  query?: string;
}

export interface NowledgeMemThread {
  id: string;
  title: string;
  messages?: Array<{ role: string; content: string }>;
  createdAt?: string;
}

export interface NowledgeMemGraphNeighbor {
  memoryId: string;
  relations: Array<{
    type: string;
    targetId: string;
    targetContent?: string;
  }>;
}

export interface NowledgeMemLibraryArtifact {
  id: string;
  name: string;
  type: string;
  summary?: string;
  createdAt?: string;
}

export interface NowledgeMemCommunity {
  id: string;
  name: string;
  topic?: string;
  memberCount?: number;
}

export interface NowledgeMemWorkingMemory {
  date: string;
  content: string;
  sections?: Array<{ heading: string; content: string }>;
}

export interface NowledgeMemStatus {
  connected: boolean;
  version?: string;
  stats?: {
    memoryCount?: number;
    threadCount?: number;
    libraryCount?: number;
  };
}

export interface NowledgeMemFeedEntry {
  id: string;
  type: string;
  content?: string;
  timestamp?: string;
}

/**
 * Nowledge Mem Service Interface
 *
 * Provides access to Nowledge Mem's capabilities:
 * - Memory CRUD and search
 * - Knowledge graph exploration
 * - Library management
 * - Community detection
 * - Working memory (daily focus surface)
 * - Thread management
 * - Activity feed
 *
 * Also implements KnowledgeMemoryEngineAdapter so it can serve
 * as a persistence backend for KnowledgeService.
 */
export interface INowledgeMemService {
  /** Check Nowledge Mem server status */
  status(): Promise<NowledgeMemStatus>;

  // ── Memory operations ──

  /** Add a memory entry */
  addMemory(content: string, options?: {
    labels?: string[];
    importance?: number;
    id?: string;
  }): Promise<NowledgeMemMemory>;

  /** Search memories */
  searchMemories(query: string, options?: {
    labels?: string[];
    timeRange?: 'today' | 'week' | 'month' | 'year';
    importance?: number;
    mode?: 'normal' | 'deep';
    limit?: number;
  }): Promise<NowledgeMemSearchResult>;

  /** Get a specific memory by ID */
  getMemory(id: string): Promise<NowledgeMemMemory | null>;

  /** Update a memory */
  updateMemory(id: string, updates: {
    content?: string;
    labels?: string[];
    importance?: number;
  }): Promise<NowledgeMemMemory>;

  /** Delete a memory */
  deleteMemory(id: string): Promise<boolean>;

  // ── Graph operations ──

  /** Expand graph neighborhood around a memory */
  expandGraph(id: string): Promise<NowledgeMemGraphNeighbor>;

  // ── Library operations ──

  /** Add a file or URL to the library */
  addToLibrary(paths: string[]): Promise<NowledgeMemLibraryArtifact[]>;

  /** Search library artifacts */
  searchLibrary(query: string, options?: {
    limit?: number;
  }): Promise<NowledgeMemLibraryArtifact[]>;

  /** Read parsed artifact content */
  readArtifact(id: string): Promise<string>;

  // ── Working memory ──

  /** Get working memory for a date */
  getWorkingMemory(date?: string): Promise<NowledgeMemWorkingMemory>;

  /** Set working memory content */
  setWorkingMemory(content: string): Promise<void>;

  // ── Communities ──

  /** List knowledge communities */
  listCommunities(limit?: number): Promise<NowledgeMemCommunity[]>;

  // ── Feed ──

  /** Get activity feed */
  getFeed(days?: number): Promise<NowledgeMemFeedEntry[]>;

  // ── Lifecycle ──

  /** Initialize the service */
  initialize(): Promise<void>;

  /** Health check (returns true if Nowledge Mem is reachable) */
  healthCheck(): Promise<boolean>;

  /** Shutdown */
  shutdown(): Promise<void>;
}