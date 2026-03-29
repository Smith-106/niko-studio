/**
 * RerankerStrategy - Abstract base class for reranker implementations
 *
 * Migrated from src/services/reranker/base.py.
 * Defines the unified interface for all reranker strategies.
 */

import type { RankedDocument, RerankerConfig } from './models';
import { RerankerType } from './models';

/**
 * Abstract base class for reranker strategies.
 * All reranker implementations must extend this class and implement the rerank method.
 */
export abstract class RerankerStrategy {
  protected readonly _config: RerankerConfig;

  constructor(config: RerankerConfig) {
    this._config = config;
  }

  /** Returns the reranker type */
  abstract get rerankerType(): RerankerType;

  /** Returns the configuration */
  get config(): RerankerConfig {
    return this._config;
  }

  /**
   * Rerank documents by relevance to a query
   *
   * @param query - Query text
   * @param documents - Documents to rerank
   * @param topK - Number of top results to return
   * @param options - Optional document IDs and metadata
   * @returns Ranked documents sorted by relevance (descending)
   */
  abstract rerank(
    query: string,
    documents: string[],
    topK?: number,
    options?: {
      documentIds?: string[];
      metadataList?: Record<string, unknown>[];
    },
  ): Promise<RankedDocument[]>;

  /**
   * Check if the reranker service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const results = await this.rerank('test', ['test document'], 1);
      return results.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Build a list of RankedDocument from scores and indices
   */
  protected buildRankedDocuments(
    documents: string[],
    scores: number[],
    indices: number[],
    topK: number,
    documentIds?: string[],
    metadataList?: Record<string, unknown>[],
  ): RankedDocument[] {
    const results: RankedDocument[] = [];

    for (let i = 0; i < scores.length && i < topK; i++) {
      const score = scores[i];
      const idx = indices[i];

      const docId = documentIds?.[idx] ?? `doc_${idx}`;
      const metadata = metadataList?.[idx] ?? {};

      results.push({
        id: docId,
        content: documents[idx],
        score,
        metadata,
        originalIndex: idx,
      });
    }

    return results;
  }

  /**
   * Clean up resources (override in subclasses that maintain HTTP clients)
   */
  async close(): Promise<void> {
    // Default: no-op
  }
}
