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
import { SearchStrategyType, type ISearchStrategyConfig, type SearchCascadeStep } from './strategy-config';

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
  strategyConfig?: ISearchStrategyConfig;
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
  private readonly _strategies: readonly StrategyWeight[];
  private readonly rrfK: number;
  private readonly defaultTopK: number;
  private readonly parallelExecution: boolean;
  private readonly _strategyConfig?: ISearchStrategyConfig;

  constructor(config: HybridSearchConfig) {
    if (!config.strategies || config.strategies.length === 0) {
      throw new Error('HybridSearch requires at least one search strategy');
    }

    // Normalize weights to sum to 1.0
    const totalWeight = config.strategies.reduce((sum, s) => sum + s.weight, 0);
    this._strategies = config.strategies.map(s => ({
      ...s,
      weight: s.weight / totalWeight,
    }));

    this.rrfK = config.rrfK ?? 60;
    this.defaultTopK = config.defaultTopK ?? 10;
    this.parallelExecution = config.parallelExecution ?? true;
    this._strategyConfig = config.strategyConfig;
  }

  /**
   * Execute hybrid search combining all strategies.
   *
   * When a strategyConfig is provided, the search follows the cascade order
   * defined in the config. If a cascade step returns fewer results than
   * fallbackThreshold, the next step is invoked. Weights from the cascade
   * steps are used for hybrid scoring.
   *
   * Without a strategyConfig, the existing RRF-based behavior is preserved
   * (backward compatible).
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

    // If strategyConfig is provided, use cascade-driven search
    if (this._strategyConfig) {
      const results = await this.executeCascadeSearch(
        query,
        { topK, typeFilter, minScore },
      );
      return results
        .filter(r => (r.score as number) >= minScore)
        .slice(0, topK)
        .map(r => this.resultToDict(r as unknown as HybridSearchResult));
    }

    // Default: existing RRF-based behavior (backward compatible)
    const results = await this.executeSearches(query, { topK: topK * 2, typeFilter });
    const merged = this.rrfMerge(results);
    const filtered = merged.filter(r => r.score >= minScore);
    return filtered.slice(0, topK).map(r => this.resultToDict(r));
  }

  /**
   * Execute cascade-driven search using strategy config.
   *
   * Walks through cascade steps in order. Each step is mapped to a registered
   * strategy. If a step returns fewer results than fallbackThreshold, the
   * next cascade step is invoked. All gathered results are merged with RRF
   * using the cascade step weights.
   */
  private async executeCascadeSearch(
    query: string,
    options: { topK?: number; typeFilter?: string; minScore?: number },
  ): Promise<Record<string, unknown>[]> {
    const config = this._strategyConfig!;
    const minScore = options.minScore ?? config.minScore;
    const topK = options.topK ?? config.defaultTopK;

    // Map SearchStrategyType to registered strategies
    const strategyMap = new Map<string, StrategyWeight>();
    for (const s of this._strategies) {
      strategyMap.set(s.name, s);
    }

    // Resolve cascade step → strategy mapping
    // LOCAL maps to strategies named "keyword" or "local"
    // SEMANTIC maps to strategies named "semantic" or "vector"
    // EXTERNAL maps to strategies named "external"
    const resolveStrategy = (type: SearchStrategyType): StrategyWeight | null => {
      const nameMap: Record<string, string[]> = {
        [SearchStrategyType.LOCAL]: ['keyword', 'local', 'fuzzy'],
        [SearchStrategyType.SEMANTIC]: ['semantic', 'vector'],
        [SearchStrategyType.EXTERNAL]: ['external', 'elasticsearch'],
      };
      const candidates = nameMap[type] ?? [];
      for (const name of candidates) {
        const found = strategyMap.get(name);
        if (found) return found;
      }
      // Fallback: if no named match, use first strategy
      if (this._strategies.length > 0) return this._strategies[0];
      return null;
    };

    // Execute cascade steps with fallback threshold
    const allResults: Map<string, { weight: number; items: HybridSearchResult[] }> = new Map();
    const executedSteps: SearchCascadeStep[] = [];

    for (const step of config.cascade) {
      const strategy = resolveStrategy(step.strategy);
      if (!strategy) {
        _log.warn(`Cascade step ${step.strategy}: no matching strategy found`);
        continue;
      }

      // Execute with timeout
      const stepResults = await this.executeStepWithTimeout(
        query,
        strategy,
        step,
        { topK: step.topK, typeFilter: options.typeFilter },
      );

      executedSteps.push(step);
      allResults.set(strategy.name, { weight: step.weight, items: stepResults });

      // Check fallback threshold
      if (stepResults.length >= config.fallbackThreshold) {
        // Enough results — skip remaining cascade steps
        break;
      }

      _log.info(`Cascade step ${step.strategy} returned ${stepResults.length} results (threshold: ${config.fallbackThreshold}), invoking next step`);
    }

    // Merge all gathered results using RRF with cascade weights
    const sources: RrfSource[] = [];
    for (const step of executedSteps) {
      const strategy = resolveStrategy(step.strategy);
      if (!strategy) continue;
      const entry = allResults.get(strategy.name);
      if (!entry) continue;

      sources.push({
        name: strategy.name,
        weight: step.weight,
        items: entry.items.map(r => ({ id: r.id, score: r.score })),
      });
    }

    // Normalize weights across executed steps
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    for (const source of sources) {
      source.weight = source.weight / totalWeight;
    }

    const merged = rrfMergeUtil(sources, this.rrfK);

    // Enrich merged results with full data
    const resultMap = new Map<string, HybridSearchResult>();
    for (const [, entry] of allResults) {
      for (const r of entry.items) {
        if (!resultMap.has(r.id)) resultMap.set(r.id, r);
      }
    }

    return merged.map(({ id, score }) => {
      const result = resultMap.get(id);
      if (!result) return { id, score, content: '', type: 'unknown', source: 'hybrid', strategy: 'cascade', metadata: {} };
      return {
        id: result.id,
        content: result.content,
        score,
        type: result.type,
        source: 'hybrid',
        strategy: result.strategy,
        metadata: result.metadata,
        loc: result.loc,
      };
    });
  }

  /**
   * Execute a single cascade step with timeout.
   * If the search exceeds timeoutMs, return empty results.
   */
  private async executeStepWithTimeout(
    query: string,
    strategy: StrategyWeight,
    step: SearchCascadeStep,
    options: { topK?: number; typeFilter?: string },
  ): Promise<HybridSearchResult[]> {
    const timeoutMs = step.timeoutMs;

    const searchPromise = strategy.search.search(query, {
      topK: options.topK ?? step.topK,
      typeFilter: options.typeFilter,
    });

    const timeoutPromise = new Promise<Record<string, unknown>[]>((resolve) => {
      setTimeout(() => resolve([]), timeoutMs);
    });

    const results = await Promise.race([searchPromise, timeoutPromise]);

    return results.map(r => ({
      id: r.id as string,
      content: r.content as string,
      score: (r.score as number) * step.weight,
      type: (r.type as string) ?? 'chunk',
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      source: r.source as string,
      strategy: strategy.name,
      loc: r.loc as HybridSearchResult['loc'],
    }));
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
    const indexPromises = this._strategies.map(async ({ name, search }) => {
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
    const deletePromises = this._strategies.map(async ({ name, search }) => {
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
      const searchPromises = this._strategies.map(async ({ name, search, weight }) => {
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
      for (const { name, search, weight } of this._strategies) {
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
    const sources: RrfSource[] = this._strategies.map((strategy) => ({
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
    for (const strategy of this._strategies) {
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
    return this._strategies.map(s => ({
      name: s.name,
      weight: s.weight,
    }));
  }

  /**
   * Add a new strategy — returns a new HybridSearch instance
   */
  addStrategy(name: string, search: SearchInterface, weight: number): HybridSearch {
    const newStrategies = [...this._strategies, { name, search, weight }];
    const totalWeight = newStrategies.reduce((sum, s) => sum + s.weight, 0);
    const normalized = newStrategies.map(s => ({ ...s, weight: s.weight / totalWeight }));

    return new HybridSearch({
      strategies: normalized,
      rrfK: this.rrfK,
      defaultTopK: this.defaultTopK,
      parallelExecution: this.parallelExecution,
      strategyConfig: this._strategyConfig,
    });
  }

  /**
   * Remove a strategy by name — returns a new HybridSearch instance
   */
  removeStrategy(name: string): HybridSearch | null {
    const remaining = this._strategies.filter(s => s.name !== name);

    if (remaining.length === this._strategies.length) {
      return null; // Strategy not found
    }

    if (remaining.length === 0) {
      return null; // Cannot remove all strategies
    }

    const totalWeight = remaining.reduce((sum, s) => sum + s.weight, 0);
    const normalized = remaining.map(s => ({ ...s, weight: s.weight / totalWeight }));

    return new HybridSearch({
      strategies: normalized,
      rrfK: this.rrfK,
      defaultTopK: this.defaultTopK,
      parallelExecution: this.parallelExecution,
    });
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
