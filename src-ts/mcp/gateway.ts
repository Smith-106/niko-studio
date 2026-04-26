/**
 * MCP module - Model Context Protocol Gateway (legacy compatibility)
 *
 * Legacy gateway exports are retained for compatibility only.
 * Canonical runtime authority lives in gateway-bootstrap.ts + config.ts.
 */

import type { Server } from 'node:http';

import { getConfig } from '../config';
import {
  resolveCorsOrigins,
  resolveGatewayHostPort as resolveCanonicalGatewayHostPort,
  resolveReloadEnabled as resolveCanonicalReloadEnabled,
} from './config';
import { type GatewayServerStartOptions, startGatewayServer } from './gateway-bootstrap';
import { getMetricsSnapshot as getCanonicalMetricsSnapshot } from './metrics';

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
// Legacy compatibility config wrappers
// ============================================================

export function createDefaultConfig(): McpConfig {
  const { host, port } = resolveCanonicalGatewayHostPort();
  return {
    gatewayHost: host,
    gatewayPort: port,
    reloadEnabled: resolveCanonicalReloadEnabled(),
    corsOrigins: resolveCorsOrigins(),
    maxConnections: 100,
    requestTimeout: 30000,
  };
}

export function resolveGatewayHostPort(): { host: string; port: number } {
  return resolveCanonicalGatewayHostPort();
}

export function resolveReloadEnabled(): boolean {
  return resolveCanonicalReloadEnabled();
}

// ============================================================
// Legacy MCP Contract (compatibility only)
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
// Legacy gateway adapter (delegates to canonical bootstrap)
// ============================================================

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
    if (this.requestHandlers.size > 0) {
      console.warn('Legacy McpGateway.registerHandler is ignored; route-based gateway authority is canonical.');
    }

    const options: GatewayServerStartOptions = {
      host: this.config.gatewayHost,
      port: this.config.gatewayPort,
    };
    this.server = await startGatewayServer(options);
    this.runtime.connect(`legacy-${Date.now()}`);
    this.runtime.touch();
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      this.server = null;
    }
    this.runtime.disconnect();
  }

  getHealth(): HealthResponse {
    const version = String(getConfig().version ?? '1.0.0');
    return {
      status: this.server ? 'ok' : 'degraded',
      version,
      mcp_runtime: this.runtime.toJSON(),
      uptime_seconds: this.metrics.getMetrics().uptimeSeconds,
    };
  }

  getMetricsSnapshot(): MetricsResponse {
    const snapshot = getCanonicalMetricsSnapshot();
    const requestsTotal = Number(snapshot.requests_total ?? 0);
    const requestsFailedTotal = Number(snapshot.requests_failed_total ?? 0);
    const latencyMsAvg = Number(snapshot.latency_ms_avg ?? 0);
    const latencyMsMax = Number(snapshot.latency_ms_max ?? 0);

    return {
      metrics: {
        requestsTotal,
        requestsFailedTotal,
        latencyMsAvg,
        latencyMsMax,
        uptimeSeconds: this.metrics.getMetrics().uptimeSeconds,
      },
      runtime: this.runtime.toJSON(),
    };
  }
}

// ============================================================
// Sidecar Entry (legacy compatibility)
// ============================================================

export async function startSidecar(): Promise<void> {
  const gateway = new McpGateway();
  await gateway.start();
  console.log('Legacy MCP sidecar started via canonical gateway bootstrap');
}
