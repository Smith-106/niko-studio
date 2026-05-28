import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SearchRelevanceScorerImpl,
  RelevanceSignal,
  DEFAULT_SCORING_CONFIG,
} from '../../search/relevance-scorer.js';
import type { ScoredResult, ScoringConfig } from '../../search/relevance-scorer.js';
import {
  SearchCacheManagerImpl,
  DEFAULT_CACHE_CONFIG,
} from '../../search/cache-manager.js';
import type { CachedSearchResult, CacheConfig } from '../../search/cache-manager.js';
import { TypedEventBus } from '../../services/event-bus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScoredResult(overrides: Partial<ScoredResult> = {}): ScoredResult {
  return {
    id: `result-${Math.random().toString(36).slice(2, 8)}`,
    content: 'Some content about TypeScript patterns',
    source: 'knowledge',
    baseScore: 0.5,
    relevanceScore: 0,
    signals: {},
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeResults(count: number, overrides: Partial<ScoredResult> = {}): ScoredResult[] {
  return Array.from({ length: count }, (_, i) =>
    makeScoredResult({ id: `r-${i}`, baseScore: 0.5 - i * 0.05, ...overrides }),
  );
}

function makeCachedResult(query: string, results: ScoredResult[], sources?: string[]): CachedSearchResult {
  // Derive sources from result source fields if not explicitly provided
  const derivedSources = sources ?? [...new Set(results.map((r) => r.source))];
  return {
    query,
    results,
    sources: derivedSources,
    cachedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };
}

// ---------------------------------------------------------------------------
// Test Suite: Relevance Scoring + Cache Invalidation
// ---------------------------------------------------------------------------

describe('Integration: Search pipeline with relevance scoring + cache invalidation', () => {
  let scorer: SearchRelevanceScorerImpl;
  let cacheManager: SearchCacheManagerImpl;
  let eventBus: TypedEventBus;

  beforeEach(() => {
    eventBus = new TypedEventBus();
    scorer = new SearchRelevanceScorerImpl();
    cacheManager = new SearchCacheManagerImpl(
      { maxSize: 100, ttlMs: 500 },
      eventBus,
    );
  });

  afterEach(() => {
    cacheManager.dispose();
  });

  // -------------------------------------------------------------------------
  // Relevance scoring
  // -------------------------------------------------------------------------

  it('score results with recency + authority signals → verify ranking changes', () => {
    // Two results: one recent but low authority, one old but high authority
    const recentLowAuth = makeScoredResult({
      id: 'recent-low',
      timestamp: Date.now(),
      source: 'external', // external authority = 0.6 in default config
      baseScore: 0.5,
    });
    const oldHighAuth = makeScoredResult({
      id: 'old-high',
      timestamp: Date.now() - 7 * 24 * 3600 * 1000, // 7 days ago
      source: 'knowledge', // knowledge authority = 1.0 in default config
      baseScore: 0.5,
    });

    const results = [recentLowAuth, oldHighAuth];
    const scored = scorer.score(results, 'test query');

    // Both should have different final scores from the base 0.5
    expect(scored[0].relevanceScore).not.toBe(0.5);
    expect(scored[1].relevanceScore).not.toBe(0.5);

    // Results should be sorted by relevanceScore descending
    expect(scored[0].relevanceScore).toBeGreaterThanOrEqual(scored[1].relevanceScore);

    // Both results should have SIGNAL_SOURCE_AUTHORITY contribution
    expect(scored[0].signals[RelevanceSignal.SOURCE_AUTHORITY]).toBeDefined();
    expect(scored[1].signals[RelevanceSignal.SOURCE_AUTHORITY]).toBeDefined();
  });

  it('record selection → verify selection signal boosts similar future results', () => {
    const target = makeScoredResult({
      id: 'target',
      content: 'TypeScript patterns guide',
      baseScore: 0.3,
    });
    const other = makeScoredResult({
      id: 'other',
      content: 'JavaScript basics intro',
      baseScore: 0.6,
    });

    // Record that user selected the lower-ranked result
    scorer.recordSelection('target', 'typescript patterns');

    // Score again — selection signal should boost the target
    const scored = scorer.score([target, other], 'typescript patterns');

    // The selected result should now have a SELECTION signal contribution
    const targetEntry = scored.find((r) => r.id === 'target')!;
    const otherEntry = scored.find((r) => r.id === 'other')!;

    expect(targetEntry.signals[RelevanceSignal.SELECTION]).toBeGreaterThan(0);
    expect(otherEntry.signals[RelevanceSignal.SELECTION]).toBe(0);

    // The boost from selection signal should improve target's relative position
    const originalDiff = 0.3 - 0.6; // -0.3
    const newDiff = targetEntry.relevanceScore - otherEntry.relevanceScore;
    expect(newDiff).toBeGreaterThan(originalDiff);
  });

  // -------------------------------------------------------------------------
  // Cache hits / misses
  // -------------------------------------------------------------------------

  it('cache search results → verify cache hit on same query', () => {
    const query = 'test query';
    const results = makeResults(3);
    const cachedResult = makeCachedResult(query, results);

    // Store in cache
    cacheManager.set(query, cachedResult);

    // Retrieve from cache
    const cached = cacheManager.get(query);

    expect(cached).not.toBeNull();
    expect(cached!.results.length).toBe(3);
    expect(cached!.results[0].id).toBe('r-0');
  });

  it('cache miss after TTL expires → verify fresh results', async () => {
    const query = 'expiring query';
    const results = makeResults(2);
    // Use a short expiresAt that matches the cache's TTL (50ms)
    const cachedResult = makeCachedResult(query, results);
    cachedResult.expiresAt = Date.now() + 50;

    // Store with short TTL
    const shortTtlCache = new SearchCacheManagerImpl(
      { maxSize: 100, ttlMs: 50 },
      eventBus,
    );

    shortTtlCache.set(query, cachedResult);

    // Immediate get should hit
    const immediate = shortTtlCache.get(query);
    expect(immediate).not.toBeNull();

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 80));

    // Now it should be a miss
    const expired = shortTtlCache.get(query);
    expect(expired).toBeNull();

    shortTtlCache.dispose();
  });

  // -------------------------------------------------------------------------
  // Cache invalidation via events
  // -------------------------------------------------------------------------

  it('publish knowledge:entity-updated event → verify cache invalidated for "knowledge" source', () => {
    const query = 'knowledge query';
    const results = makeResults(3);
    const cachedResult = makeCachedResult(query, results);

    cacheManager.set(query, cachedResult);

    // Verify cached
    const cached = cacheManager.get(query);
    expect(cached).not.toBeNull();

    // Publish invalidation event
    eventBus.publish('knowledge:entity-updated', {
      id: 'some-entity',
    });

    // Cache should be invalidated for knowledge source
    const after = cacheManager.get(query);
    expect(after).toBeNull();
  });

  it('publish obsidian:file-changed event → verify cache invalidated for "obsidian" source', () => {
    const knowledgeQuery = 'knowledge query';
    const obsidianQuery = 'obsidian query';
    const knowledgeResults = makeResults(2);
    const obsidianResults = makeResults(2, { source: 'obsidian' });

    const knowledgeCached = makeCachedResult(knowledgeQuery, knowledgeResults);
    const obsidianCached = makeCachedResult(obsidianQuery, obsidianResults, ['obsidian']);

    cacheManager.set(knowledgeQuery, knowledgeCached);
    cacheManager.set(obsidianQuery, obsidianCached);

    // Both should be cached
    expect(cacheManager.get(knowledgeQuery)).not.toBeNull();
    expect(cacheManager.get(obsidianQuery)).not.toBeNull();

    // Publish obsidian file change
    eventBus.publish('obsidian:file-changed', {
      path: 'notes/test.md',
    });

    // Only obsidian cache should be invalidated
    const knowledgeCachedAfter = cacheManager.get(knowledgeQuery);
    const obsidianCachedAfter = cacheManager.get(obsidianQuery);

    expect(knowledgeCachedAfter).not.toBeNull();
    expect(obsidianCachedAfter).toBeNull();
  });

  it('knowledge invalidation does not affect other sources', () => {
    const webQuery = 'web query';
    const obsidianQuery = 'obsidian query';
    const webResults = makeResults(2, { source: 'web' });
    const obsidianResults = makeResults(2, { source: 'obsidian' });

    const webCached = makeCachedResult(webQuery, webResults, ['web']);
    const obsidianCached = makeCachedResult(obsidianQuery, obsidianResults, ['obsidian']);

    cacheManager.set(webQuery, webCached);
    cacheManager.set(obsidianQuery, obsidianCached);

    // Invalidate knowledge source
    eventBus.publish('knowledge:entity-updated', {
      id: 'e1',
    });

    // Neither web nor obsidian should be affected
    expect(cacheManager.get(webQuery)).not.toBeNull();
    expect(cacheManager.get(obsidianQuery)).not.toBeNull();
  });
});