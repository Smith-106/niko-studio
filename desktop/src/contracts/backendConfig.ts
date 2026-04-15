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

export interface ConfigError {
  field: string
  error: string
}
