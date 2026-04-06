/**
 * Integration adapters - Optional extension boundaries
 *
 * These adapters define explicit non-critical extension points for external
 * systems while keeping local-first behavior as the default path.
 */

import { getConfigValue as getAppConfigValue } from '../config';

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
  dbhubGovernanceEnabled: boolean;
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
  const get = (legacyEnvKey: string, modernEnvKey: string, configKey: string, fallback: boolean): boolean => {
    const legacyValue = process.env[legacyEnvKey];
    if (legacyValue !== undefined) {
      return parseBooleanFlag(legacyValue, fallback);
    }

    const modernValue = process.env[modernEnvKey];
    if (modernValue !== undefined) {
      return parseBooleanFlag(modernValue, fallback);
    }

    return parseBooleanFlag(getAppConfigValue(configKey, fallback), fallback);
  };

  return {
    postgresEnabled: get('INTEGRATION_POSTGRES_ENABLED', 'NIKO_POSTGRES_ENABLED', 'integration.postgresEnabled', false),
    redisCacheEnabled: get('INTEGRATION_REDIS_CACHE_ENABLED', 'NIKO_REDIS_CACHE_ENABLED', 'integration.redisCacheEnabled', false),
    elasticsearchEnabled: get('INTEGRATION_ELASTICSEARCH_ENABLED', 'NIKO_ELASTICSEARCH_ENABLED', 'integration.elasticsearchEnabled', false),
    neo4jEnabled: get('INTEGRATION_NEO4J_ENABLED', 'NIKO_NEO4J_ENABLED', 'integration.neo4jEnabled', false),
    langflowEnabled: get('INTEGRATION_LANGFLOW_ENABLED', 'NIKO_LANGFLOW_ENABLED', 'integration.langflowEnabled', false),
    dbhubGovernanceEnabled: get('INTEGRATION_DBHUB_GOVERNANCE_ENABLED', 'NIKO_DBHUB_GOVERNANCE_ENABLED', 'integration.dbhubGovernanceEnabled', false),
  };
}

function parseBooleanFlag(rawValue: unknown, fallback: boolean): boolean {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number') {
    if (rawValue === 1) return true;
    if (rawValue === 0) return false;
    return fallback;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return fallback;
}

export function createIntegrationAdapters(): IntegrationAdapterBundle {
  const flags = getIntegrationFlags();
  return {
    storageShadow: flags.postgresEnabled ? new StubPostgresShadowAdapter() : new NoopStorageShadowAdapter(),
    cacheRateLimit: flags.redisCacheEnabled ? new StubRedisCacheRateLimitAdapter() : new NoopCacheRateLimitAdapter(),
    search: flags.elasticsearchEnabled ? new StubElasticsearchAdapter() : new NoopSearchAdapter(),
    graphProjection: flags.neo4jEnabled ? new StubNeo4jProjectionAdapter() : new NoopGraphProjectionAdapter(),
    governance: flags.dbhubGovernanceEnabled ? new StubDbhubGovernanceHook() : new NoopGovernanceHookAdapter(),
    orchestration: flags.langflowEnabled ? new StubLangflowOrchestrationHook() : new NoopOrchestrationHookAdapter(),
    flags,
  };
}
