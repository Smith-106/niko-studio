/**
 * MCP module - Model Context Protocol Gateway
 *
 * Migrated from src/mcp/.
 */

import { getConfig } from '../config';

// ============================================================
// Types
// ============================================================

export interface McpConfig {
  gatewayHost: string;
  gatewayPort: number;
  reloadEnabled: boolean;
  corsOrigins: string[];
  maxConnections: number;
  requestTimeout: number;
}

export interface McpRuntime {
  connectionState: 'disconnected' | 'connecting' | 'connected';
  sessionId: string | null;
  reconnectAttempts: number;
  lastActivity: number | null;
}

export interface McpMetrics {
  requestsTotal: number;
  requestsFailedTotal: number;
  latencyMsAvg: number;
  latencyMsMax: number;
  uptimeSeconds: number;
}

export interface McpContract {
  version: string;
  methods: Record<string, McpMethod>;
}

export interface McpMethod {
  description: string;
  parameters: Record<string, McpParameter>;
  returns: McpReturn;
}

export interface McpParameter {
  type: string;
  required: boolean;
  description: string;
}

export interface McpReturn {
  type: string;
  description: string;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpNotification {
  jsonrpc: '2.0';
  method: 'notifications/progress';
  params: { progressToken: string | number; message?: string };
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  mcp_runtime: McpRuntime;
  uptime_seconds: number;
}

export interface MetricsResponse {
  metrics: McpMetrics;
  runtime: McpRuntime;
}

// ============================================================
// Config
// ============================================================

export function createDefaultConfig(): McpConfig {
  return {
    gatewayHost: process.env.MCP_GATEWAY_HOST || '127.0.0.1',
    gatewayPort: parseInt(process.env.MCP_GATEWAY_PORT || '8000', 10),
    reloadEnabled: process.env.MCP_RELOAD === 'true',
    corsOrigins: [
      'http://localhost',
      'http://localhost:8000',
      'http://127.0.0.1',
      'http://127.0.0.1:8000',
    ],
    maxConnections: 100,
    requestTimeout: 30000,
  };
}

export function resolveGatewayHostPort(): { host: string; port: number } {
  const config = createDefaultConfig();
  return { host: config.gatewayHost, port: config.gatewayPort };
}

export function resolveReloadEnabled(): boolean {
  return createDefaultConfig().reloadEnabled;
}

// ============================================================
// MCP Contract
// ============================================================

export function getMcpContract(): McpContract {
  return {
    version: '2024-11-05',
    methods: {
      'tools/list': {
        description: 'List available tools',
        parameters: {},
        returns: { type: 'Tool[]', description: 'List of available tools' },
      },
      'tools/call': {
        description: 'Call a tool',
        parameters: {
          name: { type: 'string', required: true, description: 'Tool name' },
          arguments: { type: 'object', required: false, description: 'Tool arguments' },
        },
        returns: { type: 'CallResult', description: 'Tool call result' },
      },
      'resources/list': {
        description: 'List available resources',
        parameters: {},
        returns: { type: 'Resource[]', description: 'List of resources' },
      },
      'resources/read': {
        description: 'Read a resource',
        parameters: {
          uri: { type: 'string', required: true, description: 'Resource URI' },
        },
        returns: { type: 'string', description: 'Resource content' },
      },
      'prompts/list': {
        description: 'List available prompts',
        parameters: {},
        returns: { type: 'Prompt[]', description: 'List of prompts' },
      },
      'prompts/get': {
        description: 'Get a prompt',
        parameters: {
          name: { type: 'string', required: true, description: 'Prompt name' },
          arguments: { type: 'object', required: false, description: 'Prompt arguments' },
        },
        returns: { type: 'GetResult', description: 'Prompt result' },
      },
      'completion/complete': {
        description: 'Generate a completion',
        parameters: {
          prompt: { type: 'string', required: true, description: 'Prompt text' },
          model: { type: 'string', required: false, description: 'Model to use' },
          max_tokens: { type: 'number', required: false, description: 'Max tokens' },
        },
        returns: { type: 'CompletionResult', description: 'Completion result' },
      },
    },
  };
}

// ============================================================
// Runtime State
// ============================================================

export class McpRuntimeState {
  private state: McpRuntime;

  constructor() {
    this.state = {
      connectionState: 'disconnected',
      sessionId: null,
      reconnectAttempts: 0,
      lastActivity: null,
    };
  }

  get connectionState(): string { return this.state.connectionState; }
  get sessionId(): string | null { return this.state.sessionId; }
  get reconnectAttempts(): number { return this.state.reconnectAttempts; }

