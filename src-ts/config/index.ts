/**
 * Unified Configuration Management Module
 *
 * Ported from Python src/config.py
 *
 * Supports:
 * - Multi-source loading (defaults < env vars < config file < runtime overrides)
 * - Hot reload via fs.watch
 * - Change event notification (EventEmitter pattern)
 * - Global singleton access
 * - Config validation
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { EventEmitter } from 'events'
import { createLogger } from '../logger/index.js'

const log = createLogger('config')

// ---------------------------------------------------------------------------
// Version - authoritative release version for cross-surface consistency checks
// ---------------------------------------------------------------------------

const APP_VERSION = '11.0.0'

// ---------------------------------------------------------------------------
// Enum & helper types
// ---------------------------------------------------------------------------

export enum ConfigSource {
  Default = 'default',
  Env = 'environment',
  File = 'file',
  Override = 'override',
}

export interface ConfigValue<T = unknown> {
  value: T
  source: ConfigSource
  key: string
  timestamp: number
}

export interface ConfigChangeEvent {
  key: string
  oldValue: unknown
  newValue: unknown
  source: ConfigSource
  timestamp: number
}

// ---------------------------------------------------------------------------
// Sub-config interfaces (match Python dataclasses)
// ---------------------------------------------------------------------------

export interface AgentConfig {
  maxCostPerRequest: number
  maxCostPerSession: number
  maxTokensPerRequest: number
  budgetWarnThreshold: number
  defaultModel: string
  googleApiKey: string
  openaiApiKey: string
  logLevel: string
}

export interface MemoryConfig {
  vectorDbPath: string
  embeddingModel: string
  embeddingDimension: number
  cacheEnabled: boolean
  cacheTtl: number
  cacheMaxSize: number
  chunkSize: number
  chunkOverlap: number
  backend: 'sqlite' | 'fs'
}

export interface WorkflowConfig {
  sessionTimeout: number
  maxConcurrentSessions: number
  checkpointEnabled: boolean
  checkpointInterval: number
  resumeStrategy: string
  qualityMode: string
  qualityLevel: string
  degradeOnTimeout: boolean
  degradeOnError: boolean
  criticalGateAlwaysOn: boolean
  qualityPhaseTimeoutSeconds: number
  persistence: 'sqlite' | 'memory'
}

export interface GraphConfig {
  dbPath: string
  maxConnections: number
  maxEntitiesPerQuery: number
  relationDepth: number
}

export interface WritingConfig {
  characterDepthDimensions: number
  maxCharacterTraits: number
  sceneCoherenceThreshold: number
  contradictionSensitivity: string
  foreshadowingMaxDistance: number
  foreshadowingReminderThreshold: number
  styleVectorDimensions: number
  styleSampleMinWords: number
}

export interface GatewayConfig {
  host: string
  port: number
  reload: boolean
  localhostOnly: boolean
  localhostOnlyExemptPaths: string[]
  corsDevOrigins: string[]
  corsProdOrigins: string[]
  metricsEnabled: boolean
  uiBridgeEnabled: boolean
  detectionEvasionGuard: boolean
}

export interface BackupConfig {
  backupDir: string
  compress: boolean
  maxBackups: number
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavRemotePath: string
  s3Enabled: boolean
  s3Bucket: string
  s3Prefix: string
  s3Region: string
  s3EndpointUrl: string
  s3AccessKeyId: string
  s3SecretAccessKey: string
  s3ForcePathStyle: boolean
}

export interface TokenConfig {
  dbPath: string
  defaultModel: string
  defaultBudget: number
  budgetWarnThreshold: number
}

export interface ObsidianConfig {
  enabled: boolean
  autoDiscover: boolean
  syncOnStartup: boolean
  defaultVault: string
  filePatterns: string[]
}

export interface IntegrationConfig {
  postgresEnabled: boolean
  redisCacheEnabled: boolean
  elasticsearchEnabled: boolean
  neo4jEnabled: boolean
  langflowEnabled: boolean
  dbhubGovernanceEnabled: boolean
  searchRouteMode: string
  searchElasticTimeoutMs: number
  redisRateLimit: number
  redisRateLimitWindowSeconds: number
  langflowFlowName: string
  redisCacheTtlSeconds: number
}

// ---------------------------------------------------------------------------
// AppConfig - root configuration
// ---------------------------------------------------------------------------

export interface AppConfig {
  appName: string
  version: string
  debug: boolean
  env: string
  dataDir: string
  logDir: string
  agent: AgentConfig
  memory: MemoryConfig
  workflow: WorkflowConfig
  graph: GraphConfig
  writing: WritingConfig
  gateway: GatewayConfig
  backup: BackupConfig
  token: TokenConfig
  obsidian: ObsidianConfig
  integration: IntegrationConfig
}

// ---------------------------------------------------------------------------
// Default factories
// ---------------------------------------------------------------------------

function defaultAgentConfig(): AgentConfig {
  return {
    maxCostPerRequest: 1.0,
    maxCostPerSession: 10.0,
    maxTokensPerRequest: 100000,
    budgetWarnThreshold: 0.8,
    defaultModel: 'gpt-4o',
    googleApiKey: '',
    openaiApiKey: '',
    logLevel: 'INFO',
  }
}

function defaultMemoryConfig(): MemoryConfig {
  return {
    vectorDbPath: '.writing/vector_store',
    embeddingModel: 'BAAI/bge-small-en-v1.5',
    embeddingDimension: 384,
    cacheEnabled: true,
    cacheTtl: 86400,
    cacheMaxSize: 2000,
    chunkSize: 1000,
    chunkOverlap: 200,
    backend: 'sqlite',
  }
}

function defaultWorkflowConfig(): WorkflowConfig {
  return {
    sessionTimeout: 3600,
    maxConcurrentSessions: 10,
    checkpointEnabled: true,
    checkpointInterval: 300,
    resumeStrategy: 'from_last_checkpoint',
    qualityMode: 'auto',
    qualityLevel: 'high',
    degradeOnTimeout: true,
    degradeOnError: true,
    criticalGateAlwaysOn: true,
    qualityPhaseTimeoutSeconds: 30,
    persistence: 'memory',
  }
}

function defaultGraphConfig(): GraphConfig {
  return {
    dbPath: '.writing/graph_db',
    maxConnections: 10,
    maxEntitiesPerQuery: 100,
    relationDepth: 3,
  }
}

function defaultWritingConfig(): WritingConfig {
  return {
    characterDepthDimensions: 5,
    maxCharacterTraits: 20,
    sceneCoherenceThreshold: 0.8,
    contradictionSensitivity: 'medium',
    foreshadowingMaxDistance: 50,
    foreshadowingReminderThreshold: 10,
    styleVectorDimensions: 30,
    styleSampleMinWords: 5000,
  }
}

function defaultGatewayConfig(): GatewayConfig {
  return {
    host: '0.0.0.0',
    port: 8000,
    reload: true,
    localhostOnly: true,
    localhostOnlyExemptPaths: [],
    corsDevOrigins: ['*'],
    corsProdOrigins: ['https://app.example.com', 'https://gray.example.com'],
    metricsEnabled: true,
    uiBridgeEnabled: false,
    detectionEvasionGuard: true,
  }
}

function defaultBackupConfig(): BackupConfig {
  return {
    backupDir: '.writing/backups',
    compress: true,
    maxBackups: 50,
    webdavEnabled: false,
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    webdavRemotePath: '/backups',
    s3Enabled: false,
    s3Bucket: '',
    s3Prefix: 'backups',
    s3Region: 'us-east-1',
    s3EndpointUrl: '',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    s3ForcePathStyle: false,
  }
}

function defaultTokenConfig(): TokenConfig {
  return {
    dbPath: '.writing/token_usage.db',
    defaultModel: 'gpt-4o',
    defaultBudget: 10.0,
    budgetWarnThreshold: 0.8,
  }
}

function defaultObsidianConfig(): ObsidianConfig {
  return {
    enabled: true,
    autoDiscover: true,
    syncOnStartup: false,
    defaultVault: '',
    filePatterns: ['*.md'],
  }
}

function defaultIntegrationConfig(): IntegrationConfig {
  return {
    postgresEnabled: false,
    redisCacheEnabled: false,
    elasticsearchEnabled: false,
    neo4jEnabled: false,
    langflowEnabled: false,
    dbhubGovernanceEnabled: false,
    searchRouteMode: 'legacy',
    searchElasticTimeoutMs: 300,
    redisRateLimit: 120,
    redisRateLimitWindowSeconds: 60,
    langflowFlowName: 'niko-search-pilot',
    redisCacheTtlSeconds: 120,
  }
}

export function defaultAppConfig(): AppConfig {
  return {
    appName: 'niko-studio',
    version: APP_VERSION,
    debug: false,
    env: 'development',
    dataDir: '.writing',
    logDir: 'logs',
    agent: defaultAgentConfig(),
    memory: defaultMemoryConfig(),
    workflow: defaultWorkflowConfig(),
    graph: defaultGraphConfig(),
    writing: defaultWritingConfig(),
    gateway: defaultGatewayConfig(),
    backup: defaultBackupConfig(),
    token: defaultTokenConfig(),
    obsidian: defaultObsidianConfig(),
    integration: defaultIntegrationConfig(),
  }
}

// ---------------------------------------------------------------------------
// Simple YAML parser (handles the flat + one-level-nested config format)
// ---------------------------------------------------------------------------

/**
 * Minimal YAML parser that supports the niko-studio config format:
 * - Top-level scalars (key: value)
 * - Nested sections (key: followed by indented key: value pairs)
 * - String, number, boolean, and list-of-string values
 *
 * This avoids adding a YAML npm dependency.
 */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n')
  let currentSection: string | null = null
  let currentObject: Record<string, unknown> | null = null
  let currentListKey: string | null = null
  let currentList: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trimStart()

    // Skip blanks and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      // Flush any pending list
      flushList()
      continue
    }

    const indent = rawLine.length - trimmed.length

    // List item (dash with space)
    if (indent >= 2 && trimmed.startsWith('- ')) {
      const value = parseScalar(trimmed.slice(2).trim())
      if (currentListKey && currentObject) {
        currentList.push(String(value))
      }
      continue
    }

    // Flush previous list when encountering a non-list line
    flushList()

    // Key: value
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    const rawValue = trimmed.slice(colonIdx + 1).trim()

    if (indent === 0) {
      // Top-level key
      if (rawValue === '') {
        // Section header
        currentSection = key
        currentObject = {}
        result[key] = currentObject
      } else {
        currentSection = null
        currentObject = null
        result[key] = parseScalar(rawValue)
      }
    } else if (currentSection && currentObject) {
      // Nested key under a section
      if (rawValue === '') {
        // Could be start of a list
        currentListKey = key
        currentList = []
      } else {
        currentObject[key] = parseScalar(rawValue)
      }
    }
  }

  // Final flush
  flushList()

  return result

  function flushList(): void {
    if (currentListKey && currentObject) {
      currentObject[currentListKey] = currentList
    }
    currentListKey = null
    currentList = []
  }
}

