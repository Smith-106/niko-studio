import { type ApiResponse, callApi } from './core'
// Modifiable fields whitelist (mirrors backend MODIFIABLE_FIELDS)
export const MODIFIABLE_FIELDS: string[] = [
  // Agent config
  'agent.default_model',
  'agent.max_cost_per_request',
  'agent.max_cost_per_session',
  'agent.max_tokens_per_request',
  'agent.budget_warn_threshold',
  'agent.log_level',
  // Memory config
  'memory.cache_enabled',
  'memory.cache_ttl',
  'memory.cache_max_size',
  'memory.chunk_size',
  'memory.chunk_overlap',
  // Workflow config
  'workflow.session_timeout',
  'workflow.max_concurrent_sessions',
  'workflow.checkpoint_enabled',
  'workflow.checkpoint_interval',
  'workflow.resume_strategy',
  'workflow.quality_mode',
  'workflow.quality_level',
  'workflow.degrade_on_timeout',
  'workflow.degrade_on_error',
  'workflow.critical_gate_always_on',
  'workflow.quality_phase_timeout_seconds',
  // Writing config
  'writing.character_depth_dimensions',
  'writing.max_character_traits',
  'writing.scene_coherence_threshold',
  'writing.contradiction_sensitivity',
  'writing.foreshadowing_max_distance',
  'writing.foreshadowing_reminder_threshold',
  'writing.style_vector_dimensions',
  'writing.style_sample_min_words',
  // Backup config
  'backup.backup_dir',
  'backup.compress',
  'backup.max_backups',
  'backup.webdav_enabled',
  'backup.webdav_url',
  'backup.webdav_username',
  'backup.webdav_remote_path',
  'backup.s3_enabled',
  'backup.s3_bucket',
  'backup.s3_prefix',
  'backup.s3_region',
  'backup.s3_endpoint_url',
  'backup.s3_access_key_id',
  'backup.s3_force_path_style',
  // Token config
  'token.default_budget',
  'token.budget_warn_threshold',
  // Obsidian config
  'obsidian.enabled',
  'obsidian.auto_discover',
  'obsidian.sync_on_startup',
  'obsidian.default_vault',
  'gateway.localhost_only',
  'gateway.localhost_only_exempt_paths',
  'gateway.detection_evasion_guard',
  // Gateway config (limited)
  'gateway.metrics_enabled',
  'gateway.ui_bridge_enabled',
  'integration.dbhub_governance_enabled',
  'integration.search_route_mode',
  'integration.search_elastic_timeout_ms',
  'integration.redis_rate_limit',
  'integration.redis_rate_limit_window_seconds',
  'integration.langflow_enabled',
  'integration.langflow_flow_name',
  'integration.redis_cache_ttl_seconds',
]

// Secret fields (mirrors backend SECRET_FIELDS)
export const SECRET_FIELDS: string[] = [
  'agent.google_api_key',
  'agent.openai_api_key',
  'backup.webdav_password',
  'backup.s3_secret_access_key',
]

// Config section interfaces matching backend dataclasses
export interface AgentConfig {
  max_cost_per_request: number
  max_cost_per_session: number
  max_tokens_per_request: number
  budget_warn_threshold: number
  default_model: string
  google_api_key: string
  openai_api_key: string
  log_level: string
}

export interface MemoryConfig {
  vector_db_path: string
  embedding_model: string
  embedding_dimension: number
  cache_enabled: boolean
  cache_ttl: number
  cache_max_size: number
  chunk_size: number
  chunk_overlap: number
}

export interface WorkflowConfig {
  session_timeout: number
  max_concurrent_sessions: number
  checkpoint_enabled: boolean
  checkpoint_interval: number
  resume_strategy: string
  quality_mode: string
  quality_level: string
  degrade_on_timeout: boolean
  degrade_on_error: boolean
  critical_gate_always_on: boolean
  quality_phase_timeout_seconds: number
}

export interface GraphConfig {
  db_path: string
  max_connections: number
  max_entities_per_query: number
  relation_depth: number
}

export interface WritingConfig {
  character_depth_dimensions: number
  max_character_traits: number
  scene_coherence_threshold: number
  contradiction_sensitivity: string
  foreshadowing_max_distance: number
  foreshadowing_reminder_threshold: number
  style_vector_dimensions: number
  style_sample_min_words: number
}

