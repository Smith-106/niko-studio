/**
 * REST Gateway Server
 *
 * Node.js HTTP server that routes URL paths to MCP endpoint functions.
 * Replaces the Python uvicorn gateway (src/mcp/gateway.py).
 *
 * Usage:
 *   npx ts-node gateway-server.ts
 *   npx ts-node gateway-server.ts --port 8000 --host 0.0.0.0
 */

import 'reflect-metadata';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolveGatewayHostPort } from './mcp/config';
import { getContainer } from './container/ServiceContainer';
import { loadConfig as loadServicesConfig } from './knowledge/config';
import {
  ConfigManager,
  getConfig as getAppConfig,
  getConfigValue as getAppConfigValue,
  setConfigValue as setAppConfigValue,
} from './config';
import { getMetricsSnapshot, utcNowIso } from './mcp/metrics';
import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  RUNTIME_SERVER_ORDER,
  refreshServiceHealthCache as refreshSharedServiceHealthCache,
  serializeServiceConfig as serializeSharedServiceConfig,
  serviceRuntimeStatus,
  type McpServiceConfig,
} from './mcp/service-config';
import {
  RUNTIME_SESSION_ID,
  buildRuntimeServers,
  getObservabilitySnapshot,
  toRuntimeConnectionState,
  toRuntimeReconnectState,
} from './mcp/runtime';
import { ServiceTypes } from './container/types';

// Endpoint imports
import {
  healthCheck,
  metricsEndpoint,
  listTools,
  listModels,
  setGatewayDeps,
} from './mcp/endpoints/health';
import {
  getConfig,
  updateConfig,
  getSecrets,
  updateSecrets,
  setConfigAccess,
} from './mcp/endpoints/config';
import { chatEndpoint, chatStreamEndpoint } from './mcp/endpoints/chat';
import { memorySearchEndpoint, memoryAddEndpoint, memoryUploadEndpoint, memoryTemporalEndpoint } from './mcp/endpoints/memory';
import { graphQueryEndpoint, graphCharacterEndpoint, graphForeshadowsEndpoint } from './mcp/endpoints/graph';
import { agentRouteEndpoint, agentWriteEndpoint, agentReviseEndpoint, agentContextEndpoint } from './mcp/endpoints/agent';
import { criticEvaluateEndpoint, criticSuggestionsEndpoint } from './mcp/endpoints/critic';
import { skillsListEndpoint, skillsLoadEndpoint, skillsMatchEndpoint, skillsChainEndpoint } from './mcp/endpoints/skills';
import {
  workflowRouteEndpoint,
  workflowPlanEndpoint,
  workflowExecuteEndpoint,
  workflowLifecycleEndpoint,
  workflowQuickRollbackEndpoint,
  checkpointCreateEndpoint,
  checkpointRestoreEndpoint,
  checkpointListEndpoint,
  setUiBridgeEnabled,
  uiBridgeWorkflowRouteEndpoint,
  uiBridgeWorkflowPlanEndpoint,
  uiBridgeWorkflowExecuteEndpoint,
  uiBridgeWorkflowLifecycleEndpoint,
} from './mcp/endpoints/workflow';
import { novelQualityCheckEndpoint, writingHelperProcessEndpoint, writingStreamEndpoint } from './mcp/endpoints/writing';
import {
  listMcpServices,
  createMcpService,
  updateMcpService,
  deleteMcpService,
  setMcpServiceEnabled,
  probeMcpServiceHealth,
  setMcpServiceState,
} from './mcp/endpoints/mcp-admin';

type GatewayDeps = Parameters<typeof setGatewayDeps>[0];
type ConfigAccess = Parameters<typeof setConfigAccess>[0];

function snakeToCamelSegment(segment: string): string {
  return segment.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function camelToSnakeSegment(segment: string): string {
  return segment.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function mapConfigKeyToSharedKey(key: string): string {
  return key
    .split('.')
    .map((segment) => snakeToCamelSegment(segment))
    .join('.');
}

function toSnakeCaseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toSnakeCaseValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        camelToSnakeSegment(key),
        toSnakeCaseValue(child),
      ]),
    );
  }

  return value;
}

function createMcpServiceConfigMap(): Map<string, McpServiceConfig> {
  return new Map(
    Object.entries(MCP_SERVICE_CONFIGS).map(([serviceId, config]) => [
      serviceId,
      { ...config },
    ]),
  );
}

function createHealthCacheMap(): Map<string, string> {
  return new Map(Object.entries(MCP_SERVICE_HEALTH_CACHE));
}

