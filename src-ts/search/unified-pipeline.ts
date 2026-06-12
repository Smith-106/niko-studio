/**
 * Unified Search Pipeline
 *
 * Coordination layer above all search backends.  Invokes backends according to
 * the cascade defined in the strategy config, normalises results to a common
 * `RankedSearchResult` shape, deduplicates by content hash, and applies RRF
 * (Reciprocal Rank Fusion) scoring across backends.
 *
 * Does NOT replace existing search services — they remain independently usable.
 *
 * @module search/unified-pipeline
 */

import { createHash } from 'node:crypto';
import { rrfMerge, type RrfSource, DEFAULT_RRF_K } from './utils/rrf-fusion';
import {
  SearchStrategyType,
  DEFAULT_STRATEGY_CONFIG,
  type ISearchStrategyConfig,
  type SearchCascadeStep,
} from './strategy-config';
import type {
  IKnowledgeService,
  ISmartSearch,
  IHybridSearch,
  IVectorSearch,
  IObsidianService,
} from '../container/types';
import { createLogger } from '../logger/index.js';

const _log = createLogger('search-unified-pipeline');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Normalised search result with source attribution.
 */
export interface RankedSearchResult {
  /** Result content text */
  content: string;
  /** Which backend produced this result (e.g. 'knowledge', 'smart-search', 'vector', 'obsidian') */
  source: string;
  /** Normalised score 0–1 */
  score: number;
  /** Source-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Options accepted by the unified search pipeline.
 */
export interface UnifiedSearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Which backend types to include in the search */
  sources?: SearchStrategyType[];
  /** Scope search to a specific workflow phase */
  phase?: string;
  /** Override the default cascade strategy */
  strategyConfig?: ISearchStrategyConfig;
}

/**
 * Unified search result returned to callers.
 */
export interface UnifiedSearchResult {
  /** Merged and ranked results */
  results: RankedSearchResult[];
  /** How many results came from each backend */
  sources: Record<string, number>;
  /** Original query string */
  query: string;
  /** Total results before dedup */
  total: number;
  /** How many duplicates were removed */
  dedupRemoved: number;
}

/**
 * Public interface for the unified search pipeline.
 */
