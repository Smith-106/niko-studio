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

// ── Relation type enums ──

export enum NowledgeMemRelationType {
  RELATED = 'RELATED',
  CAUSED = 'CAUSED',
  ENABLED = 'ENABLED',
  PART_OF = 'PART_OF',
  PRECEDED = 'PRECEDED',
  EVOLVES = 'EVOLVES',
}

export enum NowledgeMemEvolvesKind {
  Replaces = 'Replaces',
  Enriches = 'Enriches',
  Confirms = 'Confirms',
  Challenges = 'Challenges',
}

export interface NowledgeMemRelation {
  from: string;
  to: string;
  type: NowledgeMemRelationType;
  evolvesKind?: NowledgeMemEvolvesKind;
  strength?: number; // 0.0-1.0
  recordedAt?: string;
}

// ── Core data types ──

export interface NowledgeMemMemory {
  id: string;
  content: string;
  title?: string;
  labels?: string[];
  importance?: number; // 0.1-1.0 float range (Nowledge Mem standard)
  unitType?: 'note' | 'decision' | 'learning' | 'reference' | 'task' | 'code' | 'concept' | 'metric';
  when?: string; // ISO datetime — event occurrence time (bitemporal)
  recordedAt?: string; // ISO datetime — recording time (auto-generated)
  eventStart?: string; // ISO datetime — event period start
  eventEnd?: string; // ISO datetime — event period end
  sourceRefs?: string[]; // linked source IDs
  spaceId?: string; // owning space
  version?: number; // version number for EVOLVES chain
  frontmatter?: Record<string, unknown>; // structured metadata
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
  source?: string;
  spaceId?: string;
  labels?: string[];
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

// ── Source entity ──

export interface NowledgeMemSource {
  id: string;
  type: 'file' | 'url' | 'reference';
  name: string;
  path?: string;
  url?: string;
  content?: string;
  labels?: string[];
  ingestedAt?: string;
  memoryIds?: string[];
}

// ── Space entity ──

export interface NowledgeMemSpace {
  id: string;
  name: string;
  description?: string;
  memberIds?: string[];
  createdAt?: string;
}

/**
 * Nowledge Mem Service Interface
 *
 * Provides access to Nowledge Mem's capabilities:
 * - Memory CRUD and search (with temporal filters)
 * - Knowledge graph exploration and typed relations
 * - Library management
 * - Source management (file/URL ingestion)
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
    title?: string;
    unitType?: 'note' | 'decision' | 'learning' | 'reference' | 'task' | 'code' | 'concept' | 'metric';
    when?: string;
    eventStart?: string;
    eventEnd?: string;
    sourceRefs?: string[];
    spaceId?: string;
  }): Promise<NowledgeMemMemory>;

  /** Search memories (semantic + structured) */
  searchMemories(query: string, options?: {
    labels?: string[];
    timeRange?: 'today' | 'week' | 'month' | 'year';
    importance?: number;
    mode?: 'normal' | 'deep';
    limit?: number;
    unitType?: string;
    eventFrom?: string;
    eventTo?: string;
    recordedFrom?: string;
    recordedTo?: string;
    spaceId?: string;
  }): Promise<NowledgeMemSearchResult>;

  /** Search memories by time range (bitemporal: event time or recorded time) */
  searchByTimeRange(options: {
    eventFrom?: string;
    eventTo?: string;
    recordedFrom?: string;
    recordedTo?: string;
    labels?: string[];
    unitType?: string;
    spaceId?: string;
    limit?: number;
  }): Promise<NowledgeMemSearchResult>;

  /** Get a specific memory by ID */
  getMemory(id: string): Promise<NowledgeMemMemory | null>;

  /** List memories with filters */
  listMemories(options?: {
    type?: string;
    label?: string;
    since?: string;
    limit?: number;
    spaceId?: string;
  }): Promise<NowledgeMemMemory[]>;

  /** Update a memory */
  updateMemory(id: string, updates: {
    content?: string;
    title?: string;
    labels?: string[];
    importance?: number;
    unitType?: string;
  }): Promise<NowledgeMemMemory | null>;

  /** Delete a memory */
  deleteMemory(id: string): Promise<boolean>;

  /** Move a memory between spaces */
  moveMemory(id: string, targetSpaceId: string): Promise<boolean>;

  // ── Graph operations ──

  /** Expand graph neighborhood around a memory */
  expandGraph(id: string): Promise<NowledgeMemGraphNeighbor>;

