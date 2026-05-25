/**
 * HybridSearch TypeScript Implementation
 *
 * Migrated from src/search/hybrid_search.py (conceptual migration)
 *
 * Features:
 * - Combines multiple search strategies (keyword, semantic, vector)
 * - Configurable weights for each strategy
 * - RRF (Reciprocal Rank Fusion) for result merging
 * - Strategy composition pattern
 * - Async parallel search execution
 */

import type { SearchInterface } from '../protocols/search';
import { rrfMerge as rrfMergeUtil, type RrfSource } from './utils/rrf-fusion';
import { createLogger } from '../logger/index.js';

const _log = createLogger('search-hybrid');

/**
 * Search strategy weight configuration
 */
export interface StrategyWeight {
  name: string;
  weight: number;
  search: SearchInterface;
}

/**
 * Hybrid search configuration
 */
export interface HybridSearchConfig {
  strategies: StrategyWeight[];
  rrfK?: number;
  defaultTopK?: number;
  parallelExecution?: boolean;
}

/**
 * Hybrid search result with source tracking
 */
export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  type: string;
  metadata: Record<string, unknown>;
  source: string;
  strategy: string;
  loc?: {
    kind: 'line' | 'char' | 'range';
    start: number;
    end?: number;
  };
}

/**
 * Hybrid Search Service
 *
 * Combines multiple search strategies with configurable weights.
 * Uses RRF (Reciprocal Rank Fusion) to merge results from different backends.
 *
 * Strategy types:
 * - Keyword/Fuzzy: FTS5, LIKE, ripgrep
 * - Semantic: Vector embeddings with similarity search
 * - Vector: Dense vector search
 * - Custom: Any SearchInterface implementation
 *
 * RRF Formula:
 *   score = weight / (k + rank)
 * where k is the RRF constant (default 60)
 */
export class HybridSearch implements SearchInterface {
  private readonly strategies: StrategyWeight[];
  private readonly rrfK: number;
  private readonly defaultTopK: number;
  private readonly parallelExecution: boolean;

  constructor(config: HybridSearchConfig) {
    if (!config.strategies || config.strategies.length === 0) {
      throw new Error('HybridSearch requires at least one search strategy');
    }

    // Normalize weights to sum to 1.0
    const totalWeight = config.strategies.reduce((sum, s) => sum + s.weight, 0);
    this.strategies = config.strategies.map(s => ({
      ...s,
      weight: s.weight / totalWeight,
    }));

    this.rrfK = config.rrfK ?? 60;
    this.defaultTopK = config.defaultTopK ?? 10;
    this.parallelExecution = config.parallelExecution ?? true;
  }

