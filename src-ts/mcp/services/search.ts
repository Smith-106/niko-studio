/**
 * MCP Search Service
 *
 * Search service module with 3 tools for search operations.
 * Ported from src/mcp/services/search.py
 */

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface SearchEngine {
  hybridSearch(params: {
    query: string;
    scope: string;
    limit: number;
    profile?: string | null;
    minScore?: number | null;
    budgetTokens?: number | null;
    rerank: boolean;
    routeMode?: string;
    elasticTimeoutMs?: number;
  }): Promise<unknown[]>;
  iterativeRetrieve(params: {
    query: string;
    maxIterations: number;
    confidenceThreshold: number;
    profile?: string | null;
    minScore?: number | null;
    budgetTokens?: number | null;
    rerank: boolean;
  }): Promise<Record<string, unknown>>;
  resolveContext(text: string): Promise<string>;
}

interface IntegrationAdapters {
  flags: {
    redisCacheEnabled: boolean;
    elasticsearchEnabled: boolean;
    langflowEnabled: boolean;
  };
  cacheRateLimit: {
    allowRequest(params: { key: string; limit: number; windowSeconds: number }): Promise<boolean>;
    cacheGet(key: string): Promise<unknown>;
    cacheSet(key: string, value: unknown, params: { ttlSeconds: number }): Promise<void>;
  };
  search: {
    indexDocument(doc: unknown): Promise<void>;
  };
  orchestration: {
    run(params: { flowName: string; payload: Record<string, unknown> }): Promise<void>;
  };
}

function getEngine(): SearchEngine | null {
  // Lazy accessor -- will be wired through container / gateway
  return null;
}

function getIntegrationAdapters(): IntegrationAdapters | null {
  return null;
}

function resolveRedisRateLimit(): [number, number] {
  return [100, 60];
}

function resolveSearchCacheKey(
  query: string,
  scope: string,
  limit: number,
  profile?: string | null
): string {
  return `search:${scope}:${query}:${limit}:${profile ?? ''}`;
}

function resolveSearchRouteMode(): string {
  return 'legacy';
}

function resolveSearchElasticTimeoutMs(): number {
  return 300;
}

function resolveRedisCacheTtlSeconds(): number {
  return 300;
}

function resolveLangflowFlowName(): string {
  return 'niko-search';
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
    const [rateLimit, windowSeconds] = resolveRedisRateLimit();
    const allowed = await adapters.cacheRateLimit.allowRequest({
      key: `search:rate:${scope}`,
      limit: rateLimit,
      windowSeconds,
    });
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

  const effectiveRouteMode = params.routeMode ?? resolveSearchRouteMode();
  const effectiveTimeoutMs = resolveSearchElasticTimeoutMs();

  const engine = getEngine();
  if (!engine) return [];

  const results = await engine.hybridSearch({
    query: params.query,
    scope,
    limit,
    profile: params.profile ?? null,
    minScore: params.minScore ?? null,
    budgetTokens: params.budgetTokens ?? null,
    rerank,
    routeMode: effectiveRouteMode,
    elasticTimeoutMs: effectiveTimeoutMs,
  });

  if (adapters && adapters.flags.redisCacheEnabled) {
    const ttlSeconds = resolveRedisCacheTtlSeconds();
    await adapters.cacheRateLimit.cacheSet(cacheKey, { results }, { ttlSeconds });
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
}): Promise<Record<string, unknown>> {
  const engine = getEngine();
  if (!engine) return { answer: '', sources: [], iterations: 0 };
  return engine.iterativeRetrieve({
    query: params.query,
    maxIterations: params.maxIterations ?? 3,
    confidenceThreshold: params.confidenceThreshold ?? 0.8,
    profile: params.profile ?? null,
    minScore: params.minScore ?? null,
    budgetTokens: params.budgetTokens ?? null,
    rerank: params.rerank ?? false,
  });
}

export async function searchContext(text: string): Promise<string> {
  const engine = getEngine();
  if (!engine) return '';
  return engine.resolveContext(text);
}
