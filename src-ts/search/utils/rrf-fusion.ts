/**
 * RRF (Reciprocal Rank Fusion) utility functions
 *
 * Extracted from HybridSearch.rrfMerge() for reuse across the codebase.
 *
 * RRF Formula:
 *   score = Σ(weight_i / (k + rank_i))
 *   k = 60 (smoothing constant)
 *
 * @module search/utils/rrf-fusion
 */

/** A scored item with an ID for RRF merging */
export interface RrfItem {
  id: string;
  score: number;
  [key: string]: unknown;
}

/** A named source of ranked items for RRF */
export interface RrfSource {
  name: string;
  weight: number;
  items: RrfItem[];
}

/** RRF merge result */
export interface RrfResult {
  id: string;
  score: number;
  sources: string[];
}

/** Default RRF smoothing constant */
export const DEFAULT_RRF_K = 60;

/**
 * Merge multiple ranked sources using Reciprocal Rank Fusion.
 *
 * @param sources - Array of named sources with their items and weights
 * @param k - Smoothing constant (default: 60)
 * @returns Merged results sorted by combined RRF score
 */
export function rrfMerge(
  sources: RrfSource[],
  k: number = DEFAULT_RRF_K,
): RrfResult[] {
  const scores = new Map<string, number>();
  const sourceMap = new Map<string, Set<string>>();

  for (const source of sources) {
    for (let rank = 0; rank < source.items.length; rank++) {
      const item = source.items[rank];
      const rrfScore = source.weight / (k + rank + 1);

      scores.set(item.id, (scores.get(item.id) ?? 0) + rrfScore);

      if (!sourceMap.has(item.id)) {
        sourceMap.set(item.id, new Set());
      }
      sourceMap.get(item.id)!.add(source.name);
    }
  }

  // Sort by combined score descending
  const sorted = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1]);

  return sorted.map(([id, score]) => ({
    id,
    score: Math.round(score * 10000) / 10000,
    sources: Array.from(sourceMap.get(id) ?? []),
  }));
}

/**
 * Compute heat decay score.
 *
 * @param accessCount - Number of times this entity was accessed
 * @param maxAccess - Maximum access count across all entities (for normalization)
 * @param daysSinceLastAccess - Days since last access
 * @param halfLifeDays - Half-life in days (default: 30)
 * @returns Heat score between 0 and 1
 */
export function heatDecayScore(
  accessCount: number,
  maxAccess: number,
  daysSinceLastAccess: number,
  halfLifeDays: number = 30,
): number {
  if (accessCount <= 0) return 0;
  const normalizedCount = Math.min(1.0, accessCount / Math.max(maxAccess, 1));
  const timeDecay = Math.exp(-daysSinceLastAccess / halfLifeDays);
  return normalizedCount * timeDecay;
}