export function buildConfigAccess(): ConfigAccess {
  return {
    getConfig: () => toSnakeCaseValue(getAppConfig()) as Record<string, unknown>,
    getConfigValue: (key: string) => getAppConfigValue(mapConfigKeyToSharedKey(key)),
    setConfigValue: (key: string, value: unknown) => {
      setAppConfigValue(mapConfigKeyToSharedKey(key), value);
    },
    reloadConfig: () => {
      ConfigManager.getInstance().reload();
    },
  };
}

export function buildGatewayDeps(
  container: ReturnType<typeof getContainer>,
  state?: {
    mcpConfigs?: Map<string, McpServiceConfig>;
    healthCache?: Map<string, string>;
  },
): GatewayDeps {
  const mcpConfigs = state?.mcpConfigs ?? createMcpServiceConfigMap();
  const healthCache = state?.healthCache ?? createHealthCacheMap();

  return {
    version: '1.0.0',
    getEngine: (name: string) => {
      switch (name) {
        case 'memory':
          return container.memory as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'graph':
          return container.graph as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'search':
          return container.search as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'workflow':
          return container.workflow as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        case 'critic':
          return container.critic as unknown as { healthCheck?: () => Promise<Record<string, unknown>> };
        default:
          return null;
      }
    },
    getConfigValue: (key: string, defaultValue?: unknown) =>
      getAppConfigValue(mapConfigKeyToSharedKey(key), defaultValue),
    loadServicesConfig: () => loadServicesConfig(),
    getMetricsSnapshot: () => getMetricsSnapshot(),
    getObservabilitySnapshot,
    runtimeSessionId: RUNTIME_SESSION_ID,
    runtimeLastProbeAt: null,
    runtimeReconnectAttempts: 0,
    runtimeLastError: null,
    mcpServiceConfigs: mcpConfigs,
    runtimeServerOrder: RUNTIME_SERVER_ORDER,
    refreshServiceHealthCache: (services: Record<string, string>) => {
      refreshSharedServiceHealthCache(services);
      for (const [serviceId, status] of Object.entries(services)) {
        healthCache.set(serviceId, status);
      }
    },
    serviceRuntimeStatus,
    toRuntimeConnectionState,
    toRuntimeReconnectState,
    buildRuntimeServers,
    serializeServiceConfig: (config: unknown, services?: Record<string, string> | null) => {
      const candidate = config as (Partial<McpServiceConfig> & { id?: string }) | null;
      const serviceId = String(candidate?.serviceId ?? candidate?.id ?? '').trim().toLowerCase();
      const sharedConfig = serviceId ? MCP_SERVICE_CONFIGS[serviceId] : undefined;
      if (sharedConfig) {
        return serializeSharedServiceConfig(sharedConfig, services ?? undefined);
      }
      return {
        id: serviceId,
        name: String(candidate?.name ?? serviceId),
        path: String(candidate?.path ?? `/${serviceId}`),
        enabled: Boolean(candidate?.enabled ?? true),
        builtin: Boolean(candidate?.builtin ?? false),
        transport: String(candidate?.transport ?? 'streamable-http'),
        health_url: candidate?.healthUrl ?? null,
        status: serviceId && services ? services[serviceId] ?? 'unknown' : 'unknown',
      };
    },
    utcNowIso: () => utcNowIso(),
  };
}

// Type for endpoint handlers
type EndpointHandler = (request: import('./mcp/http-types').HttpRequest) => Promise<import('./mcp/http-types').HttpResponse>;

// ============================================================
// Route Registry
// ============================================================

interface Route {
  method: string;
  pattern: RegExp;
  handler: EndpointHandler;
  paramNames?: string[];
}