function parseScalar(raw: string): unknown {
  // Remove surrounding quotes
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1)
  }

  const lower = raw.toLowerCase()
  if (lower === 'true') return true
  if (lower === 'false') return false
  if (lower === 'null' || lower === '~') return null

  // Number
  const num = Number(raw)
  if (!isNaN(num) && raw !== '') return num

  return raw
}

// ---------------------------------------------------------------------------
// ConfigManager
// ---------------------------------------------------------------------------

export type ConfigChangeListener = (event: ConfigChangeEvent) => void

const CONFIG_CHANGE_EVENT = 'config-change'

export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager | null = null

  private configPath: string | null
  private hotReload: boolean
  private autoCreate: boolean

  private config: AppConfig
  private rawConfig: Record<string, unknown>
  private overrides: Map<string, unknown>
  private watcher: fs.FSWatcher | null
  private lastModified: number
  private debounceMs: number

  private initialized: boolean

  private constructor(
    configPath?: string,
    hotReload: boolean = true,
    autoCreate: boolean = true,
  ) {
    super()

    this.configPath = configPath ?? null
    this.hotReload = hotReload
    this.autoCreate = autoCreate

    this.config = defaultAppConfig()
    this.rawConfig = {}
    this.overrides = new Map()
    this.watcher = null
    this.lastModified = 0
    this.debounceMs = 1000
    this.initialized = false

    this.loadConfig()

    if (hotReload && this.configPath && fs.existsSync(this.configPath)) {
      this.startFileWatcher()
    }

    this.initialized = true
  }

  // ---- Singleton access ----

  static getInstance(
    configPath?: string,
    hotReload?: boolean,
    autoCreate?: boolean,
  ): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configPath, hotReload, autoCreate)
    }
    return ConfigManager.instance
  }

  static resetInstance(): void {
    if (ConfigManager.instance) {
      ConfigManager.instance.shutdown()
    }
    ConfigManager.instance = null
  }

  // ---- Internal loading ----

  private loadConfig(): void {
    // 1. Defaults
    this.config = defaultAppConfig()

    // 2. Global config (~/.niko/config.yaml or ~/.niko/config.json)
    this.loadGlobalConfig()

    // 3. Environment variables
    this.loadFromEnv()

    // 4. Project config file
    if (this.configPath) {
      if (fs.existsSync(this.configPath)) {
        this.loadFromFile()
      } else if (this.autoCreate) {
        this.createDefaultConfigFile()
      }
    }

    // 5. Runtime overrides
    this.applyOverrides()
  }

  private loadGlobalConfig(): void {
    const homeDir = os.homedir()
    const globalPaths = [
      path.join(homeDir, '.niko', 'config.yaml'),
      path.join(homeDir, '.niko', 'config.json'),
    ]
    for (const gPath of globalPaths) {
      if (fs.existsSync(gPath)) {
        try {
          const content = fs.readFileSync(gPath, 'utf-8')
          const data = gPath.endsWith('.json')
            ? JSON.parse(content) as Record<string, unknown>
            : parseSimpleYaml(content)
          this.applyDictToConfig(data)
          return
        } catch {
          // skip malformed global config
        }
      }
    }
  }

  private loadFromEnv(): void {
    const env = process.env

    function parseBool(raw: string | undefined): boolean {
      if (!raw) return false
      return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase())
    }

    function parseCsv(raw: string | undefined): string[] {
      if (!raw) return []
      return raw.split(',').map(s => s.trim()).filter(s => s.length > 0)
    }

    // Base config
    if (env.NIKO_DEBUG) this.config.debug = parseBool(env.NIKO_DEBUG)
    if (env.NIKO_ENV) this.config.env = env.NIKO_ENV

    // Agent
    if (env.NIKO_DEFAULT_MODEL) this.config.agent.defaultModel = env.NIKO_DEFAULT_MODEL
    if (env.GOOGLE_API_KEY) this.config.agent.googleApiKey = env.GOOGLE_API_KEY
    if (env.OPENAI_API_KEY) this.config.agent.openaiApiKey = env.OPENAI_API_KEY
    if (env.NIKO_MAX_COST_PER_REQUEST) {
      const v = parseFloat(env.NIKO_MAX_COST_PER_REQUEST);
      if (Number.isFinite(v)) this.config.agent.maxCostPerRequest = v;
    }
    if (env.NIKO_MAX_COST_PER_SESSION) {
      const v = parseFloat(env.NIKO_MAX_COST_PER_SESSION);
      if (Number.isFinite(v)) this.config.agent.maxCostPerSession = v;
    }

    // Memory
    if (env.NIKO_VECTOR_DB_PATH) this.config.memory.vectorDbPath = env.NIKO_VECTOR_DB_PATH
    if (env.NIKO_EMBEDDING_MODEL) this.config.memory.embeddingModel = env.NIKO_EMBEDDING_MODEL
    if (env.NIKO_MEMORY_BACKEND) {
      const v = env.NIKO_MEMORY_BACKEND.toLowerCase();
      if (v === 'sqlite' || v === 'fs') this.config.memory.backend = v;
    }

    // Graph
    if (env.NIKO_GRAPH_DB_PATH) this.config.graph.dbPath = env.NIKO_GRAPH_DB_PATH

    // Workflow
    if (env.NIKO_WORKFLOW_QUALITY_MODE) this.config.workflow.qualityMode = env.NIKO_WORKFLOW_QUALITY_MODE
    if (env.NIKO_WORKFLOW_QUALITY_LEVEL) this.config.workflow.qualityLevel = env.NIKO_WORKFLOW_QUALITY_LEVEL
    if (env.NIKO_WORKFLOW_DEGRADE_ON_TIMEOUT) this.config.workflow.degradeOnTimeout = parseBool(env.NIKO_WORKFLOW_DEGRADE_ON_TIMEOUT)
    if (env.NIKO_WORKFLOW_DEGRADE_ON_ERROR) this.config.workflow.degradeOnError = parseBool(env.NIKO_WORKFLOW_DEGRADE_ON_ERROR)
    if (env.NIKO_WORKFLOW_CRITICAL_GATE_ALWAYS_ON) this.config.workflow.criticalGateAlwaysOn = parseBool(env.NIKO_WORKFLOW_CRITICAL_GATE_ALWAYS_ON)
    if (env.NIKO_WORKFLOW_QUALITY_PHASE_TIMEOUT_SECONDS) {
      this.config.workflow.qualityPhaseTimeoutSeconds = parseInt(env.NIKO_WORKFLOW_QUALITY_PHASE_TIMEOUT_SECONDS, 10)
    }
    if (env.NIKO_WORKFLOW_PERSISTENCE) {
      const v = env.NIKO_WORKFLOW_PERSISTENCE.toLowerCase();
      if (v === 'sqlite' || v === 'memory') this.config.workflow.persistence = v;
    }

    // Gateway
    if (env.NIKO_GATEWAY_HOST) this.config.gateway.host = env.NIKO_GATEWAY_HOST
    if (env.NIKO_GATEWAY_PORT) this.config.gateway.port = parseInt(env.NIKO_GATEWAY_PORT, 10)
    if (env.NIKO_GATEWAY_RELOAD) this.config.gateway.reload = parseBool(env.NIKO_GATEWAY_RELOAD)
    if (env.NIKO_GATEWAY_LOCALHOST_ONLY) this.config.gateway.localhostOnly = parseBool(env.NIKO_GATEWAY_LOCALHOST_ONLY)
    if (env.NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS) this.config.gateway.localhostOnlyExemptPaths = parseCsv(env.NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS)
    if (env.NIKO_CORS_DEV_ORIGINS) this.config.gateway.corsDevOrigins = parseCsv(env.NIKO_CORS_DEV_ORIGINS)
    if (env.NIKO_CORS_PROD_ORIGINS) this.config.gateway.corsProdOrigins = parseCsv(env.NIKO_CORS_PROD_ORIGINS)
    if (env.NIKO_GATEWAY_METRICS_ENABLED) this.config.gateway.metricsEnabled = parseBool(env.NIKO_GATEWAY_METRICS_ENABLED)
    if (env.NIKO_UI_BRIDGE_ENABLED) this.config.gateway.uiBridgeEnabled = parseBool(env.NIKO_UI_BRIDGE_ENABLED)
    if (env.NIKO_GATEWAY_DETECTION_EVASION_GUARD) this.config.gateway.detectionEvasionGuard = parseBool(env.NIKO_GATEWAY_DETECTION_EVASION_GUARD)

    // Integration feature flags
    if (env.NIKO_POSTGRES_ENABLED) this.config.integration.postgresEnabled = parseBool(env.NIKO_POSTGRES_ENABLED)
    if (env.NIKO_REDIS_CACHE_ENABLED) this.config.integration.redisCacheEnabled = parseBool(env.NIKO_REDIS_CACHE_ENABLED)
    if (env.NIKO_ELASTICSEARCH_ENABLED) this.config.integration.elasticsearchEnabled = parseBool(env.NIKO_ELASTICSEARCH_ENABLED)
    if (env.NIKO_NEO4J_ENABLED) this.config.integration.neo4jEnabled = parseBool(env.NIKO_NEO4J_ENABLED)
    if (env.NIKO_LANGFLOW_ENABLED) this.config.integration.langflowEnabled = parseBool(env.NIKO_LANGFLOW_ENABLED)
    if (env.NIKO_DBHUB_GOVERNANCE_ENABLED) this.config.integration.dbhubGovernanceEnabled = parseBool(env.NIKO_DBHUB_GOVERNANCE_ENABLED)
    if (env.NIKO_SEARCH_ROUTE_MODE) this.config.integration.searchRouteMode = env.NIKO_SEARCH_ROUTE_MODE
    if (env.NIKO_SEARCH_ELASTIC_TIMEOUT_MS) this.config.integration.searchElasticTimeoutMs = parseInt(env.NIKO_SEARCH_ELASTIC_TIMEOUT_MS, 10)
    if (env.NIKO_REDIS_RATE_LIMIT) this.config.integration.redisRateLimit = parseInt(env.NIKO_REDIS_RATE_LIMIT, 10)
    if (env.NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS) this.config.integration.redisRateLimitWindowSeconds = parseInt(env.NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS, 10)
    if (env.NIKO_LANGFLOW_FLOW_NAME) this.config.integration.langflowFlowName = env.NIKO_LANGFLOW_FLOW_NAME
    if (env.NIKO_REDIS_CACHE_TTL_SECONDS) this.config.integration.redisCacheTtlSeconds = parseInt(env.NIKO_REDIS_CACHE_TTL_SECONDS, 10)
  }

  private loadFromFile(): void {
    if (!this.configPath || !fs.existsSync(this.configPath)) return

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8')
      const ext = path.extname(this.configPath).toLowerCase()

      let data: Record<string, unknown>
      if (ext === '.json') {
        data = JSON.parse(content) as Record<string, unknown>
      } else {
        // YAML - use simple parser
        data = parseSimpleYaml(content)
      }

      this.rawConfig = data
      this.applyDictToConfig(data)
    } catch (err) {
      log.error(`Failed to load config from ${this.configPath}`, { error: String(err) })
    }
  }

  private applyDictToConfig(data: Record<string, unknown>): void {
    // Base config
    if ('app_name' in data) this.config.appName = data.app_name as string
    if ('appName' in data) this.config.appName = data.appName as string
    if ('version' in data) this.config.version = data.version as string
    if ('debug' in data) this.config.debug = data.debug as boolean
    if ('env' in data) this.config.env = data.env as string
    if ('data_dir' in data) this.config.dataDir = data.data_dir as string
    if ('dataDir' in data) this.config.dataDir = data.dataDir as string

    // Sub-configs - apply known keys from dict to matching sub-config object
    this.applySubConfig(data, 'agent', this.config.agent)
    this.applySubConfig(data, 'memory', this.config.memory)
    this.applySubConfig(data, 'workflow', this.config.workflow)
    this.applySubConfig(data, 'graph', this.config.graph)
    this.applySubConfig(data, 'writing', this.config.writing)
    this.applySubConfig(data, 'gateway', this.config.gateway)
    this.applySubConfig(data, 'integration', this.config.integration)
  }

  private applySubConfig(
    data: Record<string, unknown>,
    section: string,
    target: AgentConfig | MemoryConfig | WorkflowConfig | GraphConfig | WritingConfig | GatewayConfig | BackupConfig | TokenConfig | ObsidianConfig | IntegrationConfig,
  ): void {
    const sectionData = data[section]
    if (!sectionData || typeof sectionData !== 'object') return

    const targetRecord = target as unknown as Record<string, unknown>
    const source = sectionData as Record<string, unknown>
    for (const [key, value] of Object.entries(source)) {
      // Convert snake_case YAML keys to camelCase if needed
      const camelKey = snakeToCamel(key)
      if (camelKey in targetRecord) {
        targetRecord[camelKey] = value
      } else if (key in targetRecord) {
        targetRecord[key] = value
      }
    }
  }

  private applyOverrides(): void {
    for (const [key, value] of this.overrides) {
      this.set(key, value, true)
    }
  }

  private createDefaultConfigFile(): void {
    if (!this.configPath) return

    const dir = path.dirname(this.configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const content = `# Niko-Studio Configuration
# This file supports hot-reload - changes apply automatically

app_name: niko-studio
version: "${APP_VERSION}"
debug: false
env: development
data_dir: .writing

agent:
  default_model: gpt-4o
  google_api_key: ""
  openai_api_key: ""
  max_cost_per_request: 1.0
  max_cost_per_session: 10.0
  max_tokens_per_request: 100000
  budget_warn_threshold: 0.8
  log_level: INFO

memory:
  vector_db_path: .writing/vector_store
  embedding_model: BAAI/bge-small-en-v1.5
  embedding_dimension: 384
  cache_enabled: true
  cache_ttl: 86400
  cache_max_size: 2000
  chunk_size: 1000
  chunk_overlap: 200

workflow:
  session_timeout: 3600
  max_concurrent_sessions: 10
  checkpoint_enabled: true
  checkpoint_interval: 300
  resume_strategy: from_last_checkpoint
  quality_mode: auto
  quality_level: high
  degrade_on_timeout: true
  degrade_on_error: true
  critical_gate_always_on: true
  quality_phase_timeout_seconds: 30

graph:
  db_path: .writing/graph_db
  max_connections: 10
  max_entities_per_query: 100
  relation_depth: 3

writing:
  character_depth_dimensions: 5
  max_character_traits: 20
  scene_coherence_threshold: 0.8
  contradiction_sensitivity: medium
  foreshadowing_max_distance: 50
  foreshadowing_reminder_threshold: 10
  style_vector_dimensions: 30
  style_sample_min_words: 5000

gateway:
  host: 0.0.0.0
  port: 8000
  reload: true
  localhost_only: true
  localhost_only_exempt_paths: []
  cors_dev_origins:
    - "*"
  cors_prod_origins:
    - https://app.example.com
    - https://gray.example.com
  metrics_enabled: true
  ui_bridge_enabled: false
  detection_evasion_guard: true

integration:
  postgres_enabled: false
  redis_cache_enabled: false
  elasticsearch_enabled: false
  neo4j_enabled: false
  langflow_enabled: false
  dbhub_governance_enabled: false
  search_route_mode: legacy
  search_elastic_timeout_ms: 300
  redis_rate_limit: 120
  redis_rate_limit_window_seconds: 60
  langflow_flow_name: niko-search-pilot
  redis_cache_ttl_seconds: 120
`
    fs.writeFileSync(this.configPath, content, 'utf-8')
  }

  // ---- File watching ----

  private startFileWatcher(): void {
    if (!this.configPath) return

    const dir = path.dirname(this.configPath)
    const basename = path.basename(this.configPath)

    try {
      this.watcher = fs.watch(dir, (eventType, filename) => {
        if (filename !== basename) return

        // Debounce
        const now = Date.now()
        if (now - this.lastModified < this.debounceMs) return
        this.lastModified = now

        this.reloadFromSource()
      })
    } catch (err) {
      log.error(`Failed to start config file watcher`, { error: String(err) })
    }
  }

  private reloadFromSource(): void {
    const oldConfig = this.config
    this.loadConfig()

    const event: ConfigChangeEvent = {
      key: '*',
      oldValue: oldConfig,
      newValue: this.config,
      source: ConfigSource.File,
      timestamp: Date.now(),
    }
    this.emit(CONFIG_CHANGE_EVENT, event)
  }

  // ---- Public API ----

  getConfig(): AppConfig {
    return this.config
  }

  get(key: string, defaultValue: unknown = undefined): unknown {
    const parts = key.split('.')
    let obj: unknown = this.config

    for (const part of parts) {
      if (obj === null || obj === undefined || typeof obj !== 'object') {
        return defaultValue
      }
      if (part in (obj as Record<string, unknown>)) {
        obj = (obj as Record<string, unknown>)[part]
      } else {
        return defaultValue
      }
    }

    return obj
  }

  set(key: string, value: unknown, skipOverride: boolean = false): void {
    const parts = key.split('.')
    let obj: Record<string, unknown> = this.config as unknown as Record<string, unknown>

    // Navigate to parent
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (part in obj && typeof obj[part] === 'object' && obj[part] !== null) {
        obj = obj[part] as Record<string, unknown>
      } else {
        return
      }
    }

    const finalKey = parts[parts.length - 1]
    if (!(finalKey in obj)) return

    const oldValue = obj[finalKey]
    obj[finalKey] = value

    if (!skipOverride) {
      this.overrides.set(key, value)

      const event: ConfigChangeEvent = {
        key,
        oldValue,
        newValue: value,
        source: ConfigSource.Override,
        timestamp: Date.now(),
      }
      this.emit(CONFIG_CHANGE_EVENT, event)
    }
  }

  onChange(listener: ConfigChangeListener): void {
    this.on(CONFIG_CHANGE_EVENT, listener)
  }

  offChange(listener: ConfigChangeListener): void {
    this.off(CONFIG_CHANGE_EVENT, listener)
  }

  reload(): void {
    const oldConfig = this.config
    this.loadConfig()

    const event: ConfigChangeEvent = {
      key: '*',
      oldValue: oldConfig,
      newValue: this.config,
      source: ConfigSource.File,
      timestamp: Date.now(),
    }
    this.emit(CONFIG_CHANGE_EVENT, event)
  }

  shutdown(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    this.removeAllListeners()
  }

  toDict(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this.config))
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Module-level convenience functions (match Python API)
// ---------------------------------------------------------------------------

