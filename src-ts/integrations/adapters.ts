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

export type IntegrationRuntimeState = 'disabled' | 'real' | 'unsupported' | 'degraded';
export type IntegrationSupportLevel = 'supported' | 'experimental' | 'disabled';
export type IntegrationFlagName = keyof IntegrationFlags;

export interface IntegrationStatus {
  integration: string;
  state: IntegrationRuntimeState;
  support_level: IntegrationSupportLevel;
  code: string;
  detail: string;
}

export interface IntegrationCapability {
  flag: IntegrationFlagName;
  integration: string;
  support_level: IntegrationSupportLevel;
  requested: boolean;
  enabled: boolean;
  detail: string;
}

export type IntegrationCapabilityMap = Record<IntegrationFlagName, IntegrationCapability>;

export interface StorageShadowAdapter {
  shadowWriteMemory(payload: Record<string, unknown>): Promise<boolean>;
  getStatus(): IntegrationStatus;
}

export interface CacheRateLimitAdapter {
  cacheGet(key: string): Promise<Record<string, unknown> | null>;
  cacheSet(key: string, value: Record<string, unknown>, ttlSeconds: number): Promise<boolean>;
  allowRequest(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  getStatus(): IntegrationStatus;
}

export interface SearchAdapter {
  indexDocument(document: Record<string, unknown>): Promise<boolean>;
  search(query: string, scope: string, limit: number): Promise<Record<string, unknown>[]>;
  getStatus(): IntegrationStatus;
}

export interface GraphProjectionAdapter {
  projectEntity(entity: Record<string, unknown>): Promise<boolean>;
  projectRelation(relation: Record<string, unknown>): Promise<boolean>;
  getStatus(): IntegrationStatus;
}

export interface GovernanceHookAdapter {
  onSchemaWorkflow(event: string, payload: Record<string, unknown>): Promise<boolean>;
  getStatus(): IntegrationStatus;
}

export interface OrchestrationHookAdapter {
  run(flowName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  getStatus(): IntegrationStatus;
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

interface IntegrationPolicyEntry {
  integration: string;
  support_level: IntegrationSupportLevel;
  requestedDetail: string;
  disabledDetail: string;
}

const INTEGRATION_POLICY: Record<IntegrationFlagName, IntegrationPolicyEntry> = {
  postgresEnabled: {
    integration: 'postgres-shadow',
    support_level: 'experimental',
    requestedDetail:
      'Postgres shadow-write remains experimental and non-authoritative; local-first persistence must stay authoritative.',
    disabledDetail:
      'Postgres shadow-write integration is disabled; local-first persistence remains authoritative.',
  },
  redisCacheEnabled: {
    integration: 'redis-cache-rate-limit',
    support_level: 'experimental',
    requestedDetail:
      'Redis cache/rate-limit remains experimental and non-authoritative; in-process defaults stay authoritative.',
    disabledDetail:
      'Redis cache/rate-limit integration is disabled; in-process defaults remain authoritative.',
  },
  elasticsearchEnabled: {
    integration: 'elasticsearch-search',
    support_level: 'experimental',
    requestedDetail:
      'Elasticsearch search remains experimental and must fall back to local retrieval when no durable external index is available.',
    disabledDetail:
      'Elasticsearch integration is disabled; local retrieval remains the only active search path.',
  },
  neo4jEnabled: {
    integration: 'neo4j-projection',
    support_level: 'disabled',
    requestedDetail:
      'Neo4j projection is not part of the supported runtime and stays disabled until a durable projection writer exists.',
    disabledDetail:
      'Neo4j projection is disabled; SQLite graph storage remains authoritative.',
  },
  langflowEnabled: {
    integration: 'langflow-orchestration',
    support_level: 'disabled',
    requestedDetail:
      'Langflow orchestration is not part of the supported runtime and stays disabled until a real remote flow runner exists.',
    disabledDetail:
      'Langflow orchestration is disabled; no external orchestration flow is started.',
  },
  dbhubGovernanceEnabled: {
    integration: 'dbhub-governance',
    support_level: 'disabled',
    requestedDetail:
      'DBHub governance hooks are not part of the supported runtime and stay disabled until a durable bridge exists.',
    disabledDetail:
      'DBHub governance hook is disabled; local governance scripts remain authoritative.',
  },
};

function createStatus(
  integration: string,
  state: IntegrationRuntimeState,
  supportLevel: IntegrationSupportLevel,
  code: string,
  detail: string,
): IntegrationStatus {
  return {
    integration,
    state,
    support_level: supportLevel,
    code,
    detail,
  };
}

function resolveRuntimeEnv(): string {
  const envFromProcess = process.env.NIKO_ENV ?? process.env.NODE_ENV;
  if (typeof envFromProcess === 'string' && envFromProcess.trim().length > 0) {
    return envFromProcess.trim().toLowerCase();
  }

  const envFromConfig = getAppConfigValue('env', 'development');
  return typeof envFromConfig === 'string' && envFromConfig.trim().length > 0
    ? envFromConfig.trim().toLowerCase()
    : 'development';
}

function isProductionRuntime(): boolean {
  const env = resolveRuntimeEnv();
  return env === 'prod' || env === 'production';
}

function getRequestedIntegrationFlags(): IntegrationFlags {
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

function resolveIntegrationCapabilities(requestedFlags: IntegrationFlags): IntegrationCapabilityMap {
  const production = isProductionRuntime();

  const buildCapability = (flag: IntegrationFlagName): IntegrationCapability => {
    const policy = INTEGRATION_POLICY[flag];
    const requested = requestedFlags[flag];

    if (!requested) {
      return {
        flag,
        integration: policy.integration,
        support_level: policy.support_level,
        requested: false,
        enabled: false,
        detail: policy.disabledDetail,
      };
    }

    if (policy.support_level === 'disabled') {
      return {
        flag,
        integration: policy.integration,
        support_level: policy.support_level,
        requested: true,
        enabled: false,
        detail: policy.requestedDetail,
      };
    }

    if (production) {
      return {
        flag,
        integration: policy.integration,
        support_level: policy.support_level,
        requested: true,
        enabled: false,
        detail: `${policy.requestedDetail} Experimental integrations are disabled in production.`,
      };
    }

    return {
      flag,
      integration: policy.integration,
      support_level: policy.support_level,
      requested: true,
      enabled: true,
      detail: policy.requestedDetail,
    };
  };

  return {
    postgresEnabled: buildCapability('postgresEnabled'),
    redisCacheEnabled: buildCapability('redisCacheEnabled'),
    elasticsearchEnabled: buildCapability('elasticsearchEnabled'),
    neo4jEnabled: buildCapability('neo4jEnabled'),
    langflowEnabled: buildCapability('langflowEnabled'),
    dbhubGovernanceEnabled: buildCapability('dbhubGovernanceEnabled'),
  };
}

function getEffectiveIntegrationFlags(capabilities: IntegrationCapabilityMap): IntegrationFlags {
  return {
    postgresEnabled: capabilities.postgresEnabled.enabled,
    redisCacheEnabled: capabilities.redisCacheEnabled.enabled,
    elasticsearchEnabled: capabilities.elasticsearchEnabled.enabled,
    neo4jEnabled: capabilities.neo4jEnabled.enabled,
    langflowEnabled: capabilities.langflowEnabled.enabled,
    dbhubGovernanceEnabled: capabilities.dbhubGovernanceEnabled.enabled,
  };
}

function createInactiveStatus(capability: IntegrationCapability): IntegrationStatus {
  if (!capability.requested) {
    return createStatus(
      capability.integration,
      'disabled',
      capability.support_level,
      'INTEGRATION_DISABLED',
      capability.detail,
    );
  }

  if (capability.support_level === 'experimental') {
    return createStatus(
      capability.integration,
      'degraded',
      capability.support_level,
      'INTEGRATION_EXPERIMENTAL_DISABLED_IN_PRODUCTION',
      capability.detail,
    );
  }

  return createStatus(
    capability.integration,
    'unsupported',
    capability.support_level,
    'INTEGRATION_DISABLED_BY_POLICY',
    capability.detail,
  );
}

// ============================================================
// No-op Adapters (default local-first implementations)
// ============================================================

export class NoopStorageShadowAdapter implements StorageShadowAdapter {
  constructor(
    private readonly status: IntegrationStatus = createStatus(
      'postgres-shadow',
      'disabled',
      'experimental',
      'INTEGRATION_DISABLED',
      INTEGRATION_POLICY.postgresEnabled.disabledDetail,
    ),
  ) {}

  async shadowWriteMemory(_payload: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  getStatus(): IntegrationStatus {
    return this.status;
  }
}

export class NoopCacheRateLimitAdapter implements CacheRateLimitAdapter {
  constructor(
    private readonly status: IntegrationStatus = createStatus(
      'redis-cache-rate-limit',
      'disabled',
      'experimental',
      'INTEGRATION_DISABLED',
      INTEGRATION_POLICY.redisCacheEnabled.disabledDetail,
    ),
  ) {}

  async cacheGet(_key: string): Promise<Record<string, unknown> | null> {
    return null;
  }

  async cacheSet(_key: string, _value: Record<string, unknown>, _ttlSeconds: number): Promise<boolean> {
    return false;
  }

  async allowRequest(_key: string, _limit: number, _windowSeconds: number): Promise<boolean> {
    return true;
  }

  getStatus(): IntegrationStatus {
    return this.status;
  }
}

export class NoopSearchAdapter implements SearchAdapter {
  constructor(
    private readonly status: IntegrationStatus = createStatus(
      'elasticsearch-search',
      'disabled',
      'experimental',
      'INTEGRATION_DISABLED',
      INTEGRATION_POLICY.elasticsearchEnabled.disabledDetail,
    ),
  ) {}

  async indexDocument(_document: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  async search(_query: string, _scope: string, _limit: number): Promise<Record<string, unknown>[]> {
    return [];
  }

  getStatus(): IntegrationStatus {
    return this.status;
  }
}

export class NoopGraphProjectionAdapter implements GraphProjectionAdapter {
  constructor(
    private readonly status: IntegrationStatus = createStatus(
      'neo4j-projection',
      'disabled',
      'disabled',
      'INTEGRATION_DISABLED',
      INTEGRATION_POLICY.neo4jEnabled.disabledDetail,
    ),
  ) {}

  async projectEntity(_entity: Record<string, unknown>): Promise<boolean> {
    if (this.status.code === 'INTEGRATION_DISABLED_BY_POLICY' && isProductionRuntime()) {
      throw new Error('Neo4j projection is not supported in production without a real projection writer.');
    }
    return false;
  }

  async projectRelation(_relation: Record<string, unknown>): Promise<boolean> {
    if (this.status.code === 'INTEGRATION_DISABLED_BY_POLICY' && isProductionRuntime()) {
      throw new Error('Neo4j projection is not supported in production without a real projection writer.');
    }
    return false;
  }

  getStatus(): IntegrationStatus {
    return this.status;
  }
}

export class NoopGovernanceHookAdapter implements GovernanceHookAdapter {
  constructor(
    private readonly status: IntegrationStatus = createStatus(
      'dbhub-governance',
      'disabled',
      'disabled',
      'INTEGRATION_DISABLED',
      INTEGRATION_POLICY.dbhubGovernanceEnabled.disabledDetail,
    ),
  ) {}

  async onSchemaWorkflow(_event: string, _payload: Record<string, unknown>): Promise<boolean> {
    if (this.status.code === 'INTEGRATION_DISABLED_BY_POLICY' && isProductionRuntime()) {
      throw new Error('DBHub governance hook is not supported in production without a real governance bridge.');
    }
    return false;
  }

  getStatus(): IntegrationStatus {
    return this.status;
  }
}

export class NoopOrchestrationHookAdapter implements OrchestrationHookAdapter {
  constructor(
    private readonly status: IntegrationStatus = createStatus(
      'langflow-orchestration',
      'disabled',
      'disabled',
      'INTEGRATION_DISABLED',
      INTEGRATION_POLICY.langflowEnabled.disabledDetail,
    ),
  ) {}

  async run(flowName: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.status.code === 'INTEGRATION_DISABLED_BY_POLICY' && isProductionRuntime()) {
      throw new Error('Langflow orchestration is not supported in production without a real remote flow runner.');
    }
    return {
      status: this.status.state,
      flow_name: flowName,
      state: this.status.state,
      support_level: this.status.support_level,
      code: this.status.code,
      detail: this.status.detail,
    };
  }

  getStatus(): IntegrationStatus {
    return this.status;
  }
}

// ============================================================
// Stub Adapters (for when integrations are enabled)
// ============================================================

export class StubPostgresShadowAdapter implements StorageShadowAdapter {
  async shadowWriteMemory(_payload: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  getStatus(): IntegrationStatus {
    return createStatus(
      'postgres-shadow',
      'degraded',
      'experimental',
      'POSTGRES_SHADOW_UNSUPPORTED',
      'Postgres shadow-write is enabled in configuration but no durable external writer is implemented.',
    );
  }
}

export class StubRedisCacheRateLimitAdapter implements CacheRateLimitAdapter {
  async cacheGet(_key: string): Promise<Record<string, unknown> | null> {
    return null;
  }

  async cacheSet(_key: string, _value: Record<string, unknown>, _ttlSeconds: number): Promise<boolean> {
    return false;
  }

  async allowRequest(_key: string, _limit: number, _windowSeconds: number): Promise<boolean> {
    return true;
  }

  getStatus(): IntegrationStatus {
    return createStatus(
      'redis-cache-rate-limit',
      'degraded',
      'experimental',
      'REDIS_CACHE_RATE_LIMIT_DEGRADED',
      'Redis cache/rate-limit is enabled in configuration but no external backend is implemented; in-process defaults remain active.',
    );
  }
}

export class StubElasticsearchAdapter implements SearchAdapter {
  async indexDocument(_document: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  async search(_query: string, _scope: string, _limit: number): Promise<Record<string, unknown>[]> {
    return [];
  }

  getStatus(): IntegrationStatus {
    return createStatus(
      'elasticsearch-search',
      'degraded',
      'experimental',
      'ELASTICSEARCH_DEGRADED',
      'Elasticsearch is enabled but no durable external index is available; requests must fall back to local retrieval.',
    );
  }
}

export class StubNeo4jProjectionAdapter implements GraphProjectionAdapter {
  async projectEntity(_entity: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  async projectRelation(_relation: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  getStatus(): IntegrationStatus {
    return createStatus(
      'neo4j-projection',
      'unsupported',
      'disabled',
      'NEO4J_PROJECTION_UNSUPPORTED',
      'Neo4j projection is enabled in configuration but no durable external projection writer is implemented.',
    );
  }
}

export class StubDbhubGovernanceHook implements GovernanceHookAdapter {
  async onSchemaWorkflow(_event: string, _payload: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  getStatus(): IntegrationStatus {
    return createStatus(
      'dbhub-governance',
      'unsupported',
      'disabled',
      'DBHUB_GOVERNANCE_UNSUPPORTED',
      'DBHub governance hook is enabled in configuration but no external governance bridge is implemented.',
    );
  }
}

export class StubLangflowOrchestrationHook implements OrchestrationHookAdapter {
  async run(flowName: string, _payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const status = this.getStatus();
    return {
      status: 'unsupported',
      flow_name: flowName,
      provider: 'langflow',
      state: status.state,
      support_level: status.support_level,
      code: status.code,
      detail: status.detail,
    };
  }

  getStatus(): IntegrationStatus {
    return createStatus(
      'langflow-orchestration',
      'unsupported',
      'disabled',
      'LANGFLOW_UNSUPPORTED',
      'Langflow orchestration is enabled in configuration but no real remote flow runner is implemented.',
    );
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
  requestedFlags: IntegrationFlags;
  capabilities: IntegrationCapabilityMap;
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
  const requestedFlags = getRequestedIntegrationFlags();
  const capabilities = resolveIntegrationCapabilities(requestedFlags);
  const flags = getEffectiveIntegrationFlags(capabilities);

  return {
    storageShadow: flags.postgresEnabled
      ? new StubPostgresShadowAdapter()
      : new NoopStorageShadowAdapter(createInactiveStatus(capabilities.postgresEnabled)),
    cacheRateLimit: flags.redisCacheEnabled
      ? new StubRedisCacheRateLimitAdapter()
      : new NoopCacheRateLimitAdapter(createInactiveStatus(capabilities.redisCacheEnabled)),
    search: flags.elasticsearchEnabled
      ? new StubElasticsearchAdapter()
      : new NoopSearchAdapter(createInactiveStatus(capabilities.elasticsearchEnabled)),
    graphProjection: flags.neo4jEnabled
      ? new StubNeo4jProjectionAdapter()
      : new NoopGraphProjectionAdapter(createInactiveStatus(capabilities.neo4jEnabled)),
    governance: flags.dbhubGovernanceEnabled
      ? new StubDbhubGovernanceHook()
      : new NoopGovernanceHookAdapter(createInactiveStatus(capabilities.dbhubGovernanceEnabled)),
    orchestration: flags.langflowEnabled
      ? new StubLangflowOrchestrationHook()
      : new NoopOrchestrationHookAdapter(createInactiveStatus(capabilities.langflowEnabled)),
    flags,
    requestedFlags,
    capabilities,
  };
}