const routes: Route[] = [
  // Health / Meta
  { method: 'GET',  pattern: /^\/health$/,                  handler: healthCheck },
  { method: 'GET',  pattern: /^\/metrics$/,                 handler: metricsEndpoint },
  { method: 'GET',  pattern: /^\/tools$/,                   handler: listTools },
  { method: 'GET',  pattern: /^\/models$/,                  handler: listModels },

  // Config
  { method: 'GET',  pattern: /^\/config$/,                  handler: getConfig },
  { method: 'POST', pattern: /^\/config$/,                  handler: updateConfig },
  { method: 'GET',  pattern: /^\/config\/secrets$/,         handler: getSecrets },
  { method: 'POST', pattern: /^\/config\/secrets$/,         handler: updateSecrets },

  // Chat
  { method: 'POST', pattern: /^\/chat\/stream$/,            handler: chatStreamEndpoint },
  { method: 'POST', pattern: /^\/chat$/,                    handler: chatEndpoint },

  // Memory
  { method: 'POST', pattern: /^\/memory\/search$/,          handler: memorySearchEndpoint },
  { method: 'POST', pattern: /^\/memory\/add$/,             handler: memoryAddEndpoint },
  { method: 'POST', pattern: /^\/memory\/upload$/,          handler: memoryUploadEndpoint },
  { method: 'POST', pattern: /^\/memory\/temporal$/,        handler: memoryTemporalEndpoint },

  // Graph
  { method: 'POST', pattern: /^\/graph\/query$/,            handler: graphQueryEndpoint },
  { method: 'POST', pattern: /^\/graph\/character$/,        handler: graphCharacterEndpoint },
  { method: 'POST', pattern: /^\/graph\/foreshadows$/,      handler: graphForeshadowsEndpoint },

  // Agent
  { method: 'POST', pattern: /^\/agent\/route$/,            handler: agentRouteEndpoint },
  { method: 'POST', pattern: /^\/agent\/write$/,            handler: agentWriteEndpoint },
  { method: 'POST', pattern: /^\/agent\/revise$/,           handler: agentReviseEndpoint },
  { method: 'POST', pattern: /^\/agent\/context$/,          handler: agentContextEndpoint },

  // Critic
  { method: 'POST', pattern: /^\/critic\/evaluate$/,        handler: criticEvaluateEndpoint },
  { method: 'POST', pattern: /^\/critic\/suggestions$/,     handler: criticSuggestionsEndpoint },

  // Skills
  { method: 'GET',  pattern: /^\/skills\/list$/,            handler: skillsListEndpoint },
  { method: 'POST', pattern: /^\/skills\/load$/,            handler: skillsLoadEndpoint },
  { method: 'POST', pattern: /^\/skills\/match$/,           handler: skillsMatchEndpoint },
  { method: 'POST', pattern: /^\/skills\/chain$/,           handler: skillsChainEndpoint },

  // Workflow
  { method: 'POST', pattern: /^\/workflow\/route$/,         handler: workflowRouteEndpoint },
  { method: 'POST', pattern: /^\/workflow\/plan$/,          handler: workflowPlanEndpoint },
  { method: 'POST', pattern: /^\/workflow\/execute$/,       handler: workflowExecuteEndpoint },
  { method: 'POST', pattern: /^\/workflow\/lifecycle$/,     handler: workflowLifecycleEndpoint },
  { method: 'POST', pattern: /^\/workflow\/rollback$/,      handler: workflowQuickRollbackEndpoint },

  // Checkpoints
  { method: 'POST', pattern: /^\/checkpoint\/create$/,      handler: checkpointCreateEndpoint },
  { method: 'POST', pattern: /^\/checkpoint\/restore$/,     handler: checkpointRestoreEndpoint },
  { method: 'POST', pattern: /^\/checkpoint\/list$/,        handler: checkpointListEndpoint },

  // UI Bridge (gated)
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/route$/,     handler: uiBridgeWorkflowRouteEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/plan$/,      handler: uiBridgeWorkflowPlanEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/execute$/,   handler: uiBridgeWorkflowExecuteEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/lifecycle$/, handler: uiBridgeWorkflowLifecycleEndpoint },

  // Writing
  { method: 'POST', pattern: /^\/writing\/quality$/,        handler: novelQualityCheckEndpoint },
  { method: 'POST', pattern: /^\/writing\/helper$/,         handler: writingHelperProcessEndpoint },
  { method: 'POST', pattern: /^\/writing\/stream$/,         handler: writingStreamEndpoint },
  // Legacy route alias for desktop frontend compatibility
  { method: 'POST', pattern: /^\/writing-helper\/process$/, handler: writingHelperProcessEndpoint },

  // MCP Admin
  { method: 'GET',  pattern: /^\/admin\/mcp\/services$/,                      handler: listMcpServices },
  { method: 'POST', pattern: /^\/admin\/mcp\/services$/,                      handler: createMcpService },
  { method: 'PUT',  pattern: /^\/admin\/mcp\/services\/([^/]+)$/,             handler: updateMcpService, paramNames: ['id'] },
  { method: 'DELETE', pattern: /^\/admin\/mcp\/services\/([^/]+)$/,           handler: deleteMcpService, paramNames: ['id'] },
  { method: 'POST', pattern: /^\/admin\/mcp\/services\/([^/]+)\/enabled$/,    handler: setMcpServiceEnabled, paramNames: ['id'] },
  { method: 'POST', pattern: /^\/admin\/mcp\/services\/([^/]+)\/probe$/,      handler: probeMcpServiceHealth, paramNames: ['id'] },
];

// ============================================================
// Request Helpers
// ============================================================

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseQuery(url: string): Record<string, string> {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return {};
  const qs = url.slice(qIdx + 1);
  const params: Record<string, string> = {};
  for (const pair of qs.split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return params;
}

function extractPath(url: string): string {
  const qIdx = url.indexOf('?');
  return (qIdx === -1 ? url : url.slice(0, qIdx));
}

function toHttpRequest(
  req: IncomingMessage,
  body: unknown,
  query: Record<string, string>,
  params: Record<string, string>,
): import('./mcp/http-types').HttpRequest {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(', ');
  }

  return {
    method: req.method ?? 'GET',
    url: req.url ?? '/',
    headers,
    body,
    query,
    params,
  };
}