  connect(sessionId: string): void {
    this.state.connectionState = 'connected';
    this.state.sessionId = sessionId;
    this.state.lastActivity = Date.now();
  }

  disconnect(): void {
    this.state.connectionState = 'disconnected';
  }

  incrementReconnect(): void {
    this.state.reconnectAttempts++;
  }

  resetReconnect(): void {
    this.state.reconnectAttempts = 0;
  }

  touch(): void {
    this.state.lastActivity = Date.now();
  }

  toJSON(): McpRuntime { return { ...this.state }; }
}

// ============================================================
// Metrics
// ============================================================

export class McpMetricsCollector {
  private metrics: McpMetrics;
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      requestsTotal: 0,
      requestsFailedTotal: 0,
      latencyMsAvg: 0,
      latencyMsMax: 0,
      uptimeSeconds: 0,
    };
  }

  recordRequest(latencyMs: number, failed = false): void {
    this.metrics.requestsTotal++;
    if (failed) {
      this.metrics.requestsFailedTotal++;
    }
    this.metrics.latencyMsMax = Math.max(this.metrics.latencyMsMax, latencyMs);
    const total = this.metrics.requestsTotal;
    this.metrics.latencyMsAvg =
      (this.metrics.latencyMsAvg * (total - 1) + latencyMs) / total;
  }

  getMetrics(): McpMetrics {
    return {
      ...this.metrics,
      uptimeSeconds: (Date.now() - this.startTime) / 1000,
    };
  }

  reset(): void {
    this.metrics = {
      requestsTotal: 0,
      requestsFailedTotal: 0,
      latencyMsAvg: 0,
      latencyMsMax: 0,
      uptimeSeconds: 0,
    };
    this.startTime = Date.now();
  }
}

// ============================================================
// Gateway
// ============================================================

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';

export class McpGateway {
  private config: McpConfig;
  private runtime: McpRuntimeState;
  private metrics: McpMetricsCollector;
  private server: Server | null = null;
  private requestHandlers: Map<string, (request: McpRequest) => Promise<McpResponse>>;

  constructor(config?: Partial<McpConfig>) {
    this.config = { ...createDefaultConfig(), ...config };
    this.runtime = new McpRuntimeState();
    this.metrics = new McpMetricsCollector();
    this.requestHandlers = new Map();
  }

  registerHandler(method: string, handler: (request: McpRequest) => Promise<McpResponse>): void {
    this.requestHandlers.set(method, handler);
  }

  async start(): Promise<void> {
    this.server = createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });

    this.server.listen(this.config.gatewayPort, this.config.gatewayHost, () => {
      console.log(`MCP Gateway listening on ${this.config.gatewayHost}:${this.config.gatewayPort}`);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.runtime.disconnect();
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();

    try {
      const body = await this.readBody(req);
      const mcpRequest = JSON.parse(body) as McpRequest;

      const handler = this.requestHandlers.get(mcpRequest.method);
      let mcpResponse: McpResponse;

      if (handler) {
        mcpResponse = await handler(mcpRequest);
      } else {
        mcpResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          error: { code: -32601, message: `Method not found: ${mcpRequest.method}` },
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mcpResponse));

      this.metrics.recordRequest(Date.now() - startTime);
      this.runtime.touch();
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: String(e) },
      }));
      this.metrics.recordRequest(Date.now() - startTime, true);
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: string) => { body += chunk; });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  getHealth(): HealthResponse {
    const version = String(getConfig().version ?? '1.0.0');
    return {
      status: this.runtime.connectionState === 'connected' ? 'ok' : 'degraded',
      version,
      mcp_runtime: this.runtime.toJSON(),
      uptime_seconds: this.metrics.getMetrics().uptimeSeconds,
    };
  }

  getMetricsSnapshot(): MetricsResponse {
    return {
      metrics: this.metrics.getMetrics(),
      runtime: this.runtime.toJSON(),
    };
  }
}

// ============================================================
// Sidecar Entry
// ============================================================

export async function startSidecar(): Promise<void> {
  const gateway = new McpGateway();

  gateway.registerHandler('initialize', async (req) => ({
    jsonrpc: '2.0',
    id: req.id,
    result: { protocolVersion: '2024-11-05', },
  }));

  gateway.registerHandler('tools/list', async () => ({
    jsonrpc: '2.0',
    id: 0,
    result: { tools: [] },
  }));

  await gateway.start();
  console.log('MCP Sidecar started');
}
