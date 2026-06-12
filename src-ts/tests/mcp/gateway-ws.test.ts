import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import WebSocket from 'ws';
import { WorkflowEventRelay, type WorkflowEvent } from '../../mcp/gateway-ws.js';

describe('WorkflowEventRelay', () => {
  let server: Server;
  let relay: WorkflowEventRelay;

  beforeEach(async () => {
    server = createServer(() => {});
    server.listen(0);
    relay = new WorkflowEventRelay(server, '/ws/events');
  });

  afterEach(async () => {
    await relay.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function getPort(): number {
    const addr = server.address();
    return typeof addr === 'object' && addr !== null ? addr.port : 0;
  }

  function connectWs(): WebSocket {
    const port = getPort();
    return new WebSocket(`ws://localhost:${port}/ws/events`);
  }

  async function waitForOpen(ws: WebSocket): Promise<void> {
    if (ws.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve) => {
      ws.once('open', () => resolve());
    });
  }

  it('accepts WebSocket connections', async () => {
    const ws = connectWs();
    const msg = await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });

    expect(msg.type).toBe('workflow:step');
    expect(msg.payload.event).toBe('connected');
    expect(relay.clientCount).toBe(1);

    ws.close();
  });

  it('broadcasts events to connected clients', async () => {
    const ws = connectWs();

    // Wait for connection message
    await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => {
        const evt = JSON.parse(raw.toString());
        if (evt.payload.event === 'connected') resolve(evt);
      });
    });

    relay.broadcast({
      type: 'delegate:status',
      timestamp: new Date().toISOString(),
      payload: { delegateId: 'del-1', status: 'running' },
    });

    const msg = await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });

    expect(msg.type).toBe('delegate:status');
    expect(msg.payload.delegateId).toBe('del-1');

    ws.close();
  });

  it('supports event type subscription filtering', async () => {
    const ws = connectWs();

    // Wait for connected
    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    // Subscribe to phase:transition only
    ws.send(JSON.stringify({ action: 'subscribe', types: ['phase:transition'] }));

    // Wait for subscribe confirmation
    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    // Broadcast delegate:status — should NOT be received (filtered out)
    relay.broadcast({
      type: 'delegate:status',
      timestamp: new Date().toISOString(),
      payload: { delegateId: 'del-1', status: 'running' },
    });

    // Broadcast phase:transition — SHOULD be received
    relay.broadcast({
      type: 'phase:transition',
      timestamp: new Date().toISOString(),
      payload: { from: 'planning', to: 'execution' },
    });

    const msg = await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => {
        const evt = JSON.parse(raw.toString());
        if (evt.type === 'phase:transition') resolve(evt);
      });
    });

    expect(msg.type).toBe('phase:transition');
    expect(msg.payload.from).toBe('planning');

    ws.close();
  });

  it('broadcastDelegateStatus convenience method', async () => {
    const ws = connectWs();

    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    relay.broadcastDelegateStatus('del-2', 'completed', { result: 'ok' });

    const msg = await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });

    expect(msg.type).toBe('delegate:status');
    expect(msg.payload.delegateId).toBe('del-2');
    expect(msg.payload.result).toBe('ok');

    ws.close();
  });

  it('broadcastPhaseTransition convenience method', async () => {
    const ws = connectWs();

    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    relay.broadcastPhaseTransition('planning', 'execution', 'gate-passed');

    const msg = await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });

    expect(msg.type).toBe('phase:transition');
    expect(msg.payload.from).toBe('planning');
    expect(msg.payload.trigger).toBe('gate-passed');

    ws.close();
  });

  it('handles ping/pong', async () => {
    const ws = connectWs();

    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    ws.send(JSON.stringify({ action: 'ping' }));

    const msg = await new Promise<WorkflowEvent>((resolve) => {
      ws.on('message', (raw) => {
        const evt = JSON.parse(raw.toString());
        if (evt.payload.event === 'pong') resolve(evt);
      });
    });

    expect(msg.payload.event).toBe('pong');

    ws.close();
  });

  it('removes client on disconnect', async () => {
    const ws = connectWs();

    await new Promise<void>((resolve) => {
      ws.on('open', () => resolve());
    });

    expect(relay.clientCount).toBe(1);

    ws.close();

    // Wait for close event
    await new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
    });

    // Give server a moment to process disconnect
    await new Promise(r => setTimeout(r, 100));
    expect(relay.clientCount).toBe(0);
  });

  it('close shuts down relay and disconnects all clients', async () => {
    const ws1 = connectWs();
    const ws2 = connectWs();
    const ws1Closed = new Promise<void>((resolve) => {
      ws1.on('close', () => resolve());
    });
    const ws2Closed = new Promise<void>((resolve) => {
      ws2.on('close', () => resolve());
    });

    await Promise.all([waitForOpen(ws1), waitForOpen(ws2)]);

    expect(relay.clientCount).toBe(2);

    await relay.close();
    await Promise.all([ws1Closed, ws2Closed]);

    expect(relay.clientCount).toBe(0);
    expect(ws1.readyState).toBe(WebSocket.CLOSED);
    expect(ws2.readyState).toBe(WebSocket.CLOSED);
  });

  it('does not broadcast after close', async () => {
    await relay.close();

    relay.broadcast({
      type: 'delegate:status',
      timestamp: new Date().toISOString(),
      payload: { delegateId: 'del-1', status: 'running' },
    });

    // No clients connected, no crash — just silently ignored
    expect(relay.clientCount).toBe(0);
  });
});