  /**
   * Execute hybrid search combining all strategies
   */
  async search(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
      minScore?: number;
    }
  ): Promise<Record<string, unknown>[]> {
    const topK = options?.topK ?? this.defaultTopK;
    const typeFilter = options?.typeFilter;
    const minScore = options?.minScore ?? 0.0;

    // Execute searches (parallel or sequential)
    const results = await this.executeSearches(query, { topK: topK * 2, typeFilter });

    // RRF Fusion
    const merged = this.rrfMerge(results);

    // Apply min_score filter and limit
    const filtered = merged.filter(r => r.score >= minScore);

    return filtered.slice(0, topK).map(r => this.resultToDict(r));
  }

  /**
   * Index document to all strategies
   */
  async index(
    id: string,
    content: string,
    options?: {
      metadata?: Record<string, unknown>;
      type?: string;
    }
  ): Promise<void> {
    // Index to all strategies
    const indexPromises = this.strategies.map(async ({ name, search }) => {
      try {
        await search.index(id, content, options);
      } catch (error) {
        _log.error(`Failed to index to strategy ${name}`, { detail: error });
      }
    });

    await Promise.all(indexPromises);
  }

  /**
   * Delete document from all strategies
   */
  async delete(id: string): Promise<boolean> {
    // Delete from all strategies
    const deletePromises = this.strategies.map(async ({ name, search }) => {
      try {
        return await search.delete(id);
      } catch (error) {
        _log.error(`Failed to delete from strategy ${name}`, { detail: error });
        return false;
      }
    });

    const results = await Promise.all(deletePromises);
    // Return true if at least one strategy succeeded
    return results.some(r => r);
  }

  /**
   * Execute searches from all strategies
   */
  private async executeSearches(
    query: string,
    options: { topK?: number; typeFilter?: string }
  ): Promise<Map<string, HybridSearchResult[]>> {
    const resultsByStrategy = new Map<string, HybridSearchResult[]>();

    if (this.parallelExecution) {
      // Parallel execution — snapshot strategies to avoid concurrent mutation
      const currentStrategies = [...this.strategies];
      const searchPromises = currentStrategies.map(async ({ name, search, weight }) => {
        try {
          const searchOptions = {
            topK: options.topK,
            typeFilter: options.typeFilter,
          };

          const results = await search.search(query, searchOptions);

          // Add strategy metadata
          const hybridResults: HybridSearchResult[] = results.map(r => ({
            id: r.id as string,
            content: r.content as string,
            score: (r.score as number) * weight,
            type: (r.type as string) ?? 'chunk',
            metadata: (r.metadata as Record<string, unknown>) ?? {},
            source: r.source as string,
            strategy: name,
            loc: r.loc as HybridSearchResult['loc'],
          }));

          return { name, results: hybridResults };
        } catch (error) {
          _log.error(`Strategy ${name} search failed`, { detail: error });
          return { name, results: [] };
        }
      });

      const allResults = await Promise.all(searchPromises);
      for (const { name, results } of allResults) {
        resultsByStrategy.set(name, results);
      }
    } else {
      // Sequential execution
      for (const { name, search, weight } of this.strategies) {
        try {
          const searchOptions = {
            topK: options.topK,
            typeFilter: options.typeFilter,
          };

          const results = await search.search(query, searchOptions);

          // Add strategy metadata
          const hybridResults: HybridSearchResult[] = results.map(r => ({
            id: r.id as string,
            content: r.content as string,
            score: (r.score as number) * weight,
            type: (r.type as string) ?? 'chunk',
            metadata: (r.metadata as Record<string, unknown>) ?? {},
            source: r.source as string,
            strategy: name,
            loc: r.loc as HybridSearchResult['loc'],
          }));

          resultsByStrategy.set(name, hybridResults);
        } catch (error) {
          _log.error(`Strategy ${name} search failed`, { detail: error });
          resultsByStrategy.set(name, []);
        }
      }
    }

    return resultsByStrategy;
  }

  /**
   * Reciprocal Rank Fusion to merge results
   *
   * Delegates to the shared rrfMerge utility in ./utils/rrf-fusion.ts
   */
  private rrfMerge(
    resultsByStrategy: Map<string, HybridSearchResult[]>
  ): HybridSearchResult[] {
    // Convert strategy results to RrfSource format
    const sources: RrfSource[] = this.strategies.map((strategy) => ({
      name: strategy.name,
      weight: strategy.weight,
      items: (resultsByStrategy.get(strategy.name) ?? []).map((r) => ({
        id: r.id,
        score: r.score,
      })),
    }));

    const merged = rrfMergeUtil(sources, this.rrfK);

    // Build id→result lookup for enrichment
    const resultMap = new Map<string, HybridSearchResult>();
    for (const strategy of this.strategies) {
      for (const r of resultsByStrategy.get(strategy.name) ?? []) {
        if (!resultMap.has(r.id)) resultMap.set(r.id, r);
      }
    }

    const results: HybridSearchResult[] = [];
    for (const { id, score } of merged) {
      const result = resultMap.get(id);
      if (!result) continue;
      results.push({
        id: result.id,
        content: result.content,
        score,
        type: result.type,
        metadata: result.metadata,
        source: 'hybrid',
        strategy: result.strategy,
        loc: result.loc,
      });
    }
    return results;
  }

  /**
   * Convert result to dictionary format
   */
  private resultToDict(result: HybridSearchResult): Record<string, unknown> {
    return {
      id: result.id,
      content: result.content,
      score: Math.round(result.score * 10000) / 10000, // Round to 4 decimals
      type: result.type,
      source: result.source,
      strategy: result.strategy,
      metadata: result.metadata,
      loc: result.loc,
    };
  }

  /**
   * Get strategy statistics
   */
  getStrategyStats(): Array<{ name: string; weight: number }> {
    return this.strategies.map(s => ({
      name: s.name,
      weight: s.weight,
    }));
  }

  /**
   * Add a new strategy dynamically
   */
  addStrategy(name: string, search: SearchInterface, weight: number): void {
    // Normalize weights
    const totalWeight = this.strategies.reduce((sum, s) => sum + s.weight, 0) + weight;
    
    this.strategies.forEach(s => {
      s.weight = s.weight / totalWeight;
    });

    this.strategies.push({
      name,
      search,
      weight: weight / totalWeight,
    });
  }

  /**
   * Remove a strategy by name
   */
  removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex(s => s.name === name);
    
    if (index === -1) {
      return false;
    }

    this.strategies.splice(index, 1);

    // Renormalize weights
    if (this.strategies.length > 0) {
      const totalWeight = this.strategies.reduce((sum, s) => sum + s.weight, 0);
      this.strategies.forEach(s => {
        s.weight = s.weight / totalWeight;
      });
    }

    return true;
  }
}

