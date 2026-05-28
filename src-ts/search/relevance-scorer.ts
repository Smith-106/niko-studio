/**
 * Search Relevance Scorer
 *
 * Configurable relevance scoring beyond RRF with signal tracking.
 * Applies multiple signals (recency, source authority, query expansion,
 * user selection) to produce a final relevance score from a base score.
 *
 * @module search/relevance-scorer
 */

import { createLogger } from '../logger/index.js';

const _log = createLogger('search-relevance-scorer');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Signals that can influence relevance scoring.
 */
export enum RelevanceSignal {
  RECENCY = 'RECENCY',
  SOURCE_AUTHORITY = 'SOURCE_AUTHORITY',
  QUERY_EXPANSION = 'QUERY_EXPANSION',
  SELECTION = 'SELECTION',
}

/**
 * Configuration for a single signal.
 */
export interface SignalConfig {
  weight: number;
  enabled: boolean;
}

/**
 * Recency boost configuration using exponential decay.
 */
export interface RecencyBoost {
  /** Decay factor applied per half-life interval (0-1, e.g. 0.5) */
  decayFactor: number;
  /** Half-life in milliseconds — results older than this lose half their boost */
  halfLifeMs: number;
}

/**
 * Full scoring configuration.
 */
export interface ScoringConfig {
  /** Per-signal weight and enabled toggle */
  signals: Record<RelevanceSignal, SignalConfig>;
  /** Recency boost parameters (required when RECENCY signal is enabled) */
  recencyBoost?: RecencyBoost;
  /** Authority score per source name (e.g. knowledge=1.0, obsidian=0.8, external=0.6) */
  sourceAuthority?: Record<string, number>;
  /** Maximum expansion terms for query expansion signal (default 3) */
  maxExpansionTerms?: number;
}

/**
 * A search result with base and final relevance scores plus signal breakdown.
 */
export interface ScoredResult {
  id: string;
  content: string;
  source: string;
  /** Score from RRF / base scoring */
  baseScore: number;
  /** Final score after applying all enabled signals */
  relevanceScore: number;
  /** Individual signal contributions keyed by signal name */
  signals: Record<string, number>;
  /** Timestamp of the result (used for recency signal) */
  timestamp?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Public interface for the search relevance scorer.
 */
export interface ISearchRelevanceScorer {
  /**
   * Score results by applying enabled signals to their base scores.
   * Returns a new array sorted by relevanceScore descending.
   */
  score(results: ScoredResult[], query: string, config?: ScoringConfig): ScoredResult[];

  /**
   * Record that a user selected a result for a given query.
   * Selections are stored in memory and boost future scoring via the SELECTION signal.
   */
  recordSelection(resultId: string, query: string): void;

  /**
   * Get selection statistics for all tracked result IDs.
   */
  getSelectionStats(): Record<string, { query: string; selectedCount: number }>;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  signals: {
    [RelevanceSignal.RECENCY]: { weight: 0.2, enabled: true },
    [RelevanceSignal.SOURCE_AUTHORITY]: { weight: 0.3, enabled: true },
    [RelevanceSignal.QUERY_EXPANSION]: { weight: 0.15, enabled: true },
    [RelevanceSignal.SELECTION]: { weight: 0.2, enabled: true },
  },
  recencyBoost: { decayFactor: 0.5, halfLifeMs: 86_400_000 }, // 24h half-life
  sourceAuthority: { knowledge: 1.0, obsidian: 0.8, external: 0.6 },
  maxExpansionTerms: 3,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * In-memory selection tracker.
 */
interface SelectionRecord {
  query: string;
  selectedCount: number;
}

export class SearchRelevanceScorerImpl implements ISearchRelevanceScorer {
  private readonly selectionStore = new Map<string, SelectionRecord>();

  /**
   * Score results by applying each enabled signal with its weight.
   *
   * Formula: relevanceScore = baseScore + sum(weight_i * signalContribution_i)
   *
   * After scoring, results are sorted by relevanceScore descending.
   */
  score(results: ScoredResult[], query: string, config?: ScoringConfig): ScoredResult[] {
    const cfg = config ?? DEFAULT_SCORING_CONFIG;
    const now = Date.now();

    const scored = results.map((result): ScoredResult => {
      const signals: Record<string, number> = {};
      let signalSum = 0;

      // RECENCY: exponential decay based on timestamp freshness
      const recencyCfg = cfg.signals[RelevanceSignal.RECENCY];
      if (recencyCfg.enabled && result.timestamp != null && cfg.recencyBoost) {
        const contribution = this.computeRecency(result.timestamp, now, cfg.recencyBoost);
        signals[RelevanceSignal.RECENCY] = contribution;
        signalSum += recencyCfg.weight * contribution;
      }

      // SOURCE_AUTHORITY: multiply by source authority weight
      const authorityCfg = cfg.signals[RelevanceSignal.SOURCE_AUTHORITY];
      if (authorityCfg.enabled && cfg.sourceAuthority) {
        const contribution = this.computeSourceAuthority(result.source, cfg.sourceAuthority);
        signals[RelevanceSignal.SOURCE_AUTHORITY] = contribution;
        signalSum += authorityCfg.weight * contribution;
      }

      // QUERY_EXPANSION: bonus for results matching expansion terms
      const expansionCfg = cfg.signals[RelevanceSignal.QUERY_EXPANSION];
      if (expansionCfg.enabled) {
        const contribution = this.computeQueryExpansion(
          result.content,
          query,
          cfg.maxExpansionTerms ?? 3,
        );
        signals[RelevanceSignal.QUERY_EXPANSION] = contribution;
        signalSum += expansionCfg.weight * contribution;
      }

      // SELECTION: boost results previously selected for similar queries
      const selectionCfg = cfg.signals[RelevanceSignal.SELECTION];
      if (selectionCfg.enabled) {
        const contribution = this.computeSelection(result.id, query);
        signals[RelevanceSignal.SELECTION] = contribution;
        signalSum += selectionCfg.weight * contribution;
      }

      return {
        ...result,
        relevanceScore: result.baseScore + signalSum,
        signals,
      };
    });

    // Sort by relevanceScore descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scored;
  }