export interface GatewayConfig {
  host: string
  port: number
  reload: boolean
  localhost_only: boolean
  localhost_only_exempt_paths: string[]
  cors_dev_origins: string[]
  cors_prod_origins: string[]
  metrics_enabled: boolean
  ui_bridge_enabled: boolean
  detection_evasion_guard: boolean
}

export interface BackupConfig {
  backup_dir: string
  compress: boolean
  max_backups: number
  webdav_enabled: boolean
  webdav_url: string
  webdav_username: string
  webdav_password: string
  webdav_remote_path: string
  s3_enabled: boolean
  s3_bucket: string
  s3_prefix: string
  s3_region: string
  s3_endpoint_url: string
  s3_access_key_id: string
  s3_secret_access_key: string
  s3_force_path_style: boolean
}

export interface TokenConfig {
  db_path: string
  default_model: string
  default_budget: number
  budget_warn_threshold: number
}

export interface ObsidianConfig {
  enabled: boolean
  auto_discover: boolean
  sync_on_startup: boolean
  default_vault: string
  file_patterns: string[]
}

export interface IntegrationConfig {
  postgres_enabled: boolean
  redis_cache_enabled: boolean
  elasticsearch_enabled: boolean
  neo4j_enabled: boolean
  langflow_enabled: boolean
  dbhub_governance_enabled: boolean
  search_route_mode: string
  search_elastic_timeout_ms: number
  redis_rate_limit: number
  redis_rate_limit_window_seconds: number
  langflow_flow_name: string
  redis_cache_ttl_seconds: number
}

// Main config interface matching backend AppConfig
export interface BackendConfig {
  app_name: string
  version: string
  debug: boolean
  env: string
  data_dir: string
  log_dir: string
  agent: AgentConfig
  memory: MemoryConfig
  workflow: WorkflowConfig
  graph: GraphConfig
  writing: WritingConfig
  backup: BackupConfig
  token: TokenConfig
  obsidian: ObsidianConfig
  gateway: GatewayConfig
  integration: IntegrationConfig
}

// Response types for config endpoints
export interface ConfigResponse {
  status: string
  config: BackendConfig
  modifiable_fields: string[]
}

export interface ConfigUpdateResponse {
  status: string
  updated?: string[]
  errors?: Array<{ field: string; error: string }>
}

export interface SecretFieldStatus {
  configured: boolean
  value: string
}

export interface SecretsResponse {
  status: string
  secrets: Record<string, SecretFieldStatus>
}

export interface SecretsUpdateResponse {
  status: string
  updated?: string[]
  errors?: Array<{ field: string; error: string }>
}

export interface ConfigReloadResponse {
  status: string
  message: string
}

// Error type for config operations
export interface ConfigError {
  field: string
  error: string
}

/**
 * Get current configuration with secrets masked.
 * Returns all 10 config sections with modifiable_fields list.
 */
export async function getConfig(): Promise<ApiResponse<ConfigResponse>> {
  const response = await callApi<Omit<ConfigResponse, 'modifiable_fields'>>('/config', 'GET')
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        ...response.data,
        modifiable_fields: MODIFIABLE_FIELDS,
      },
    }
  }
  return response as ApiResponse<ConfigResponse>
}

/**
 * Update configuration fields.
 * Only modifiable fields can be updated (see MODIFIABLE_FIELDS).
 * Fields should use dot notation (e.g., "agent.default_model").
 */
export async function updateConfig(
  fields: Record<string, unknown>
): Promise<ApiResponse<ConfigUpdateResponse>> {
  return callApi<ConfigUpdateResponse>('/config', 'PUT', { fields })
}

/**
 * Get secret fields status (masked values only).
 * Shows which secrets are configured without exposing actual values.
 */
export async function getSecrets(): Promise<ApiResponse<SecretsResponse>> {
  return callApi<SecretsResponse>('/config/secrets', 'GET')
}

/**
 * Update secret configuration fields.
 * Only secret fields can be updated (see SECRET_FIELDS).
 * Fields should use dot notation (e.g., "agent.google_api_key").
 */
export async function updateSecrets(
  secrets: Record<string, string>
): Promise<ApiResponse<SecretsUpdateResponse>> {
  return callApi<SecretsUpdateResponse>('/config/secrets', 'PUT', { secrets })
}

/**
 * Reload configuration from file.
 * Triggers hot reload of all configuration values.
 */
export async function reloadConfig(): Promise<ApiResponse<ConfigReloadResponse>> {
  return callApi<ConfigReloadResponse>('/config/reload', 'POST')
}
