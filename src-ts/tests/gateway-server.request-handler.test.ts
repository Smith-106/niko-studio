import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createGatewayRequestHandler } from '../mcp/gateway-request-handler';
import type { GatewayRoute } from '../mcp/gateway-route-types';

const testServers: Server[] = [];

async function startTestServer(routes: GatewayRoute[]): Promise<string> {
  const server = createServer(createGatewayRequestHandler(routes));
  testServers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('test server did not expose an address');
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    testServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
});

describe('gateway request handler', () => {
  it('adapts JSON bodies, query params, and dynamic params for matched routes', async () => {
    const baseUrl = await startTestServer([
      {
        method: 'POST',
        pattern: /^\/echo\/([^/]+)$/,
        paramNames: ['slug'],
        handler: async (request) => ({
          statusCode: 200,
          body: {
            method: request.method,
            body: request.body,
            query: request.query,
            params: request.params,
          },
        }),
      },
    ]);

    const response = await fetch(`${baseUrl}/echo/item-1?mode=fast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost',
      },
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost');
    expect(await response.json()).toEqual({
      method: 'POST',
      body: { message: 'hello' },
      query: { mode: 'fast' },
      params: { slug: 'item-1' },
    });
  });

  it('handles preflight requests and preserves raw non-JSON request bodies', async () => {
    const baseUrl = await startTestServer([
      {
        method: 'POST',
        pattern: /^\/raw$/,
        handler: async (request) => ({
          statusCode: 200,
          body: { body: request.body },
        }),
      },
    ]);

    const preflight = await fetch(`${baseUrl}/raw`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');

    const response = await fetch(`${baseUrl}/raw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'plain-text-payload',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ body: 'plain-text-payload' });
  });

  it('returns the existing structured 404 payload for unmatched routes', async () => {
    const baseUrl = await startTestServer([]);
    const response = await fetch(`${baseUrl}/missing`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found', path: '/missing' });
  });
});