  /**
   * Record a user selection for a result and query.
   */
  recordSelection(resultId: string, query: string): void {
    const existing = this.selectionStore.get(resultId);
    if (existing) {
      existing.selectedCount++;
    } else {
      this.selectionStore.set(resultId, { query, selectedCount: 1 });
    }
  }

  /**
   * Get all selection statistics.
   */
  getSelectionStats(): Record<string, { query: string; selectedCount: number }> {
    const stats: Record<string, { query: string; selectedCount: number }> = {};
    for (const [id, record] of this.selectionStore) {
      stats[id] = { query: record.query, selectedCount: record.selectedCount };
    }
    return stats;
  }

  // -----------------------------------------------------------------------
  // Signal computations
  // -----------------------------------------------------------------------

  /**
   * Recency signal: exponential decay from now.
   * Returns a value in [0, 1] where 1 = just now, decaying over halfLifeMs.
   */
  private computeRecency(
    timestamp: number,
    now: number,
    recencyBoost: RecencyBoost,
  ): number {
    const ageMs = Math.max(0, now - timestamp);
    const halfLives = ageMs / recencyBoost.halfLifeMs;
    return Math.pow(recencyBoost.decayFactor, halfLives);
  }

  /**
   * Source authority signal: returns the authority score for the source.
   * Unknown sources default to 0.5.
   */
  private computeSourceAuthority(
    source: string,
    sourceAuthority: Record<string, number>,
  ): number {
    return sourceAuthority[source] ?? 0.5;
  }

  /**
   * Query expansion signal: bonus for results matching expansion terms.
   *
   * Generates simple expansion terms from the query (lowercased words,
   * common prefixes) and checks how many appear in the result content.
   * Returns the fraction of expansion terms matched, in [0, 1].
   */
  private computeQueryExpansion(
    content: string,
    query: string,
    maxTerms: number,
  ): number {
    const expansionTerms = this.expandQuery(query, maxTerms);
    if (expansionTerms.length === 0) return 0;

    const lowerContent = content.toLowerCase();
    let matched = 0;
    for (const term of expansionTerms) {
      if (lowerContent.includes(term)) {
        matched++;
      }
    }

    return matched / expansionTerms.length;
  }

  /**
   * Selection signal: boost based on how often this result was selected
   * for similar queries.
   *
   * Returns a value in [0, 1] using a saturating function:
   *   1 - 1/(1 + selectedCount)
   * This approaches 1 as selectedCount grows, but never exceeds it.
   */
  private computeSelection(resultId: string, query: string): number {
    const record = this.selectionStore.get(resultId);
    if (!record) return 0;

    // Only boost if the stored query is similar to the current query
    if (!this.queriesSimilar(record.query, query)) return 0;

    return 1 - 1 / (1 + record.selectedCount);
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Generate expansion terms from a query.
   *
   * Strategy: split into lowercase words, then take common prefixes
   * (first 3+ chars) as expansion terms. Limited to maxTerms.
   */
  private expandQuery(query: string, maxTerms: number): string[] {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    const terms: string[] = [];

    // Add full words first
    for (const word of words) {
      if (terms.length >= maxTerms) break;
      if (!terms.includes(word)) {
        terms.push(word);
      }
    }

    // Add common prefixes (min 3 chars) for longer words
    for (const word of words) {
      if (terms.length >= maxTerms) break;
      if (word.length >= 4) {
        const prefix = word.slice(0, Math.min(3, word.length - 1));
        if (!terms.includes(prefix)) {
          terms.push(prefix);
        }
      }
    }

    return terms.slice(0, maxTerms);
  }

  /**
   * Check if two queries are similar enough to share selection signals.
   *
   * Similarity: at least one shared significant word (length >= 2),
   * or one query contains the other.
   */
  private queriesSimilar(a: string, b: string): boolean {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    if (lowerA === lowerB) return true;
    if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) return true;

    const wordsA = new Set(lowerA.split(/\s+/).filter((w) => w.length >= 2));
    const wordsB = lowerB.split(/\s+/).filter((w) => w.length >= 2);
    for (const word of wordsB) {
      if (wordsA.has(word)) return true;
    }

    return false;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new SearchRelevanceScorer instance.
 */
export function createSearchRelevanceScorer(): ISearchRelevanceScorer {
  return new SearchRelevanceScorerImpl();
}
