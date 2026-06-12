import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import {
  WorkflowEventRelay,
  type WorkflowEvent,
  type WorkflowEventType,
} from '../../mcp/gateway-ws.js';

type FakeSocket = {
  emit: (event: string, ...args: unknown[]) => void;
  readyState: number;
  sent: string[];
  close: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => FakeSocket;
  send: (data: string) => void;
  terminate: () => void;
};

function createSocket(options?: {
  readyState?: number;
  throwOnClose?: boolean;
  throwOnSend?: boolean;
  throwOnTerminate?: boolean;
}): FakeSocket {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    readyState: options?.readyState ?? WebSocket.OPEN,
    sent: [],
    close() {
      if (options?.throwOnClose) {
        throw new Error('close failed');
      }
      this.readyState = WebSocket.CLOSED;
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of listeners.get(event) ?? []) {
        handler(...args);
      }
    },
    on(event: string, handler: (...args: unknown[]) => void) {
      const current = listeners.get(event) ?? [];
      current.push(handler);
      listeners.set(event, current);
      return this;
    },
    send(data: string) {
      if (options?.throwOnSend) {
        throw new Error('send failed');
      }
      this.sent.push(data);
    },
    terminate() {
      if (options?.throwOnTerminate) {
        throw new Error('terminate failed');
      }
      this.readyState = WebSocket.CLOSED;
    },
  };
}

