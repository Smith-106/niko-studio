import type {
  ConfigReloadResponse,
  ConfigResponse,
  ConfigUpdateResponse,
  SecretsResponse,
  SecretsUpdateResponse,
} from '@/contracts/backendConfig'

import { type ApiResponse, callApi } from './core'

export type {
  AgentConfig,
  BackendConfig,
  BackupConfig,
  ConfigError,
  ConfigReloadResponse,
  ConfigResponse,
  ConfigUpdateResponse,
  GatewayConfig,
  GraphConfig,
  IntegrationConfig,
  MemoryConfig,
  ObsidianConfig,
  SecretFieldStatus,
  SecretsResponse,
  SecretsUpdateResponse,
  TokenConfig,
  WorkflowConfig,
  WritingConfig,
} from '@/contracts/backendConfig'
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

/**
 * Get current configuration with secrets masked.
 * Returns all 10 config sections with modifiable_fields list.
 */
export async function getConfig(): Promise<ApiResponse<ConfigResponse>> {
  const response = await callApi<ConfigResponse>('/config', 'GET')
  if (response.success && response.data) {
    return {
      success: true,
      data: {
        ...response.data,
        modifiable_fields: response.data.modifiable_fields ?? MODIFIABLE_FIELDS,
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