let configManager: ConfigManager | null = null
const APP_CONFIG_PATH_ENV = 'NIKO_APP_CONFIG_PATH'

function resolveDefaultConfigPath(): string {
  const envConfigPath = process.env[APP_CONFIG_PATH_ENV]?.trim()
  if (envConfigPath) {
    return envConfigPath
  }

  const candidates = [
    'config/niko-studio.yaml',
    'config/niko-studio.json',
    'niko-studio.yaml',
    'niko-studio.json',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return 'config/niko-studio.yaml'
}

export function initConfig(
  configPath?: string,
  hotReload: boolean = true,
): ConfigManager {
  if (configPath === undefined) {
    configPath = resolveDefaultConfigPath()
  }

  configManager = ConfigManager.getInstance(configPath, hotReload)
  return configManager
}

export function getConfig(): AppConfig {
  if (!configManager) {
    configManager = ConfigManager.getInstance()
  }
  return configManager.getConfig()
}

export function getConfigValue(key: string, defaultValue: unknown = undefined): unknown {
  if (!configManager) {
    configManager = ConfigManager.getInstance()
  }
  return configManager.get(key, defaultValue)
}

export function setConfigValue(key: string, value: unknown): void {
  if (!configManager) {
    configManager = ConfigManager.getInstance()
  }
  configManager.set(key, value)
}

export function validateEnvironment(strict: boolean = false): string[] {
  const config = getConfig()
  const errors: string[] = []

  if (!config.agent.googleApiKey && !config.agent.openaiApiKey) {
    errors.push('Missing LLM credentials: set GOOGLE_API_KEY or OPENAI_API_KEY')
  }

  if (strict && config.env !== 'development') {
    if (!config.graph.dbPath) {
      errors.push('Missing NIKO_GRAPH_DB_PATH or graph.dbPath configuration')
    }
  }

  return errors
}

export function ensureEnvironment(strict: boolean = false): void {
  const config = getConfig()
  const errors = validateEnvironment(strict)
  if (errors.length === 0) return

  const msg = 'Environment pre-check issues:\n- ' + errors.join('\n- ')

  // In desktop mode, missing LLM credentials should warn but not crash —
  // users configure API keys through the UI after first launch.
  const llmOnly = errors.length === 1
    && errors[0].includes('Missing LLM credentials')
  if (config.env === 'development' && !strict) {
    log.warn(msg)
  } else if (llmOnly && !strict) {
    log.warn(msg)
  } else {
    throw new Error(msg)
  }
}

/**
 * Validate the current AppConfig, returning issues grouped by severity.
 * Pattern learned from maestro-flow: runtime validation without Zod dependency.
 */
export function validateConfig(): { errors: string[]; warnings: string[] } {
  const config = getConfig()
  const errors: string[] = []
  const warnings: string[] = []

  // Agent
  if (config.agent.maxCostPerRequest < 0) errors.push('agent.maxCostPerRequest must be >= 0')
  if (config.agent.maxCostPerSession < 0) errors.push('agent.maxCostPerSession must be >= 0')
  if (config.agent.maxTokensPerRequest < 1) errors.push('agent.maxTokensPerRequest must be >= 1')

  // Memory
  if (config.memory.backend !== 'sqlite' && config.memory.backend !== 'fs') {
    errors.push('memory.backend must be "sqlite" or "fs"')
  }
  if (config.memory.cacheMaxSize < 0) warnings.push('memory.cacheMaxSize < 0 may cause cache issues')
  if (config.memory.chunkSize < 100) warnings.push('memory.chunkSize < 100 may produce poor chunks')

  // Workflow
  if (config.workflow.persistence !== 'sqlite' && config.workflow.persistence !== 'memory') {
    errors.push('workflow.persistence must be "sqlite" or "memory"')
  }
  if (config.workflow.sessionTimeout < 60) warnings.push('workflow.sessionTimeout < 60s may cause premature expiry')

  // Gateway
  if (config.gateway.port < 1 || config.gateway.port > 65535) errors.push('gateway.port must be 1-65535')

  // Graph
  if (config.graph.maxConnections < 1) errors.push('graph.maxConnections must be >= 1')
  if (config.graph.relationDepth < 1) warnings.push('graph.relationDepth < 1 disables traversal')

  return { errors, warnings }
}
