/**
 * Integration adapters - Optional extension boundaries
 *
 * These adapters define explicit non-critical extension points for external
 * systems while keeping local-first behavior as the default path.
 */

// ============================================================
// Adapter Interfaces
// ============================================================

export interface StorageShadowAdapter {
  shadowWriteMemory(payload: Record<string, unknown>): Promise<boolean>;
}

export interface CacheRateLimitAdapter {
  cacheGet(key: string): Promise<Record<string, unknown> | null>;
  cacheSet(key: string, value: Record<string, unknown>, ttlSeconds: number): Promise<boolean>;
  allowRequest(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export interface SearchAdapter {
  indexDocument(document: Record<string, unknown>): Promise<boolean>;
  search(query: string, scope: string, limit: number): Promise<Record<string, unknown>[]>;
}

export interface GraphProjectionAdapter {
  projectEntity(entity: Record<string, unknown>): Promise<boolean>;
  projectRelation(relation: Record<string, unknown>): Promise<boolean>;
}

export interface GovernanceHookAdapter {
  onSchemaWorkflow(event: string, payload: Record<string, unknown>): Promise<boolean>;
}

export interface OrchestrationHookAdapter {
  run(flowName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ============================================================
// Integration Flags
// ============================================================

export interface IntegrationFlags {
  postgresEnabled: boolean;
  redisCacheEnabled: boolean;
  elasticsearchEnabled: boolean;
  neo4jEnabled: boolean;
  langflowEnabled: boolean;
}

// ============================================================
// No-op Adapters (default local-first implementations)
// ============================================================

export class NoopStorageShadowAdapter implements StorageShadowAdapter {
  async shadowWriteMemory(_payload: Record<string, unknown>): Promise<boolean> {
    return false;
  }
}

export class NoopCacheRateLimitAdapter implements CacheRateLimitAdapter {
  async cacheGet(_key: string): Promise<Record<string, unknown> | null> {
    return null;
  }
  async cacheSet(_key: string, _value: Record<string, unknown>, _ttlSeconds: number): Promise<boolean> {
    return false;
  }
  async allowRequest(_key: string, _limit: number, _windowSeconds: number): Promise<boolean> {
    return true;
  }
}

export class NoopSearchAdapter implements SearchAdapter {
  async indexDocument(_document: Record<string, unknown>): Promise<boolean> {
    return false;
  }
  async search(_query: string, _scope: string, _limit: number): Promise<Record<string, unknown>[]> {
    return [];
  }
}

export class NoopGraphProjectionAdapter implements GraphProjectionAdapter {
  async projectEntity(_entity: Record<string, unknown>): Promise<boolean> {
    return false;
  }
  async projectRelation(_relation: Record<string, unknown>): Promise<boolean> {
    return false;
  }
}

export class NoopGovernanceHookAdapter implements GovernanceHookAdapter {
  async onSchemaWorkflow(_event: string, _payload: Record<string, unknown>): Promise<boolean> {
    return false;
  }
}

export class NoopOrchestrationHookAdapter implements OrchestrationHookAdapter {
  async run(flowName: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return { status: 'disabled', flow_name: flowName };
  }
}

// ============================================================
// Stub Adapters (for when integrations are enabled)
// ============================================================

export class StubPostgresShadowAdapter implements StorageShadowAdapter {
  async shadowWriteMemory(payload: Record<string, unknown>): Promise<boolean> {
    return true;
  }
}

export class StubRedisCacheRateLimitAdapter implements CacheRateLimitAdapter {
  async cacheGet(_key: string): Promise<Record<string, unknown> | null> {
    return null;
  }
  async cacheSet(_key: string, _value: Record<string, unknown>, _ttlSeconds: number): Promise<boolean> {
    return true;
  }
  async allowRequest(_key: string, _limit: number, _windowSeconds: number): Promise<boolean> {
    return true;
  }
}

export class StubElasticsearchAdapter implements SearchAdapter {
  async indexDocument(_document: Record<string, unknown>): Promise<boolean> {
    return true;
  }
  async search(_query: string, _scope: string, _limit: number): Promise<Record<string, unknown>[]> {
    return [];
  }
}

export class StubNeo4jProjectionAdapter implements GraphProjectionAdapter {
  async projectEntity(_entity: Record<string, unknown>): Promise<boolean> {
    return true;
  }
  async projectRelation(_relation: Record<string, unknown>): Promise<boolean> {
    return true;
  }
}

export class StubDbhubGovernanceHook implements GovernanceHookAdapter {
  async onSchemaWorkflow(_event: string, _payload: Record<string, unknown>): Promise<boolean> {
    return true;
  }
}

export class StubLangflowOrchestrationHook implements OrchestrationHookAdapter {
  async run(flowName: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return { status: 'ok', flow_name: flowName, provider: 'langflow' };
  }
}

// ============================================================
// Adapter Bundle & Factory
// ============================================================

export interface IntegrationAdapterBundle {
  storageShadow: StorageShadowAdapter;
  cacheRateLimit: CacheRateLimitAdapter;
  search: SearchAdapter;
  graphProjection: GraphProjectionAdapter;
  governance: GovernanceHookAdapter;
  orchestration: OrchestrationHookAdapter;
  flags: IntegrationFlags;
}

function getIntegrationFlags(): IntegrationFlags {
  const get = (key: string, fallback: boolean): boolean => {
    const val = process.env[key]?.toLowerCase();
    if (!val) return fallback;
    return val === 'true' || val === '1';
  };

  return {
    postgresEnabled: get('INTEGRATION_POSTGRES_ENABLED', false),
    redisCacheEnabled: get('INTEGRATION_REDIS_CACHE_ENABLED', false),
    elasticsearchEnabled: get('INTEGRATION_ELASTICSEARCH_ENABLED', false),
    neo4jEnabled: get('INTEGRATION_NEO4J_ENABLED', false),
    langflowEnabled: get('INTEGRATION_LANGFLOW_ENABLED', false),
  };
}

export function createIntegrationAdapters(): IntegrationAdapterBundle {
  const flags = getIntegrationFlags();
  return {
    storageShadow: flags.postgresEnabled ? new StubPostgresShadowAdapter() : new NoopStorageShadowAdapter(),
    cacheRateLimit: flags.redisCacheEnabled ? new StubRedisCacheRateLimitAdapter() : new NoopCacheRateLimitAdapter(),
    search: flags.elasticsearchEnabled ? new StubElasticsearchAdapter() : new NoopSearchAdapter(),
    graphProjection: flags.neo4jEnabled ? new StubNeo4jProjectionAdapter() : new NoopGraphProjectionAdapter(),
    governance: new StubDbhubGovernanceHook(),
    orchestration: flags.langflowEnabled ? new StubLangflowOrchestrationHook() : new NoopOrchestrationHookAdapter(),
    flags,
  };
}
