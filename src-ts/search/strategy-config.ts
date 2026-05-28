/**
 * Search Strategy Configuration
 *
 * Defines hybrid search strategy types, cascade steps, and predefined profiles.
 * When a strategyConfig is provided to HybridSearch, it drives the cascade
 * order, weights, and fallback behavior. Without it, HybridSearch uses its
 * existing RRF-based strategy (backward compatible).
 *
 * @module search/strategy-config
 */

import { createLogger } from '../logger/index.js';

const _log = createLogger('search-strategy-config');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The type of search strategy a cascade step uses.
 */
export enum SearchStrategyType {
  LOCAL = 'local',
  SEMANTIC = 'semantic',
  EXTERNAL = 'external',
}

/**
 * A single step in the search cascade.
 * Steps are tried in order; if a step returns fewer results than
 * `fallbackThreshold`, the next step is invoked.
 */
export interface SearchCascadeStep {
  /** Which strategy this step invokes */
  strategy: SearchStrategyType;
  /** Weight in hybrid scoring (0-1). Normalized across cascade at runtime */
  weight: number;
  /** Number of results to request from this strategy */
  topK: number;
  /** Max wait time in milliseconds for this strategy */
  timeoutMs: number;
}

/**
 * Full strategy configuration profile.
 */
export interface ISearchStrategyConfig {
  /** Config profile name (e.g. "PRECISE", "BROAD", "FAST") */
  name: string;
  /** Ordered list of search strategies to try */
  cascade: SearchCascadeStep[];
  /** Default number of results to return */
  defaultTopK: number;
  /** Minimum relevance score threshold (0-1) */
  minScore: number;
  /** If a cascade step returns fewer results than this, try next step */
  fallbackThreshold: number;
}

// ---------------------------------------------------------------------------
// Predefined Profiles
// ---------------------------------------------------------------------------

/**
 * Predefined search profiles for common use-cases.
 */
export const SearchProfile: Record<string, ISearchStrategyConfig> = {
  /**
   * PRECISE: local first, semantic second, no external.
   * Best for exact matches, code lookups, symbol resolution.
   */
  PRECISE: {
    name: 'PRECISE',
    cascade: [
      { strategy: SearchStrategyType.LOCAL, weight: 0.7, topK: 20, timeoutMs: 500 },
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.3, topK: 10, timeoutMs: 2000 },
    ],
    defaultTopK: 10,
    minScore: 0.3,
    fallbackThreshold: 5,
  },

  /**
   * BROAD: semantic first, local second, external third.
   * Best for discovery, exploration, and open-ended queries.
   */
  BROAD: {
    name: 'BROAD',
    cascade: [
      { strategy: SearchStrategyType.SEMANTIC, weight: 0.5, topK: 20, timeoutMs: 2000 },
      { strategy: SearchStrategyType.LOCAL, weight: 0.3, topK: 15, timeoutMs: 500 },
      { strategy: SearchStrategyType.EXTERNAL, weight: 0.2, topK: 10, timeoutMs: 5000 },
    ],
    defaultTopK: 15,
    minScore: 0.15,
    fallbackThreshold: 3,
  },

  /**
   * FAST: local only, no fallback.
   * Best for quick lookups where latency matters more than recall.
   */
  FAST: {
    name: 'FAST',
    cascade: [
      { strategy: SearchStrategyType.LOCAL, weight: 1.0, topK: 10, timeoutMs: 200 },
    ],
    defaultTopK: 5,
    minScore: 0.2,
    fallbackThreshold: 0,
  },
} as const;

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

/**
 * Default strategy configuration — uses BROAD profile.
 */
export const DEFAULT_STRATEGY_CONFIG: ISearchStrategyConfig =
  SearchProfile.BROAD;