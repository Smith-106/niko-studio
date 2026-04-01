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
import { resolveGatewayHostPort } from './mcp/config';
import { getContainer } from './container/ServiceContainer';

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let portOverride: number | undefined;
  let hostOverride: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) portOverride = parseInt(args[i + 1], 10);
    if (args[i] === '--host' && args[i + 1]) hostOverride = args[i + 1];
  }

  const { host: defaultHost, port: defaultPort } = resolveGatewayHostPort();
  const host = hostOverride ?? defaultHost;
  const port = portOverride ?? defaultPort;

  // Wire up gateway dependencies
  const container = getContainer();

  const mcpConfigs = new Map<string, { id: string; enabled: boolean; builtin: boolean; [key: string]: unknown }>();
  const healthCache = new Map<string, string>();

  setGatewayDeps({
    version: '1.0.0',
    getEngine: () => null,
    getConfigValue: (key: string, defaultValue?: unknown) => {
      const envKey = `NIKO_${key.toUpperCase().replace(/\./g, '_')}`;
      return process.env[envKey] ?? defaultValue;
    },
    loadServicesConfig: () => ({}),
    getMetricsSnapshot: () => ({}),
    getObservabilitySnapshot: () => ({}),
    runtimeSessionId: `gw-${Date.now()}`,
    runtimeLastProbeAt: null,
    runtimeReconnectAttempts: 0,
    runtimeLastError: null,
    mcpServiceConfigs: mcpConfigs,
    runtimeServerOrder: [],
    refreshServiceHealthCache: () => {},
    serviceRuntimeStatus: () => 'stopped',
    toRuntimeConnectionState: () => 'disconnected',
    toRuntimeReconnectState: () => 'idle',
    buildRuntimeServers: () => [],
    serializeServiceConfig: () => ({}),
    utcNowIso: () => new Date().toISOString(),
  });

  setConfigAccess({
    getConfig: () => ({}),
    getConfigValue: (key: string, defaultValue?: unknown) => {
      const envKey = `NIKO_${key.toUpperCase().replace(/\./g, '_')}`;
      return process.env[envKey] ?? defaultValue;
    },
    setConfigValue: (key: string, value: unknown) => {
      const envKey = `NIKO_${key.toUpperCase().replace(/\./g, '_')}`;
      process.env[envKey] = String(value);
    },
    reloadConfig: () => { /* no-op */ },
  });

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
  });
}

main().catch((e) => {
  console.error('Gateway failed to start:', e);
  process.exit(1);
});