/**
 * Factory function to create HybridSearch instance
 */
export function createHybridSearch(config: HybridSearchConfig): HybridSearch {
  return new HybridSearch(config);
}

/**
 * Builder pattern for HybridSearch configuration
 */
export class HybridSearchBuilder {
  private strategies: StrategyWeight[] = [];
  private rrfK?: number;
  private defaultTopK?: number;
  private parallelExecution?: boolean;

  /**
   * Add a search strategy
   */
  addStrategy(name: string, search: SearchInterface, weight: number): this {
    this.strategies.push({ name, search, weight });
    return this;
  }

  /**
   * Set RRF constant
   */
  setRrfK(k: number): this {
    this.rrfK = k;
    return this;
  }

  /**
   * Set default topK
   */
  setDefaultTopK(topK: number): this {
    this.defaultTopK = topK;
    return this;
  }

  /**
   * Enable/disable parallel execution
   */
  setParallelExecution(enabled: boolean): this {
    this.parallelExecution = enabled;
    return this;
  }

  /**
   * Build HybridSearch instance
   */
  build(): HybridSearch {
    return new HybridSearch({
      strategies: this.strategies,
      rrfK: this.rrfK,
      defaultTopK: this.defaultTopK,
      parallelExecution: this.parallelExecution,
    });
  }
}

/**
 * Predefined strategy configurations
 */
export const StrategyPresets = {
  /**
   * Balanced hybrid: 50% keyword + 50% semantic
   */
  balanced: (keyword: SearchInterface, semantic: SearchInterface): HybridSearchConfig => ({
    strategies: [
      { name: 'keyword', search: keyword, weight: 0.5 },
      { name: 'semantic', search: semantic, weight: 0.5 },
    ],
  }),

  /**
   * Semantic-first: 70% semantic + 30% keyword
   */
  semanticFirst: (keyword: SearchInterface, semantic: SearchInterface): HybridSearchConfig => ({
    strategies: [
      { name: 'keyword', search: keyword, weight: 0.3 },
      { name: 'semantic', search: semantic, weight: 0.7 },
    ],
  }),

  /**
   * Keyword-first: 70% keyword + 30% semantic
   */
  keywordFirst: (keyword: SearchInterface, semantic: SearchInterface): HybridSearchConfig => ({
    strategies: [
      { name: 'keyword', search: keyword, weight: 0.7 },
      { name: 'semantic', search: semantic, weight: 0.3 },
    ],
  }),

  /**
   * Multi-strategy: keyword + semantic + vector
   */
  multiStrategy: (
    keyword: SearchInterface,
    semantic: SearchInterface,
    vector: SearchInterface
  ): HybridSearchConfig => ({
    strategies: [
      { name: 'keyword', search: keyword, weight: 0.3 },
      { name: 'semantic', search: semantic, weight: 0.4 },
      { name: 'vector', search: vector, weight: 0.3 },
    ],
  }),
};
