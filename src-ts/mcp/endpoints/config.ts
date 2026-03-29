/**
 * Config REST Endpoints
 *
 * Configuration management HTTP endpoints for Desktop frontend.
 * Ported from src/mcp/endpoints/config.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

const SECRET_FIELDS: string[] = [
  'agent.google_api_key',
  'agent.openai_api_key',
  'backup.webdav_password',
];

const MODIFIABLE_FIELDS: string[] = [
  'agent.default_model',
  'agent.max_cost_per_request',
  'agent.max_cost_per_session',
  'agent.max_tokens_per_request',
  'agent.budget_warn_threshold',
  'agent.log_level',
  'memory.cache_enabled',
  'memory.cache_ttl',
  'memory.cache_max_size',
  'memory.chunk_size',
  'memory.chunk_overlap',
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
  'writing.character_depth_dimensions',
  'writing.max_character_traits',
  'writing.scene_coherence_threshold',
  'writing.contradiction_sensitivity',
  'writing.foreshadowing_max_distance',
  'writing.foreshadowing_reminder_threshold',
  'writing.style_vector_dimensions',
  'writing.style_sample_min_words',
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
  'token.default_budget',
  'token.budget_warn_threshold',
  'obsidian.enabled',
  'obsidian.auto_discover',
  'obsidian.sync_on_startup',
  'obsidian.default_vault',
  'gateway.metrics_enabled',
  'gateway.ui_bridge_enabled',
];

const MASKED_VALUE = '***MASKED***';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function maskSecrets(configDict: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(configDict)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = maskSecrets(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  for (const secretPath of SECRET_FIELDS) {
    const parts = secretPath.split('.');
    if (parts.length === 2) {
      const [section, field] = parts;
      const sectionData = result[section] as Record<string, unknown> | undefined;
      if (sectionData && sectionData[field]) {
        sectionData[field] = MASKED_VALUE;
      }
    }
  }

  return result;
}

function setNestedValue(
  configDict: Record<string, unknown>,
  key: string,
  value: unknown
): boolean {
  const parts = key.split('.');
  if (parts.length !== 2) return false;

  const [section, field] = parts;
  const sectionData = configDict[section] as Record<string, unknown> | undefined;
  if (!sectionData) return false;
  if (!(field in sectionData)) return false;

  sectionData[field] = value;
  return true;
}

// ---------------------------------------------------------------
// Config accessor interface (to be wired)
// ---------------------------------------------------------------

interface ConfigAccess {
  getConfig(): unknown;
  getConfigValue(key: string): unknown;
  setConfigValue(key: string, value: unknown): void;
  reloadConfig(): void;
}

let configAccess: ConfigAccess | null = null;

export function setConfigAccess(access: ConfigAccess): void {
  configAccess = access;
}

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------

export async function getConfig(_request: HttpRequest): Promise<HttpResponse> {
  if (!configAccess) {
    return jsonResponse({ error: 'Config access not initialized' }, 500);
  }

  try {
    const config = configAccess.getConfig();
    const configDict = config as Record<string, unknown>;
    const maskedConfig = maskSecrets(configDict);

    return jsonResponse({
      status: 'ok',
      config: maskedConfig,
    });
  } catch (e) {
    return jsonResponse({ error: `Failed to get configuration: ${String(e)}` }, 500);
  }
}

export async function updateConfig(request: HttpRequest): Promise<HttpResponse> {
  if (!configAccess) {
    return jsonResponse({ error: 'Config access not initialized' }, 500);
  }

  try {
    const body = parseBody(request) as { fields?: Record<string, unknown> };
    const fields = body.fields ?? {};

    if (Object.keys(fields).length === 0) {
      return jsonResponse({ error: 'No fields provided for update' }, 400);
    }

    const updated: string[] = [];
    const errors: Array<{ field: string; error: string }> = [];

    for (const [key, value] of Object.entries(fields)) {
      if (!MODIFIABLE_FIELDS.includes(key)) {
        errors.push({ field: key, error: `Field '${key}' is not modifiable via API` });
        continue;
      }

      try {
        configAccess.setConfigValue(key, value);
        updated.push(key);
      } catch (e) {
        errors.push({ field: key, error: String(e) });
      }
    }

    const response: Record<string, unknown> = { status: 'ok' };
    if (updated.length > 0) response.updated = updated;
    if (errors.length > 0) response.errors = errors;

    return jsonResponse(response, errors.length > 0 ? 400 : 200);
  } catch (e) {
    return jsonResponse({ error: `Failed to update configuration: ${String(e)}` }, 500);
  }
}

export async function getSecrets(_request: HttpRequest): Promise<HttpResponse> {
  if (!configAccess) {
    return jsonResponse({ error: 'Config access not initialized' }, 500);
  }

  try {
    const secretsStatus: Record<string, { configured: boolean; value: string }> = {};

    for (const secretPath of SECRET_FIELDS) {
      const value = configAccess.getConfigValue(secretPath);
      secretsStatus[secretPath] = {
        configured: !!value,
        value: value ? MASKED_VALUE : '',
      };
    }

    return jsonResponse({
      status: 'ok',
      secrets: secretsStatus,
    });
  } catch (e) {
    return jsonResponse({ error: `Failed to get secrets: ${String(e)}` }, 500);
  }
}

export async function updateSecrets(request: HttpRequest): Promise<HttpResponse> {
  if (!configAccess) {
    return jsonResponse({ error: 'Config access not initialized' }, 500);
  }

  try {
    const body = parseBody(request) as { secrets?: Record<string, string> };
    const secrets = body.secrets ?? {};

    if (Object.keys(secrets).length === 0) {
      return jsonResponse({ error: 'No secrets provided for update' }, 400);
    }

    const updated: string[] = [];
    const errors: Array<{ field: string; error: string }> = [];

    for (const [key, value] of Object.entries(secrets)) {
      if (!SECRET_FIELDS.includes(key)) {
        errors.push({ field: key, error: `Field '${key}' is not a secret field` });
        continue;
      }

      try {
        configAccess.setConfigValue(key, value);
        updated.push(key);
      } catch (e) {
        errors.push({ field: key, error: String(e) });
      }
    }

    const response: Record<string, unknown> = { status: 'ok' };
    if (updated.length > 0) response.updated = updated;
    if (errors.length > 0) response.errors = errors;

    return jsonResponse(response, errors.length > 0 ? 400 : 200);
  } catch (e) {
    return jsonResponse({ error: `Failed to update secrets: ${String(e)}` }, 500);
  }
}

export async function reloadConfig(_request: HttpRequest): Promise<HttpResponse> {
  if (!configAccess) {
    return jsonResponse({ error: 'Config access not initialized' }, 500);
  }

  try {
    configAccess.reloadConfig();
    return jsonResponse({
      status: 'ok',
      message: 'Configuration reloaded successfully',
    });
  } catch (e) {
    return jsonResponse({ error: `Failed to reload configuration: ${String(e)}` }, 500);
  }
}
