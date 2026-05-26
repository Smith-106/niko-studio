/**
 * Workflow Event Relay — 实时状态推送
 *
 * 参考 maestro-flow 的 WebSocket 状态广播模式。
 * 将 DelegateBroker 和 PhaseOrchestrator 的状态变更推送到所有连接的 WebSocket 客户端。
 */

import { type Server } from 'node:http';
import { WebSocketServer, WebSocket, type Data } from 'ws';
import { createLogger } from '../logger/index.js';

const _log = createLogger('workflow-event-relay');

// ─── Event Types ──────────────────────────────────────────────────────────────

export type WorkflowEventType =
  | 'delegate:status'
  | 'delegate:message'
  | 'phase:transition'
  | 'workflow:step'
  | 'workflow:plan';

export interface WorkflowEvent {
  type: WorkflowEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ─── Client Tracking ──────────────────────────────────────────────────────────

interface TrackedClient {
  ws: WebSocket;
  subscribedTypes: Set<WorkflowEventType> | null; // null = all
  connectedAt: string;
}

// ─── WorkflowEventRelay ───────────────────────────────────────────────────────

export class WorkflowEventRelay {
  private readonly clients: Map<WebSocket, TrackedClient> = new Map();
  private readonly wss: WebSocketServer;
  private _closed = false;

  constructor(server?: Server, path = '/ws/events') {
    this.wss = server
      ? new WebSocketServer({ noServer: true })
      : new WebSocketServer({ port: 0 });

    if (server) {
      server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
        if (url.pathname === path) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        }
      });
    }

    this.wss.on('connection', (ws, request) => {
      this._handleConnection(ws, request);
    });
  }

  get clientCount(): number {
    return this.clients.size;
  }

  get port(): number | null {
    const addr = this.wss.address();
    return typeof addr === 'object' && addr !== null ? addr.port : null;
  }

  /**
   * 向所有订阅的客户端广播事件
   */
  broadcast(event: WorkflowEvent): void {
    if (this._closed) return;

    const data = JSON.stringify(event);
    for (const [ws, client] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (client.subscribedTypes !== null && !client.subscribedTypes.has(event.type)) continue;

      try {
        ws.send(data);
      } catch (err) {
        _log.warn('Failed to send to client', { error: String(err) });
      }
    }
  }

  /**
   * 便捷方法：广播 delegate 状态变更
   */
  broadcastDelegateStatus(delegateId: string, status: string, extra?: Record<string, unknown>): void {
    this.broadcast({
      type: 'delegate:status',
      timestamp: new Date().toISOString(),
      payload: { delegateId, status, ...extra },
    });
  }

  /**
   * 便捷方法：广播阶段转换
   */
  broadcastPhaseTransition(from: string, to: string, trigger: string, extra?: Record<string, unknown>): void {
    this.broadcast({
      type: 'phase:transition',
      timestamp: new Date().toISOString(),
      payload: { from, to, trigger, ...extra },
    });
  }

  /**
   * 关闭 relay，断开所有客户端
   */
  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;

    for (const [ws] of this.clients) {
      try { ws.close(1001, 'server shutdown'); } catch { /* ignore */ }
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private _handleConnection(ws: WebSocket, request: unknown): void {
    const client: TrackedClient = {
      ws,
      subscribedTypes: null,
      connectedAt: new Date().toISOString(),
    };
    this.clients.set(ws, client);

    _log.info('WebSocket client connected', { totalClients: this.clients.size });

    ws.on('message', (raw: Data) => {
      this._handleMessage(ws, raw);
    });

    ws.on('close', (code, reason) => {
      this.clients.delete(ws);
      _log.info('WebSocket client disconnected', { code, totalClients: this.clients.size });
    });

    ws.on('error', (err) => {
      _log.warn('WebSocket client error', { error: String(err) });
      this.clients.delete(ws);
    });

    // 发送连接确认
    this._send(ws, {
      type: 'workflow:step',
      timestamp: new Date().toISOString(),
      payload: { event: 'connected', clientCount: this.clients.size },
    });
  }

  private _handleMessage(ws: WebSocket, raw: Data): void {
    try {
      const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

      // 订阅过滤
      if (msg.action === 'subscribe' && Array.isArray(msg.types)) {
        const client = this.clients.get(ws);
        if (client) {
          client.subscribedTypes = new Set(msg.types as WorkflowEventType[]);
          _log.info('Client subscribed to event types', { types: msg.types });
        }
        this._send(ws, {
          type: 'workflow:step',
          timestamp: new Date().toISOString(),
          payload: { event: 'subscribed', types: msg.types },
        });
        return;
      }

      // 取消订阅过滤
      if (msg.action === 'unsubscribe') {
        const client = this.clients.get(ws);
        if (client) {
          client.subscribedTypes = null;
        }
        this._send(ws, {
          type: 'workflow:step',
          timestamp: new Date().toISOString(),
          payload: { event: 'unsubscribed' },
        });
        return;
      }

      // ping/pong
      if (msg.action === 'ping') {
        this._send(ws, {
          type: 'workflow:step',
          timestamp: new Date().toISOString(),
          payload: { event: 'pong' },
        });
      }
    } catch {
      _log.warn('Invalid WebSocket message received');
    }
  }

  private _send(ws: WebSocket, event: WorkflowEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(event)); } catch { /* ignore */ }
    }
  }
}