describe('WorkflowEventRelay additional coverage', () => {
  const relays: WorkflowEventRelay[] = [];

  afterEach(async () => {
    while (relays.length > 0) {
      await relays.pop()?.close();
    }
  });

  it('handles unsubscribe, ping, subscribe-without-client, and invalid payload branches', () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);
    const relayAny = relay as unknown as {
      clients: Map<
        WebSocket,
        {
          ws: WebSocket;
          subscribedTypes: Set<WorkflowEventType> | null;
          connectedAt: string;
        }
      >;
      _handleMessage: (ws: WebSocket, raw: unknown) => void;
    };

    const tracked = createSocket();
    relayAny.clients.set(tracked as unknown as WebSocket, {
      ws: tracked as unknown as WebSocket,
      subscribedTypes: new Set<WorkflowEventType>(['delegate:status']),
      connectedAt: '2026-06-05T00:00:00.000Z',
    });

    relayAny._handleMessage(
      tracked as unknown as WebSocket,
      JSON.stringify({ action: 'unsubscribe' }),
    );
    expect(
      relayAny.clients.get(tracked as unknown as WebSocket)?.subscribedTypes,
    ).toBeNull();
    expect(
      JSON.parse(tracked.sent.at(-1) ?? 'null').payload.event,
    ).toBe('unsubscribed');

    relayAny._handleMessage(
      tracked as unknown as WebSocket,
      Buffer.from(JSON.stringify({ action: 'ping' })),
    );
    expect(
      JSON.parse(tracked.sent.at(-1) ?? 'null').payload.event,
    ).toBe('pong');

    const orphan = createSocket();
    relayAny._handleMessage(
      orphan as unknown as WebSocket,
      JSON.stringify({ action: 'subscribe', types: ['phase:transition'] }),
    );
    expect(JSON.parse(orphan.sent[0]).payload).toMatchObject({
      event: 'subscribed',
      types: ['phase:transition'],
    });

    expect(() =>
      relayAny._handleMessage(
        tracked as unknown as WebSocket,
        '{bad-json',
      ),
    ).not.toThrow();
  });

  it('sends the initial connected payload when a client is attached directly', () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);
    const relayAny = relay as unknown as {
      clients: Map<WebSocket, unknown>;
      _handleConnection: (ws: WebSocket, request: unknown) => void;
    };

    const directClient = createSocket();
    relayAny._handleConnection(
      directClient as unknown as WebSocket,
      { headers: { host: 'localhost' } },
    );

    expect(JSON.parse(directClient.sent[0] ?? 'null')).toMatchObject({
      type: 'workflow:step',
      payload: {
        event: 'connected',
        clientCount: 1,
      },
    });
  });

  it('removes direct clients when the socket emits an error event', () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);
    const relayAny = relay as unknown as {
      clients: Map<WebSocket, unknown>;
      _handleConnection: (ws: WebSocket, request: unknown) => void;
    };

    const directClient = createSocket();
    relayAny._handleConnection(
      directClient as unknown as WebSocket,
      { headers: { host: 'localhost' } },
    );
    expect(relayAny.clients.size).toBe(1);

    directClient.emit('error', new Error('socket failed'));
    expect(relayAny.clients.size).toBe(0);
  });

  it('swallows broadcast and send failures and ignores closed sockets', () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);
    const relayAny = relay as unknown as {
      clients: Map<
        WebSocket,
        {
          ws: WebSocket;
          subscribedTypes: Set<WorkflowEventType> | null;
          connectedAt: string;
        }
      >;
      _send: (ws: WebSocket, event: WorkflowEvent) => void;
    };

    const failing = createSocket({ throwOnSend: true });
    const closed = createSocket({ readyState: WebSocket.CLOSED });
    relayAny.clients.set(failing as unknown as WebSocket, {
      ws: failing as unknown as WebSocket,
      subscribedTypes: null,
      connectedAt: '2026-06-05T00:00:00.000Z',
    });
    relayAny.clients.set(closed as unknown as WebSocket, {
      ws: closed as unknown as WebSocket,
      subscribedTypes: null,
      connectedAt: '2026-06-05T00:00:01.000Z',
    });

    expect(() =>
      relay.broadcast({
        type: 'delegate:status',
        timestamp: new Date().toISOString(),
        payload: { delegateId: 'd-1', status: 'running' },
      }),
    ).not.toThrow();

    expect(() =>
      relayAny._send(closed as unknown as WebSocket, {
        type: 'workflow:step',
        timestamp: new Date().toISOString(),
        payload: { event: 'ignored' },
      }),
    ).not.toThrow();

    expect(() =>
      relayAny._send(failing as unknown as WebSocket, {
        type: 'workflow:step',
        timestamp: new Date().toISOString(),
        payload: { event: 'send-failure' },
      }),
    ).not.toThrow();
  });

  it('supports standalone-server mode port lookup and idempotent close', async () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);

    expect(typeof relay.port).toBe('number');

    await relay.close();
    await relay.close();
  });

  it('handles upgrade routing fallbacks and non-object port addresses', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const fakeServer = {
      on(event: string, handler: (...args: unknown[]) => void) {
        handlers.set(event, handler);
      },
    };

    const relay = new WorkflowEventRelay(fakeServer as never, '/');
    relays.push(relay);
    const relayAny = relay as unknown as {
      wss: {
        handleUpgrade: (
          request: unknown,
          socket: unknown,
          head: unknown,
          callback: (ws: WebSocket) => void,
        ) => void;
        emit: (event: string, ws: WebSocket, request: unknown) => void;
        address: () => string | { port: number } | null;
      };
    };

    const upgradedClient = createSocket();
    const handleUpgradeSpy = vi
      .spyOn(relayAny.wss, 'handleUpgrade')
      .mockImplementation((_request, _socket, _head, callback) => {
        callback(upgradedClient as unknown as WebSocket);
      });
    const emitSpy = vi.spyOn(relayAny.wss, 'emit');

    handlers.get('upgrade')?.(
      { url: '/different', headers: { host: 'example.test' } },
      {},
      Buffer.alloc(0),
    );
    expect(handleUpgradeSpy).not.toHaveBeenCalled();

    handlers.get('upgrade')?.(
      { url: undefined, headers: {} },
      {},
      Buffer.alloc(0),
    );
    expect(handleUpgradeSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      'connection',
      upgradedClient as unknown as WebSocket,
      expect.objectContaining({ url: undefined }),
    );

    vi.spyOn(relayAny.wss, 'address').mockReturnValue('named-pipe');
    expect(relay.port).toBeNull();
  });

  it('resolves close after timeout and ignores a later server callback', async () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);
    const relayAny = relay as unknown as {
      wss: {
        close: (callback: () => void) => void;
      };
    };

    let closeCallback: (() => void) | null = null;
    vi.spyOn(relayAny.wss, 'close').mockImplementation((callback: () => void) => {
      closeCallback = callback;
    });

    const timeoutCallbacks: Array<() => void> = [];
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: TimerHandler) => {
        timeoutCallbacks.push(callback as () => void);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);
    const clearTimeoutSpy = vi
      .spyOn(globalThis, 'clearTimeout')
      .mockImplementation((() => undefined) as typeof clearTimeout);

    const closePromise = relay.close();
    expect(timeoutCallbacks).toHaveLength(1);

    timeoutCallbacks[0]!();
    await closePromise;

    closeCallback?.();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(1);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('swallows client shutdown exceptions while closing the relay', async () => {
    const relay = new WorkflowEventRelay();
    relays.push(relay);
    const relayAny = relay as unknown as {
      clients: Map<
        WebSocket,
        {
          ws: WebSocket;
          subscribedTypes: Set<WorkflowEventType> | null;
          connectedAt: string;
        }
      >;
    };

    const broken = createSocket({ throwOnClose: true });
    relayAny.clients.set(broken as unknown as WebSocket, {
      ws: broken as unknown as WebSocket,
      subscribedTypes: null,
      connectedAt: '2026-06-05T00:00:02.000Z',
    });

    await expect(relay.close()).resolves.toBeUndefined();
    expect(relay.clientCount).toBe(0);
  });
});