function sendResponse(res: ServerResponse, httpResponse: import('./mcp/http-types').HttpResponse): void {
  const headers: Record<string, string | number> = {
    'Content-Type': 'application/json',
    ...((httpResponse.headers ?? {}) as Record<string, string>),
  };
  res.writeHead(httpResponse.statusCode, headers);
  res.end(typeof httpResponse.body === 'string' ? httpResponse.body : JSON.stringify(httpResponse.body));
}

// ============================================================
// CORS
// ============================================================

const CORS_ORIGINS = (process.env.NIKO_CORS_ORIGINS ?? '*').split(',').map(s => s.trim());

function addCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (CORS_ORIGINS.includes('*') || (origin && CORS_ORIGINS.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ============================================================
// Server
// ============================================================

export interface GatewayServerStartOptions {
  host?: string;
  port?: number;
}

export async function startGatewayServer(options: GatewayServerStartOptions = {}): Promise<import('node:http').Server> {
  let portOverride: number | undefined;
  let hostOverride: string | undefined;

  if (typeof options.port === 'number' && Number.isFinite(options.port)) {
    portOverride = options.port;
  }
  if (typeof options.host === 'string' && options.host.trim()) {
    hostOverride = options.host.trim();
  }

  const { host: defaultHost, port: defaultPort } = resolveGatewayHostPort();
  const host = hostOverride ?? defaultHost;
  const port = portOverride ?? defaultPort;

  // Wire up gateway dependencies
  const container = getContainer();

  const mcpConfigs = createMcpServiceConfigMap();
  const healthCache = createHealthCacheMap();

  setGatewayDeps(buildGatewayDeps(container, { mcpConfigs, healthCache }));
  setConfigAccess(buildConfigAccess());

  setMcpServiceState(mcpConfigs, healthCache);

  setUiBridgeEnabled(process.env.NIKO_UI_BRIDGE_ENABLED === 'true');

  // Pre-warm engines
  try {
    await container.initializeAll();
  } catch (e) {
    console.warn('Engine pre-warm warning:', e);
  }

  const server = createServer(async (req, res) => {
    addCorsHeaders(req, res);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const path = extractPath(req.url ?? '/');
    const query = parseQuery(req.url ?? '/');
    const method = (req.method ?? 'GET').toUpperCase();

    // Find matching route
    let matched: Route | undefined;
    let params: Record<string, string> = {};

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = path.match(route.pattern);
      if (match) {
        matched = route;
        if (route.paramNames && match[1]) {
          for (let i = 0; i < route.paramNames.length; i++) {
            params[route.paramNames[i]] = match[i + 1];
          }
        }
        break;
      }
    }

    if (!matched) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path }));
      return;
    }

    try {
      // Parse body for non-GET requests
      let body: unknown = undefined;
      if (method !== 'GET' && method !== 'HEAD') {
        const raw = await readBody(req);
        if (raw) {
          try { body = JSON.parse(raw); }
          catch { body = raw; }
        }
      }

      const httpRequest = toHttpRequest(req, body, query, params);
      const httpResponse = await matched.handler(httpRequest);
      sendResponse(res, httpResponse);
    } catch (e) {
      console.error(`Error handling ${method} ${path}:`, e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error', message: e instanceof Error ? e.message : String(e) }));
    }
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(port, host, () => {
      console.log(`
    ╔═══════════════════════════════════════════════════════════════╗
    ║     NIKO Studio Gateway (Node.js)                           ║
    ║     http://${host}:${port}                                    ║
    ╚═══════════════════════════════════════════════════════════════╝
    `);
      console.log(`  Health:  http://localhost:${port}/health`);
      console.log(`  Memory:  http://localhost:${port}/memory/search`);
      console.log(`  Graph:   http://localhost:${port}/graph/query`);
      console.log(`  Skills:  http://localhost:${port}/skills/list`);
      console.log(`  Workflow: http://localhost:${port}/workflow/route`);
      console.log('');
      resolvePromise();
    });
  });

  return server;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let portOverride: number | undefined;
  let hostOverride: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) portOverride = parseInt(argv[i + 1], 10);
    if (argv[i] === '--host' && argv[i + 1]) hostOverride = argv[i + 1];
  }
  await startGatewayServer({ host: hostOverride, port: portOverride });
}

const runningAsMain = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
})();

if (runningAsMain) {
  main().catch((e) => {
    console.error('Gateway failed to start:', e);
    process.exit(1);
  });
}
