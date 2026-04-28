/**
 * MCP Search Service
 *
 * Search service module with 3 tools for search operations.
 * Ported from src/mcp/services/search.py
 */

import {
  resolveRedisCacheTtlSeconds,
  resolveRedisRateLimit,
  resolveSearchElasticTimeoutMs,
  resolveSearchRouteMode,
} from '../config';
import { createIntegrationAdapters } from '../../integrations';
import {
  createIterativeRetriever,
  type IterativeRetrieveResult,
  type IterativeRetriever,
} from '../../search';

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

type SearchEngine = Pick<
  IterativeRetriever,
  'hybridSearch' | 'iterativeRetrieve' | 'resolveContext'
>;
type IntegrationAdapters = ReturnType<typeof createIntegrationAdapters>;

let searchEngineInstance: SearchEngine | null = null;
let integrationAdaptersInstance: IntegrationAdapters | null = null;

function getEngine(): SearchEngine | null {
  if (!searchEngineInstance) {
    const adapters = getIntegrationAdapters();
    searchEngineInstance = createIterativeRetriever({
      projectRoot: process.cwd(),
      elasticAdapter: adapters?.search,
      elasticsearchEnabled: adapters?.flags.elasticsearchEnabled ?? false,
    });
  }
  return searchEngineInstance;
}

function getIntegrationAdapters(): IntegrationAdapters | null {
  if (!integrationAdaptersInstance) {
    integrationAdaptersInstance = createIntegrationAdapters();
  }
  return integrationAdaptersInstance;
}

function resolveSearchCacheKey(
  query: string,
  scope: string,
  limit: number,
  profile?: string | null
): string {
  return `search:${scope}:${query}:${limit}:${profile ?? ''}`;
}


// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function searchHybrid(params: {
  query: string;
  scope?: string;
  limit?: number;
  profile?: string | null;
  minScore?: number | null;
  budgetTokens?: number | null;
  rerank?: boolean;
  routeMode?: string | null;
}): Promise<unknown[]> {
  const scope = params.scope ?? 'all';
  const limit = params.limit ?? 10;
  const rerank = params.rerank ?? false;

  const adapters = getIntegrationAdapters();

  if (adapters && adapters.flags.redisCacheEnabled) {
    const { limit: rateLimit, windowSeconds } = resolveRedisRateLimit();
    const allowed = await adapters.cacheRateLimit.allowRequest(
      `search:rate:${scope}`,
      rateLimit,
      windowSeconds,
    );
    if (!allowed) return [];
  }

  const cacheKey = resolveSearchCacheKey(params.query, scope, limit, params.profile);
  if (adapters && adapters.flags.redisCacheEnabled) {
    const cached = await adapters.cacheRateLimit.cacheGet(cacheKey);
    if (
      typeof cached === 'object' &&
      cached !== null &&
      Array.isArray((cached as Record<string, unknown>).results)
    ) {
      return (cached as { results: unknown[] }).results;
    }
  }

  const searchStatus = adapters?.search.getStatus();
  const requestedRouteMode = params.routeMode ?? resolveSearchRouteMode();
  const effectiveRouteMode = searchStatus?.state === 'degraded' && requestedRouteMode !== 'legacy'
    ? 'legacy'
    : requestedRouteMode;
  const effectiveTimeoutMs = resolveSearchElasticTimeoutMs();

  const engine = getEngine();
  if (!engine) return [];

  const results = await engine.hybridSearch(
    params.query,
    scope,
    limit,
    params.profile ?? undefined,
    params.minScore ?? undefined,
    params.budgetTokens ?? undefined,
    rerank,
    effectiveRouteMode,
    effectiveTimeoutMs,
  );

  if (searchStatus && searchStatus.state !== 'real' && searchStatus.state !== 'disabled') {
    return [{
      id: `integration:${searchStatus.integration}`,
      content: searchStatus.detail,
      source: 'integration',
      score: 1,
      metadata: {
        integration: searchStatus.integration,
        state: searchStatus.state,
        code: searchStatus.code,
        routeMode: effectiveRouteMode,
        results,
      },
    }];
  }

  if (adapters && adapters.flags.redisCacheEnabled) {
    const ttlSeconds = resolveRedisCacheTtlSeconds();
    await adapters.cacheRateLimit.cacheSet(cacheKey, { results }, ttlSeconds);
  }

  return results;
}

export async function searchIterative(params: {
  query: string;
  maxIterations?: number;
  confidenceThreshold?: number;
  profile?: string | null;
  minScore?: number | null;
  budgetTokens?: number | null;
  rerank?: boolean;
}): Promise<IterativeRetrieveResult> {
  const engine = getEngine();
  if (!engine) {
    return {
      results: [],
      iterations: 0,
      confidence: 0,
      queriesUsed: [params.query],
      retrievalTrace: [],
    };
  }
  return engine.iterativeRetrieve(
    params.query,
    params.maxIterations ?? 3,
    params.confidenceThreshold ?? 0.8,
    params.profile ?? undefined,
    params.minScore ?? undefined,
    params.budgetTokens ?? undefined,
    params.rerank ?? false,
  );
}

export async function searchContext(text: string): Promise<string> {
  const engine = getEngine();
  if (!engine) return '';
  return engine.resolveContext(text);
}