  /** Create a typed relation between two memories */
  createRelation(source: string, target: string, options: {
    type: NowledgeMemRelationType;
    evolvesKind?: NowledgeMemEvolvesKind;
    strength?: number;
  }): Promise<void>;

  /** Get related memories via graph traversal */
  getRelatedMemories(id: string, depth?: number): Promise<NowledgeMemMemory[]>;

  /** Search relations by type or endpoint */
  searchRelations(options: {
    type?: NowledgeMemRelationType;
    fromId?: string;
    toId?: string;
    limit?: number;
  }): Promise<NowledgeMemRelation[]>;

  /** Get EVOLVES version chain for a memory */
  getEvolvesChain(id: string, options?: { evolvesKind?: NowledgeMemEvolvesKind }): Promise<NowledgeMemMemory[]>;

  // ── Source operations ──

  /** Add a source (file, URL, or reference) */
  addSource(pathOrUrl: string, options?: {
    type?: 'file' | 'url' | 'reference';
    labels?: string[];
  }): Promise<NowledgeMemSource>;

  /** List tracked sources */
  listSources(options?: { type?: string; limit?: number }): Promise<NowledgeMemSource[]>;

  /** Get a specific source by ID */
  getSource(id: string): Promise<NowledgeMemSource | null>;

  /** Delete a source */
  deleteSource(id: string): Promise<boolean>;

  /** Ingest a source into memories (extract knowledge) */
  ingestSource(id: string, options?: { dryRun?: boolean }): Promise<{
    memoryIds: string[];
    extractedEntities: number;
  }>;

  /** Search chunks within a specific source */
  searchSourceChunks(sourceId: string, query: string, options?: { limit?: number }): Promise<Array<{ content: string; score: number }>>;

  // ── Space operations ──

  /** Create a knowledge space */
  createSpace(name: string, options?: { description?: string }): Promise<NowledgeMemSpace>;

  /** List all spaces */
  listSpaces(): Promise<NowledgeMemSpace[]>;

  /** Get a space by ID */
  getSpace(id: string): Promise<NowledgeMemSpace | null>;

  /** Switch active space */
  switchSpace(id: string): Promise<boolean>;

  /** Add entity to space */
  addSpaceMember(spaceId: string, entityId: string): Promise<boolean>;

  /** Remove entity from space */
  removeSpaceMember(spaceId: string, entityId: string): Promise<boolean>;

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

  // ── Distillation ──

  /** Distill multiple memories into a summarized memory */
  summarizeMemories(ids: string[]): Promise<string>;

  // ── Threads ──

  /** Add a conversation thread */
  addThread(messages: Array<{ role: string; content: string }>, options?: {
    title?: string;
    source?: string;
    spaceId?: string;
  }): Promise<NowledgeMemThread>;

  /** Search conversation threads */
  searchThreads(query: string, options?: { limit?: number }): Promise<NowledgeMemThread[]>;

  /** Get a thread by ID with messages */
  getThread(id: string): Promise<NowledgeMemThread | null>;

  /** Append messages to an existing thread */
  appendThread(id: string, messages: Array<{ role: string; content: string }>, options?: {
    idempotencyKey?: string;
  }): Promise<NowledgeMemThread | null>;

  /** Import a thread from Markdown or JSON */
  importThread(options: {
    file?: string;
    messages?: Array<{ role: string; content: string }>;
    stdin?: boolean;
    title?: string;
    source?: string;
  }): Promise<NowledgeMemThread>;

  /** Save current CLI session as a thread */
  saveThread(options?: { title?: string; source?: string; spaceId?: string }): Promise<NowledgeMemThread>;

  /** Reconcile thread tail (idempotent message merge) */
  reconcileTail(id: string, options?: { strategy?: 'merge' | 'trim'; maxOverlap?: number }): Promise<{
    reconciled: boolean;
    mergedCount?: number;
    trimmedCount?: number;
  }>;

  // ── Library import ──

  /** Import artifacts from library into memory */
  importFromLibrary(source: string, options?: {
    maxItems?: number;
    filterLabels?: string[];
    dryRun?: boolean;
  }): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    ids: string[];
  }>;

  // ── Lifecycle ──

  /** Initialize the service */
  initialize(): Promise<void>;

  /** Health check (returns true if Nowledge Mem is reachable) */
  healthCheck(): Promise<boolean>;

  /** Shutdown */
  shutdown(): Promise<void>;
}