export interface IUnifiedSearchPipeline {
  search(query: string, options?: UnifiedSearchOptions): Promise<UnifiedSearchResult>;
  searchByPhase(query: string, phase: string, options?: UnifiedSearchOptions): Promise<UnifiedSearchResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEDUP_HASH_CHARS = 200;

/**
 * Hash the first `n` characters of content for dedup.
 */
function contentHash(content: string, n: number = DEDUP_HASH_CHARS): string {
  const slice = content.slice(0, n);
  return createHash('sha256').update(slice, 'utf-8').digest('hex');
}

/**
 * Clamp a raw score into [0, 1].
 */
function normaliseScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Backend → RankedSearchResult normalisers
// ---------------------------------------------------------------------------

/**
 * Each backend returns its own shape; these normalisers convert to the
 * common `RankedSearchResult` format.
 */

function normaliseKnowledge(raw: unknown[]): RankedSearchResult[] {
  return raw.map((item): RankedSearchResult => {
    const r = item as Record<string, unknown>;
    return {
      content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
      source: 'knowledge',
      score: normaliseScore(typeof r.score === 'number' ? r.score : 0),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  });
}

function normaliseSmartSearch(raw: unknown[]): RankedSearchResult[] {
  return raw.map((item): RankedSearchResult => {
    const r = item as Record<string, unknown>;
    return {
      content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
      source: 'smart-search',
      score: normaliseScore(typeof r.score === 'number' ? r.score : 0),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  });
}

function normaliseVector(raw: unknown[]): RankedSearchResult[] {
  return raw.map((item): RankedSearchResult => {
    const r = item as Record<string, unknown>;
    return {
      content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
      source: 'vector',
      score: normaliseScore(typeof r.score === 'number' ? r.score : 0),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  });
}

function normaliseObsidian(raw: unknown[]): RankedSearchResult[] {
  return raw.map((item): RankedSearchResult => {
    const r = item as Record<string, unknown>;
    return {
      content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
      source: 'obsidian',
      score: normaliseScore(typeof r.score === 'number' ? r.score : 0),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
    };
  });
}

// ---------------------------------------------------------------------------
// Pipeline Implementation
// ---------------------------------------------------------------------------

export interface UnifiedPipelineDeps {
  knowledgeService: IKnowledgeService;
  smartSearch: ISmartSearch;
  hybridSearch: IHybridSearch;
  vectorSearch: IVectorSearch;
  obsidianService: IObsidianService;
  strategyConfig?: ISearchStrategyConfig;
}

export class UnifiedSearchPipeline implements IUnifiedSearchPipeline {
  private readonly deps: UnifiedPipelineDeps;
  private readonly defaultConfig: ISearchStrategyConfig;

  constructor(deps: UnifiedPipelineDeps) {
    this.deps = deps;
    this.defaultConfig = deps.strategyConfig ?? DEFAULT_STRATEGY_CONFIG;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async search(
    query: string,
    options?: UnifiedSearchOptions,
  ): Promise<UnifiedSearchResult> {
    return this.executeSearch(query, options);
  }

  async searchByPhase(
    query: string,
    phase: string,
    options?: UnifiedSearchOptions,
  ): Promise<UnifiedSearchResult> {
    return this.executeSearch(query, { ...options, phase });
  }

  // -----------------------------------------------------------------------
  // Core pipeline
  // -----------------------------------------------------------------------

  private async executeSearch(
    query: string,
    options?: UnifiedSearchOptions,
  ): Promise<UnifiedSearchResult> {
    const config = options?.strategyConfig ?? this.defaultConfig;
    const topK = options?.topK ?? config.defaultTopK;
    const allowedSources = options?.sources;
    const phase = options?.phase;

    // 1. Resolve which cascade steps to execute
    const steps = this.resolveSteps(config, allowedSources);

    // 2. Execute backends in cascade order
    const backendResults = await this.executeCascade(query, steps, config, phase);

    // 3. Collect all normalised results with backend attribution
    const allResults: RankedSearchResult[] = [];
    const sourceCounts: Record<string, number> = {};

    for (const { backend, results } of backendResults) {
      sourceCounts[backend] = results.length;
      allResults.push(...results);
    }

    const totalBeforeDedup = allResults.length;

    // 4. Dedup by content hash (first 200 chars)
    const deduped = this.dedup(allResults);

    // 5. RRF fusion across backends
    const ranked = this.fuse(deduped, steps);

    // 6. Return top-K
    const finalResults = ranked.slice(0, topK);

    return {
      results: finalResults,
      sources: sourceCounts,
      query,
      total: totalBeforeDedup,
      dedupRemoved: totalBeforeDedup - deduped.length,
    };
  }

  // -----------------------------------------------------------------------
  // Step resolution
  // -----------------------------------------------------------------------

  private resolveSteps(
    config: ISearchStrategyConfig,
    allowedSources?: SearchStrategyType[],
  ): SearchCascadeStep[] {
    if (!allowedSources || allowedSources.length === 0) {
      return [...config.cascade];
    }
    return config.cascade.filter((step) =>
      allowedSources.includes(step.strategy),
    );
  }

  // -----------------------------------------------------------------------
  // Cascade execution
  // -----------------------------------------------------------------------

  private async executeCascade(
    query: string,
    steps: SearchCascadeStep[],
    config: ISearchStrategyConfig,
    phase?: string,
  ): Promise<Array<{ backend: string; results: RankedSearchResult[] }>> {
    const results: Array<{ backend: string; results: RankedSearchResult[] }> = [];

    for (const step of steps) {
      const stepResults = await this.invokeBackend(
        query,
        step,
        config,
        phase,
      );
      results.push({ backend: this.backendName(step.strategy), results: stepResults });

      // Fallback: if this step returned enough results, skip remaining steps
      if (stepResults.length >= config.fallbackThreshold) {
        break;
      }

      _log.info(
        `Cascade step ${step.strategy} returned ${stepResults.length} results ` +
        `(threshold: ${config.fallbackThreshold}), invoking next step`,
      );
    }

    return results;
  }

  /**
   * Map a SearchStrategyType to the backend name used in source attribution.
   */
  private backendName(strategy: SearchStrategyType): string {
    switch (strategy) {
      case SearchStrategyType.LOCAL:
        return 'knowledge';
      case SearchStrategyType.SEMANTIC:
        return 'vector';
      case SearchStrategyType.EXTERNAL:
        return 'obsidian';
      default:
        return String(strategy);
    }
  }

  /**
   * Invoke the appropriate backend for a cascade step.
   * Each backend call is guarded with a timeout derived from the step config.
   */
  private async invokeBackend(
    query: string,
    step: SearchCascadeStep,
    config: ISearchStrategyConfig,
    phase?: string,
  ): Promise<RankedSearchResult[]> {
    const searchPromise = this.doBackendCall(query, step, config, phase);
    const timeoutPromise = new Promise<RankedSearchResult[]>((resolve) =>
      setTimeout(() => resolve([]), step.timeoutMs),
    );

    return Promise.race([searchPromise, timeoutPromise]);
  }

  private async doBackendCall(
    query: string,
    step: SearchCascadeStep,
    config: ISearchStrategyConfig,
    phase?: string,
  ): Promise<RankedSearchResult[]> {
    try {
      switch (step.strategy) {
        case SearchStrategyType.LOCAL: {
          const raw = await this.deps.knowledgeService.search(query, {
            topK: step.topK,
          });
          return normaliseKnowledge(Array.isArray(raw) ? raw : []);
        }

        case SearchStrategyType.SEMANTIC: {
          // Prefer vector search; fall back to smart-search hybrid
          const raw = await this.deps.vectorSearch.search(query, {
            topK: step.topK,
          });
          const vectorResults = normaliseVector(Array.isArray(raw) ? raw : []);

          if (vectorResults.length >= config.fallbackThreshold) {
            return vectorResults;
          }

          // Supplement with smart-search
          const smartRaw = await this.deps.smartSearch.search(query, {
            mode: 'hybrid',
            topK: step.topK,
          });
          const smartResults = normaliseSmartSearch(Array.isArray(smartRaw) ? smartRaw : []);

          return [...vectorResults, ...smartResults];
        }

        case SearchStrategyType.EXTERNAL: {
          // Use obsidian sync results as the "external" source
          // Note: IObsidianService doesn't have a search method directly,
          // so we use hybrid search as the external delegate
          const raw = await this.deps.hybridSearch.search(query, {
            strategies: ['keyword', 'semantic'],
            topK: step.topK,
          });
          return normaliseObsidian(Array.isArray(raw) ? raw : []);
        }

        default:
          _log.warn(`Unknown strategy type: ${String(step.strategy)}`);
          return [];
      }
    } catch (error) {
      _log.error(`Backend ${String(step.strategy)} search failed`, { detail: error });
      return [];
    }
  }

  // -----------------------------------------------------------------------
  // Deduplication
  // -----------------------------------------------------------------------

  /**
   * Deduplicate results by content hash (first 200 chars).
   * When duplicates are found, keep the one with the higher score.
   */
  private dedup(results: RankedSearchResult[]): RankedSearchResult[] {
    const bestByHash = new Map<string, RankedSearchResult>();

    for (const r of results) {
      const hash = contentHash(r.content);
      const existing = bestByHash.get(hash);
      if (!existing || r.score > existing.score) {
        bestByHash.set(hash, r);
      }
    }

    return Array.from(bestByHash.values());
  }

  // -----------------------------------------------------------------------
  // RRF Fusion
  // -----------------------------------------------------------------------

  /**
   * Apply RRF fusion across backends.
   *
   * For each backend, results are ranked by their existing score.  The RRF
   * formula computes: score = sum(1/(k+rank)) for each backend where the
   * result appears.  The step weight is applied as a multiplier.
   *
   * After fusion, the score is normalised back to [0, 1].
   */
  private fuse(
    results: RankedSearchResult[],
    steps: SearchCascadeStep[],
  ): RankedSearchResult[] {
    // Group results by source backend
    const bySource = new Map<string, RankedSearchResult[]>();
    for (const r of results) {
      const list = bySource.get(r.source) ?? [];
      list.push(r);
      bySource.set(r.source, list);
    }

    // Build weight map from cascade steps
    const weightMap = new Map<string, number>();
    for (const step of steps) {
      const name = this.backendName(step.strategy);
      if (!weightMap.has(name)) {
        weightMap.set(name, step.weight);
      }
      if (step.strategy === SearchStrategyType.SEMANTIC && !weightMap.has('smart-search')) {
        weightMap.set('smart-search', step.weight);
      }
      if (step.strategy === SearchStrategyType.EXTERNAL && !weightMap.has('hybrid')) {
        weightMap.set('hybrid', step.weight);
      }
    }

    // Build RRF sources — rank items by score within each source
    const sources: RrfSource[] = [];
    for (const [sourceName, items] of bySource) {
      // Sort by score descending to establish rank
      const sorted = [...items].sort((a, b) => b.score - a.score);
      const weight = weightMap.get(sourceName) ?? 1;

      sources.push({
        name: sourceName,
        weight,
        items: sorted.map((r, idx) => ({
          id: contentHash(r.content),
          score: r.score,
          _rank: idx, // track original rank for RRF
        })),
      });
    }

    // Normalise weights across sources
    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight > 0) {
      for (const s of sources) {
        s.weight = s.weight / totalWeight;
      }
    }

    // Run RRF merge
    const merged = rrfMerge(sources, DEFAULT_RRF_K);

    // Build a lookup: contentHash → RankedSearchResult (best one)
    const resultMap = new Map<string, RankedSearchResult>();
    for (const r of results) {
      const hash = contentHash(r.content);
      if (!resultMap.has(hash) || r.score > resultMap.get(hash)!.score) {
        resultMap.set(hash, r);
      }
    }

    // Find max RRF score for normalisation
    const maxRrf = merged.length > 0 ? merged[0].score : 1;

    // Assemble final ranked list
    return merged.map(({ id, score }) => {
      const result = resultMap.get(id);
      if (!result) {
        // Should not happen, but defensive
        return {
          content: '',
          source: 'unknown',
          score: 0,
          metadata: {},
        } satisfies RankedSearchResult;
      }
      return {
        content: result.content,
        source: result.source,
        // Normalise RRF score back to [0, 1]
        score: maxRrf > 0 ? normaliseScore(score / maxRrf) : 0,
        metadata: result.metadata,
      } satisfies RankedSearchResult;
    });
  }
}
