/**
 * AI Writing Agent - Web UI Backend
 *
 * Legacy note: Desktop client + MCP Gateway is the primary delivery path;
 * this Web UI backend is retained for compatibility forwarding only.
 *
 * This module provides a lightweight HTTP/WebSocket server abstraction.
 * Framework-agnostic: accepts http/express/ws instances from the caller.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { WorkflowEngine } from '../workflow/workflow-engine.js';

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------

const WEB_WORKFLOW_ENABLED_ENV = 'WEB_WORKFLOW_ENABLED';
const WEB_WORKFLOW_DISABLED_MESSAGE =
  'Web workflow is disabled by default. Set WEB_WORKFLOW_ENABLED=true to enable it.';
const WEB_WORKFLOW_RISK_MESSAGE =
  'Web workflow is an experimental compatibility path with operational and security risks. ' +
  'Prefer Desktop client or MCP Gateway.';

/** Trusted origins for CORS/CSWSH protection */
const ORIGINS: string[] = [
  'http://localhost',
  'http://localhost:8000',
  'http://127.0.0.1',
  'http://127.0.0.1:8000',
];

/**
 * Read workflow gate from environment with secure default-off behavior.
 */
function isWebWorkflowEnabled(): boolean {
  try {
    const value = (process.env[WEB_WORKFLOW_ENABLED_ENV] ?? '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value);
  } catch (error) {
    console.log(`[audit] websocket_workflow_gate_read_error error=${error}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// WebSocket message types
// ---------------------------------------------------------------------------

/** WebSocket message envelope */
interface WebSocketMessage {
  type: string;
  content?: string;
  mode?: string;
  [key: string]: unknown;
}

/** WebSocket with optional client metadata */
interface WSWithMeta {
  send: (data: string) => void;
  close?: (code?: number, reason?: string) => void;
  clientId?: string;
}

/** WebSocket event from workflow engine */
interface WorkflowEvent {
  type: string;
  plan_id?: string;
  step_id?: string;
  step_name?: string;
  status?: string;
  error?: string;
  result?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ConnectionManager
// ---------------------------------------------------------------------------

/**
 * WebSocket connection manager.
 *
 * Manages active WebSocket connections and provides message broadcasting.
 * Uses a Set for connection tracking, matching the Python original.
 */
class ConnectionManager {
  activeConnections: Set<WSWithMeta> = new Set();

  /** Register a new connection */
  connect(ws: WSWithMeta): void {
    this.activeConnections.add(ws);
  }

  /** Remove a connection */
  disconnect(ws: WSWithMeta): void {
    this.activeConnections.delete(ws);
  }

  /** Send a JSON message to a specific client */
  sendJson(data: Record<string, unknown>, ws: WSWithMeta): void {
    ws.send(JSON.stringify(data));
  }

  /** Broadcast a text message to all connections */
  broadcast(message: string): void {
    for (const conn of this.activeConnections) {
      conn.send(message);
    }
  }

  /** Number of active connections */
  get connectionCount(): number {
    return this.activeConnections.size;
  }
}

// ---------------------------------------------------------------------------
// State serialization helper
// ---------------------------------------------------------------------------

/**
 * Helper to serialize state for JSON transmission.
 * Converts non-serializable values to their string representation.
 */
function serializeState(state: Record<string, unknown>): Record<string, unknown> {
  const serializable: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) {
    try {
      JSON.stringify(v);
      serializable[k] = v;
    } catch {
      serializable[k] = String(v);
    }
  }
  return serializable;
}

// ---------------------------------------------------------------------------
// Shared manager instance
// ---------------------------------------------------------------------------

const manager = new ConnectionManager();

// ---------------------------------------------------------------------------
// createApp - HTTP server factory
// ---------------------------------------------------------------------------

/**
 * HTTP request handler for the root route.
 *
 * Returns 410 (Gone) by default since the web UI is deprecated.
 * If WEB_UI_FORWARD_URL is set, returns an HTML redirect.
 */
function handleRootRequest(_req: IncomingMessage, res: ServerResponse): void {
  const forwardUrl = (process.env['WEB_UI_FORWARD_URL'] ?? '').trim();
  if (forwardUrl) {
    const target = forwardUrl.replace(/\/$/, '');
    const content =
      '<html>' +
      `<head><meta http-equiv="refresh" content="0; url=${target}"/></head>` +
      '<body>Redirecting to Gateway...</body>' +
      '</html>';
    res.writeHead(302, { 'Content-Type': 'text/html' });
    res.end(content);
    return;
  }
  res.writeHead(410, { 'Content-Type': 'text/plain' });
  res.end('Web UI has been deprecated. Please use the Desktop client or MCP Gateway.');
}

/**
 * CORS middleware for incoming HTTP requests.
 * Sets Access-Control-Allow-Origin to the first trusted origin if the
 * request origin is in the allowed list.
 */
function corsMiddleware(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers['origin'];
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

/**
 * Create and configure the web application.
 *
 * Returns a handler map that callers can wire to any Node.js HTTP server.
 * The primary delivery path is Desktop client + MCP Gateway.
 */
function createApp(): {
  handleRequest: (req: IncomingMessage, res: ServerResponse) => void;
  manager: ConnectionManager;
} {
  function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      corsMiddleware(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    // Apply CORS headers for all requests
    corsMiddleware(req, res);

    // Route: GET /
    if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
      handleRootRequest(req, res);
      return;
    }

    // Static files would be served here in a full Express setup.
    // For the compatibility layer, just 404.
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  return { handleRequest, manager };
}

// ---------------------------------------------------------------------------
// setupWebSocket - WebSocket handler factory
// ---------------------------------------------------------------------------

/**
 * Set up WebSocket handling on an existing HTTP server.
 *
 * Validates origin headers against trusted origins (CSWSH protection),
 * parses incoming JSON messages, and dispatches workflow events.
 *
 * @param wss - A WebSocketServer instance (from 'ws' package) or compatible
 * @param onConnection - Optional callback invoked with (clientId, ws) on connect
 */
function setupWebSocket(
  wss: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  },
  onConnection?: (clientId: string, ws: WSWithMeta) => void,
): void {
  wss.on('connection', (ws_: unknown, req_: unknown) => {
    const ws = ws_ as WSWithMeta;
    const req = req_ as IncomingMessage;
    // CSWSH check: reject connections from untrusted origins
    const origin = req.headers['origin'];
    if (!origin || !ORIGINS.includes(origin)) {
      console.log(
        `Rejected WebSocket connection from untrusted origin: ${origin || '<missing>'}`
      );
      if (ws.close) {
        ws.close(1008); // Policy Violation
      }
      return;
    }

    // Assign client ID from URL path (e.g. /ws/{client_id})
    const urlPath = req.url ?? '';
    const segments = urlPath.split('/');
    const clientId = segments[segments.length - 1] || 'unknown';
    ws.clientId = clientId;

    manager.connect(ws);
    if (onConnection) {
      onConnection(clientId, ws);
    }

    // Message handling
    ws.send = ws.send.bind(ws);

    // The caller is responsible for wiring message events to handleWsMessage.
    // This is typically done by listening to the 'message' event on the ws object
    // in the framework-specific integration layer.
  });
}

// ---------------------------------------------------------------------------
// Workflow message handler
// ---------------------------------------------------------------------------

/**
 * Handle an incoming WebSocket message from a client.
 *
 * Processes different message types and dispatches to appropriate handlers.
 * This is the core logic ported from Python's websocket_endpoint.
 */
async function handleWsMessage(clientId: string, message: WebSocketMessage, ws: WSWithMeta): Promise<void> {
  if (message.type === 'start_workflow') {
    const userIdea = message.content ?? '';
    const mode = message.mode ?? 'L3';

    if (!isWebWorkflowEnabled()) {
      console.log(
        `[audit] websocket_workflow_rejected client_id=${clientId} reason=disabled`
      );
      manager.sendJson({
        type: 'error',
        code: 'workflow_disabled',
        message: WEB_WORKFLOW_DISABLED_MESSAGE,
      }, ws);
      return;
    }

    console.log(
      `[audit] websocket_workflow_enabled client_id=${clientId} mode=${mode}`
    );
    manager.sendJson({
      type: 'risk_prompt',
      severity: 'warning',
      message: WEB_WORKFLOW_RISK_MESSAGE,
    }, ws);

    manager.sendJson({
      type: 'status',
      status: 'starting',
      message: `Starting workflow in ${mode} mode...`,
    }, ws);

    await runWorkflowStream(ws, userIdea, mode);
  }
}

// ---------------------------------------------------------------------------
// Workflow engine integration
// ---------------------------------------------------------------------------

/**
 * Run a workflow stream and dispatch events to the WebSocket client.
 *
 * This is the TypeScript equivalent of the Python WorkflowEngine.run_stream loop.
 */
async function runWorkflowStream(
  ws: WSWithMeta,
  userIdea: string,
  mode: string,
): Promise<void> {
  const engine = new WorkflowEngine();
  const level = typeof mode === 'string' && mode.trim() ? mode.trim() : 'L3';

  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  try {
    for await (const rawEvent of engine.runStream(userIdea, level)) {
      const event = rawEvent as WorkflowEvent & Record<string, unknown>;
      const eventType = String(event.type ?? 'unknown');

      if (eventType === 'plan_created') {
        manager.sendJson(
          {
            type: 'plan_created',
            plan_id: event.plan_id,
            message: 'Plan created successfully.',
          },
          ws,
        );
        continue;
      }

      if (eventType === 'step_start') {
        manager.sendJson(
          {
            type: 'step_start',
            step_id: event.step_id,
            step_name: event.step_name,
            message: `Starting step: ${event.step_name ?? 'unknown'}`,
          },
          ws,
        );
        continue;
      }

      if (eventType === 'step_complete') {
        const stepResult = asRecord(event.result);
        manager.sendJson(
          {
            type: 'step_complete',
            step_id: event.step_id,
            step_name: event.step_name,
            status: event.status,
            data: serializeState(stepResult),
          },
          ws,
        );

        if ('draft_content' in stepResult) {
          manager.sendJson({ type: 'draft_update', content: stepResult['draft_content'] }, ws);
        }
        if ('lock_analysis' in stepResult) {
          manager.sendJson({ type: 'lock_update', data: stepResult['lock_analysis'] }, ws);
        }
        if ('scene_cards' in stepResult) {
          manager.sendJson({ type: 'scenes_update', data: stepResult['scene_cards'] }, ws);
        }
        continue;
      }

      if (eventType === 'plan_complete') {
        manager.sendJson(
          {
            type: 'status',
            status: 'completed',
            message: 'Workflow completed successfully.',
            plan_id: event.plan_id,
          },
          ws,
        );
        continue;
      }

      if (eventType === 'plan_blocked') {
        manager.sendJson(
          {
            type: 'blocked',
            status: event.status,
            message: `Workflow blocked: ${event.status ?? 'unknown'}`,
            plan_id: event.plan_id,
            data: serializeState(asRecord(event.last_step)),
          },
          ws,
        );
        continue;
      }

      if (eventType === 'plan_error' || eventType === 'error') {
        manager.sendJson(
          {
            type: 'error',
            message: event.error ?? 'Unknown error',
            plan_id: event.plan_id,
          },
          ws,
        );
      }
    }
  } catch (error) {
    manager.sendJson(
      {
        type: 'error',
        message: String(error),
      },
      ws,
    );
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  createApp,
  setupWebSocket,
  ConnectionManager,
  serializeState,
  isWebWorkflowEnabled,
  handleWsMessage,
  runWorkflowStream,
  ORIGINS,
};
