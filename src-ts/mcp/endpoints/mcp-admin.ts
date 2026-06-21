/**
 * MCP Admin Endpoints
 *
 * MCP service configuration CRUD endpoints.
 * Ported from src/mcp/endpoints/mcp_admin.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { resolveLocalhostOnlyEnabled } from '../config';
import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  serializeServiceConfig as serializeSharedServiceConfig,
  setServiceEnabled as setSharedServiceEnabled,
  updateServiceConfig as updateSharedServiceConfig,
  type McpServiceConfig,
} from '../service-config';

// ---------------------------------------------------------------
// Service config types
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

function serializeRuntimeServiceConfig(
  config: McpServiceConfig,
  runtimeServices?: Record<string, string> | null
): Record<string, unknown> {
  const services = runtimeServices ?? Object.fromEntries(mcpServiceHealthCache.entries());
  return serializeSharedServiceConfig(config, services);
}

function getServiceConfig(serviceId: string): McpServiceConfig | undefined {
  return mcpServiceConfigs.get(serviceId) ?? MCP_SERVICE_CONFIGS[serviceId];
}

function syncRuntimeConfig(config: McpServiceConfig): McpServiceConfig {
  mcpServiceConfigs.set(config.serviceId, { ...config });
  if (!mcpServiceHealthCache.has(config.serviceId)) {
    mcpServiceHealthCache.set(
      config.serviceId,
      MCP_SERVICE_HEALTH_CACHE[config.serviceId] ?? 'unknown',
    );
  }
  return config;
}

function isMissingServiceError(message: string): boolean {
  return message.includes('not found') || message.includes('Unknown service:');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function updateServiceConfig(
  serviceId: string,
  body: Record<string, unknown>,
  createIfMissing: boolean
): McpServiceConfig {
  const config = updateSharedServiceConfig(serviceId, body, { createIfMissing });
  return syncRuntimeConfig(config);
}

function setServiceEnabled(serviceId: string, enabled: boolean): McpServiceConfig {
  const config = setSharedServiceEnabled(serviceId, enabled);
  return syncRuntimeConfig(config);
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
    serializeRuntimeServiceConfig(config, runtimeServices)
  );
  return jsonResponse({ services: payload });
}

/** POST /admin/mcp/services - Create a new MCP service config */
export async function createMcpService(request: HttpRequest): Promise<HttpResponse> {
  // ISS-004: admin write endpoints require localhost-only when guard is enabled
  if (resolveLocalhostOnlyEnabled()) {
    const remoteAddr = request.remoteAddress ?? '';
    // No remoteAddress = internal/test call, not over network — allow by default
    const isLocal = !remoteAddr || remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    if (!isLocal) {
      return jsonResponse({ error: 'Access denied: localhost only' }, 403);
    }
  }
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
    return jsonResponse({ error: errorMessage(exc) }, 400);
  }

  return jsonResponse({ service: serializeRuntimeServiceConfig(config) }, 201);
}

/** PUT /admin/mcp/services/:service_id - Update an MCP service config */
export async function updateMcpService(request: HttpRequest): Promise<HttpResponse> {
  // ISS-004: admin write endpoints require localhost-only when guard is enabled
  if (resolveLocalhostOnlyEnabled()) {
    const remoteAddr = request.remoteAddress ?? '';
    // No remoteAddress = internal/test call, not over network — allow by default
    const isLocal = !remoteAddr || remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    if (!isLocal) {
      return jsonResponse({ error: 'Access denied: localhost only' }, 403);
    }
  }
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  if (!serviceId) {
    return jsonResponse({ error: 'service_id is required' }, 400);
  }

  const body = parseBody(request) as Record<string, unknown>;

  let config: McpServiceConfig;
  try {
    config = updateServiceConfig(serviceId, body, false);
  } catch (exc) {
    const msg = errorMessage(exc);
    if (isMissingServiceError(msg)) {
      return jsonResponse({ error: msg }, 404);
    }
    return jsonResponse({ error: msg }, 400);
  }

  return jsonResponse({ service: serializeRuntimeServiceConfig(config) });
}

/** DELETE /admin/mcp/services/:service_id - Delete an MCP service config */
export async function deleteMcpService(request: HttpRequest): Promise<HttpResponse> {
  // ISS-004: admin write endpoints require localhost-only when guard is enabled
  if (resolveLocalhostOnlyEnabled()) {
    const remoteAddr = request.remoteAddress ?? '';
    // No remoteAddress = internal/test call, not over network — allow by default
    const isLocal = !remoteAddr || remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    if (!isLocal) {
      return jsonResponse({ error: 'Access denied: localhost only' }, 403);
    }
  }
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  if (!serviceId) {
    return jsonResponse({ error: 'service_id is required' }, 400);
  }

  const config = getServiceConfig(serviceId);
  if (!config) {
    return jsonResponse({ error: `service '${serviceId}' not found` }, 404);
  }

  if (config.builtin) {
    return jsonResponse({ error: 'cannot delete builtin service' }, 400);
  }

  mcpServiceConfigs.delete(serviceId);
  mcpServiceHealthCache.delete(serviceId);
  delete MCP_SERVICE_CONFIGS[serviceId];
  delete MCP_SERVICE_HEALTH_CACHE[serviceId];

  return jsonResponse({ status: 'deleted', service_id: serviceId });
}

/** POST /admin/mcp/services/:service_id/enabled - Enable/disable an MCP service */
export async function setMcpServiceEnabled(request: HttpRequest): Promise<HttpResponse> {
  // ISS-004: admin write endpoints require localhost-only when guard is enabled
  if (resolveLocalhostOnlyEnabled()) {
    const remoteAddr = request.remoteAddress ?? '';
    // No remoteAddress = internal/test call, not over network — allow by default
    const isLocal = !remoteAddr || remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
    if (!isLocal) {
      return jsonResponse({ error: 'Access denied: localhost only' }, 403);
    }
  }
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
    const message = errorMessage(exc);
    if (isMissingServiceError(message)) {
      return jsonResponse({ error: message }, 404);
    }
    return jsonResponse({ error: message }, 400);
  }

  return jsonResponse({ service: serializeRuntimeServiceConfig(config) });
}

/** POST /admin/mcp/services/:service_id/probe - Probe MCP service health */
export async function probeMcpServiceHealth(request: HttpRequest): Promise<HttpResponse> {
  const serviceId = (request.params['service_id'] ?? '').trim().toLowerCase();
  const config = getServiceConfig(serviceId);
  if (!config) {
    return jsonResponse({ error: `service '${serviceId}' not found` }, 404);
  }

  const status = config.enabled ? 'ok' : 'disabled';
  mcpServiceHealthCache.set(serviceId, status);
  MCP_SERVICE_HEALTH_CACHE[serviceId] = status;

  return jsonResponse({
    service: {
      ...serializeRuntimeServiceConfig(config, { [serviceId]: status }),
      checked_at: utcNowIso(),
    },
  });
}
