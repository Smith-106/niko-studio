/**
 * Iterative Retriever Type Definitions
 *
 * Migrated from src/search/iterative_retriever.py.
 * Defines data structures for the GAM (Generate-then-Aggregate-then-Mine)
 * retrieval engine.
 */

// ============================================================
// Core Search Result
// ============================================================

/**
 * A single search result from any source (memory, graph, file, elastic)
 */
export interface SearchResult {
  /** Unique identifier */
  id: string
  /** Text content of the result */
  content: string
  /** Source system: memory | graph | file | elastic */
  source: string
  /** Relevance score (0-1) */
  score: number
  /** Arbitrary metadata from the source system */
  metadata: Record<string, unknown>
}

// ============================================================
// Retrieval Profile
// ============================================================

/**
 * Score fusion weights for dense (vector), sparse (keyword), and graph signals
 */
export interface FusionConfig {
  /** Whether fusion is enabled */
  enabled: boolean
  /** Weight for vector/dense similarity score */
  dense: number
  /** Weight for sparse/keyword hit ratio */
  sparse: number
  /** Weight for graph signal (only applied when source === 'graph') */
  graph: number
}

/**
 * Rerank configuration within a profile
 */
export interface RerankConfig {
  /** Whether reranking is enabled */
  enabled: boolean
  /** Maximum results to keep after reranking */
  topK: number
}

/**
 * A named preset that controls every knob of the retrieval pipeline
 */
export interface RetrievalProfile {
  /** Profile name */
  name: string
  /** Per-source multiplier applied before fusion */
  sourceWeights: Record<string, number>
  /** Score thresholds (e.g. { min_score: 0.3 }) */
  thresholds: Record<string, number | null>
  /** Token budget (e.g. { budget_tokens: 1400 }) */
  budget: Record<string, number | null>
  /** Rerank options */
  rerank: RerankConfig
  /** Per-source cap on number of results */
  sourceQuota: Record<string, number>
  /** Score fusion weights */
  fusion: FusionConfig
}

// ============================================================
// Route Mode
// ============================================================

/**
 * Determines which backend(s) to query in hybridSearch
 *
 * - legacy: memory + graph + file (default)
 * - elastic: external search service only
 * - hybrid: merge legacy and elastic results
 */
export type RouteMode = 'legacy' | 'elastic' | 'hybrid'

// ============================================================
// @-Reference Context
// ============================================================

/**
 * Context types that can be resolved via @-references
 */
export type ContextType =
  | 'character'
  | 'scene'
  | 'chapter'
  | 'memory'
  | 'timeline'
  | 'foreshadow'
  | 'style'

/**
 * A resolved @-reference with its context text
 */
export interface ResolvedReference {
  /** The context type (character, scene, etc.) */
  type: ContextType
  /** The referenced value after the colon */
  value: string
  /** Resolved context text */
  context: string
}

// ============================================================
// Retrieval Trace
// ============================================================

/**
 * Timing and diagnostic info for a single pipeline stage
 */
export interface StageTrace {
  /** Wall-clock duration in milliseconds */
  durationMs: number
  /** Number of candidates at this stage */
  candidates: number
}

/**
 * Trace for the collect stage (includes route details)
 */
export interface CollectStageTrace extends StageTrace {
  routeMode: RouteMode
  legacyCandidates: number
  elasticCandidates: number
}

/**
 * Trace for the rerank stage
 */
export interface RerankStageTrace extends StageTrace {
  enabled: boolean
  fallback: boolean
}

/**
 * Trace for the trim stage
 */
export interface TrimStageTrace {
  durationMs: number
  droppedByThreshold: number
  finalResults: number
  budgetTokens: number | null
}

/**
 * Full pipeline trace recorded on each hybridSearch call
 */
export interface RetrievalTrace {
  query: string
  scope: string
  limit: number
  profile: string
  cacheHit: boolean
  stages: {
    collect: CollectStageTrace
    rerank: RerankStageTrace
    trim: TrimStageTrace
  }
  totalDurationMs: number
}

// ============================================================
// Iterative Retrieve Result
// ============================================================

/**
 * Output of iterativeRetrieve (GAM pattern)
 */
export interface IterativeRetrieveResult {
  /** Final deduplicated results sorted by score */
  results: Array<Omit<SearchResult, 'score'> & { score: number }>
  /** Number of iterations executed */
  iterations: number
  /** Best confidence (top score) achieved */
  confidence: number
  /** All queries used during iteration */
  queriesUsed: string[]
  /** Per-iteration traces */
  retrievalTrace: RetrievalTrace[]
}

// ============================================================
// Dependencies (injectable)
// ============================================================

/**
 * Adapter for external search services (e.g. Elasticsearch).
 * Implementations are plugged in at construction time.
 */
export interface ElasticSearchAdapter {
  search(
    query: string,
    scope: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>>
}

/**
 * Minimal memory engine interface required by IterativeRetriever
 */
export interface MemorySearchProvider {
  search(
    query: string,
    options?: {
      dimensions?: string[]
      limit?: number
    },
  ): Promise<Array<Record<string, unknown>>>
  getRetrievalProfile?(name: string): Record<string, unknown> | undefined
}

/**
 * Minimal graph engine interface required by IterativeRetriever
 */
export interface GraphSearchProvider {
  searchEntitiesByName(
    entityType: string,
    namePattern: string,
  ): Promise<Array<Record<string, unknown>>>
  getCharacter(name: string): Promise<Record<string, unknown>>
  getForeshadows(): Promise<Array<Record<string, unknown>>>
}

/**
 * Skill engine interface for @style: resolution
 */
export interface SkillProvider {
  load(name: string): Promise<Record<string, unknown>>
}
