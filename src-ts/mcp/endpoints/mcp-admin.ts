/**
 * MCP Admin Endpoints
 *
 * MCP service configuration CRUD endpoints.
 * Ported from src/mcp/endpoints/mcp_admin.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';

// ---------------------------------------------------------------
// Service config types
// ---------------------------------------------------------------

interface McpServiceConfig {
  id: string;
  enabled: boolean;
  builtin: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------
// Gateway state (to be wired via dependency injection)
// ---------------------------------------------------------------

let mcpServiceConfigs: Map<string, McpServiceConfig> = new Map();
let mcpServiceHealthCache: Map<string, string> = new Map();

export function setMcpServiceState(
  configs: Map<string, McpServiceConfig>,
  healthCache: Map<string, string>
): void {
  mcpServiceConfigs = configs;
  mcpServiceHealthCache = healthCache;
}

function utcNowIso(): string {
  return new Date().toISOString();
}

function serializeServiceConfig(
  config: McpServiceConfig,
  runtimeServices?: Record<string, string> | null
): Record<string, unknown> {
  return {
    id: config.id,
    enabled: config.enabled,
    builtin: config.builtin,
    status: runtimeServices?.[config.id] ?? 'unknown',
  };
}

function updateServiceConfig(
  serviceId: string,
  body: Record<string, unknown>,
  createIfMissing: boolean
): McpServiceConfig {
  if (!createIfMissing && !mcpServiceConfigs.has(serviceId)) {
    throw new Error(`service '${serviceId}' not found`);
  }

  const existing = mcpServiceConfigs.get(serviceId);
  const config: McpServiceConfig = {
    id: serviceId,
    enabled: (body.enabled as boolean) ?? existing?.enabled ?? true,
    builtin: existing?.builtin ?? false,
  };

  mcpServiceConfigs.set(serviceId, config);
  return config;
}

function setServiceEnabled(serviceId: string, enabled: boolean): McpServiceConfig {
  const config = mcpServiceConfigs.get(serviceId);
  if (!config) throw new Error(`service '${serviceId}' not found`);
  if (config.builtin && !enabled) throw new Error('cannot disable builtin service');

  config.enabled = enabled;
  return config;
}

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------

/** GET /admin/mcp/services - List all MCP service configs */
export async function listMcpServices(request: HttpRequest): Promise<HttpResponse> {
  const servicesParam = request.query['services'];
  let runtimeServices: Record<string, string> | null = null;

  if (servicesParam) {
    runtimeServices = {};
    for (const item of servicesParam.split(',')) {
      const colonIdx = item.indexOf(':');
      if (colonIdx > 0) {
        runtimeServices[item.slice(0, colonIdx)] = item.slice(colonIdx + 1);
      }
    }
  }

  const payload = Array.from(mcpServiceConfigs.values()).map((config) =>
    serializeServiceConfig(config, runtimeServices)
  );
  return jsonResponse({ services: payload });
}

/** POST /admin/mcp/services - Create a new MCP service config */
export async function createMcpService(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const rawServiceId = String(body.id ?? body.service_id ?? '').trim().toLowerCase();

  if (!rawServiceId) {
    return jsonResponse({ error: 'id is required' }, 400);
  }
  if (mcpServiceConfigs.has(rawServiceId)) {
    return jsonResponse({ error: `service '${rawServiceId}' already exists` }, 409);
  }

  let config: McpServiceConfig;
  try {
    config = updateServiceConfig(rawServiceId, body, true);
  } catch (exc) {
    return jsonResponse({ error: String(exc) }, 400);
  }

  return jsonResponse({ service: serializeServiceConfig(config) }, 201);
}

/** PUT /admin/mcp/services/:service_id - Update an MCP service config */
export async function updateMcpService(request: HttpRequest): Promise<HttpResponse> {
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  if (!serviceId) {
    return jsonResponse({ error: 'service_id is required' }, 400);
  }

  const body = parseBody(request) as Record<string, unknown>;

  let config: McpServiceConfig;
  try {
    config = updateServiceConfig(serviceId, body, false);
  } catch (exc) {
    const msg = String(exc);
    if (msg.includes('not found')) {
      return jsonResponse({ error: msg }, 404);
    }
    return jsonResponse({ error: msg }, 400);
  }

  return jsonResponse({ service: serializeServiceConfig(config) });
}

/** DELETE /admin/mcp/services/:service_id - Delete an MCP service config */
export async function deleteMcpService(request: HttpRequest): Promise<HttpResponse> {
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  if (!serviceId) {
    return jsonResponse({ error: 'service_id is required' }, 400);
  }

  const config = mcpServiceConfigs.get(serviceId);
  if (!config) {
    return jsonResponse({ error: `service '${serviceId}' not found` }, 404);
  }

  if (config.builtin) {
    return jsonResponse({ error: 'cannot delete builtin service' }, 400);
  }

  mcpServiceConfigs.delete(serviceId);
  mcpServiceHealthCache.delete(serviceId);

  return jsonResponse({ status: 'deleted', service_id: serviceId });
}

/** POST /admin/mcp/services/:service_id/enabled - Enable/disable an MCP service */
export async function setMcpServiceEnabled(request: HttpRequest): Promise<HttpResponse> {
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  if (!serviceId) {
    return jsonResponse({ error: 'service_id is required' }, 400);
  }

  const body = parseBody(request) as Record<string, unknown>;
  const enabled = body.enabled;
  if (typeof enabled !== 'boolean') {
    return jsonResponse({ error: 'enabled must be boolean' }, 400);
  }

  let config: McpServiceConfig;
  try {
    config = setServiceEnabled(serviceId, enabled);
  } catch (exc) {
    const message = String(exc);
    if (message.includes('not found')) {
      return jsonResponse({ error: message }, 404);
    }
    return jsonResponse({ error: message }, 400);
  }

  return jsonResponse({ service: serializeServiceConfig(config) });
}

/** POST /admin/mcp/services/:service_id/probe - Probe MCP service health */
export async function probeMcpServiceHealth(request: HttpRequest): Promise<HttpResponse> {
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  const config = mcpServiceConfigs.get(serviceId);
  if (!config) {
    return jsonResponse({ error: `service '${serviceId}' not found` }, 404);
  }

  const status = config.enabled ? 'ok' : 'disabled';
  mcpServiceHealthCache.set(serviceId, status);

  return jsonResponse({
    service: {
      id: serviceId,
      status,
      enabled: config.enabled,
      checked_at: utcNowIso(),
    },
  });
}
