/**
 * Reranker Data Models
 *
 * Migrated from src/services/reranker/models.py.
 * Defines data structures, configuration, and error types for the rerank service.
 */

/**
 * Reranker type enum
 */
export enum RerankerType {
  JINA = 'jina',
  VOYAGE = 'voyage',
  TEI = 'tei',
  BAILIAN = 'bailian',
}

/**
 * A document that has been ranked by a reranker
 */
export interface RankedDocument {
  /** Document unique identifier */
  id: string;
  /** Document content */
  content: string;
  /** Relevance score (0-1) */
  score: number;
  /** Document metadata */
  metadata: Record<string, unknown>;
  /** Original index in the input list */
  originalIndex: number;
}

/**
 * Configuration for a reranker instance
 */
export interface RerankerConfig {
  /** Reranker type */
  rerankerType: RerankerType;
  /** API key */
  apiKey?: string;
  /** API base URL */
  baseUrl?: string;
  /** Model name */
  model?: string;
  /** Request timeout in seconds */
  timeout: number;
  /** Maximum retry count */
  maxRetries: number;
  /** Batch processing size */
  batchSize: number;
}

/**
 * Default reranker configuration
 */
export const DEFAULT_RERANKER_CONFIG: RerankerConfig = {
  rerankerType: RerankerType.JINA,
  timeout: 30.0,
  maxRetries: 3,
  batchSize: 100,
};

/**
 * Rerank request payload
 */
export interface RerankerRequest {
  /** Query text */
  query: string;
  /** Documents to rerank */
  documents: string[];
  /** Document IDs (1:1 with documents) */
  documentIds?: string[];
  /** Number of top results to return */
  topK: number;
  /** Whether to return document content */
  returnDocuments: boolean;
  /** Document metadata list (1:1 with documents) */
  metadataList?: Record<string, unknown>[];
}

/**
 * Rerank response
 */
export interface RerankerResponse {
  /** Ranked document results */
  results: RankedDocument[];
  /** Model used for reranking */
  modelUsed: string;
  /** Reranker type used */
  rerankerType: RerankerType;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Total number of input documents */
  totalDocuments: number;
}

/**
 * Reranker service error
 */
export class RerankerError extends Error {
  readonly rerankerType?: RerankerType;
  readonly statusCode?: number;

  constructor(
    message: string,
    options?: { rerankerType?: RerankerType; statusCode?: number },
  ) {
    const prefix = options?.rerankerType ? `[${options.rerankerType}]` : '';
    const code = options?.statusCode ? ` (HTTP ${options.statusCode})` : '';
    super(`${prefix}${code} ${message}`);
    this.name = 'RerankerError';
    this.rerankerType = options?.rerankerType;
    this.statusCode = options?.statusCode;
  }
}
