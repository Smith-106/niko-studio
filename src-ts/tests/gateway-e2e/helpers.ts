import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { buildGatewayDeps } from '../../gateway-server';
import { ConfigManager } from '../../config';
import { ServiceContainer } from '../../container/ServiceContainer';
import { ServiceTypes } from '../../container/types';
import { createGatewayRequestHandler } from '../../mcp/gateway-request-handler';
import { gatewayRoutes } from '../../mcp/routes';
import { setGatewayDeps } from '../../mcp/endpoints/health';

const testServers: Server[] = [];

export function createTestContainer(): ServiceContainer {
  const container = new ServiceContainer();

  const healthOk = { healthCheck: async () => ({ status: 'ok' }) };
  container.registerMock(ServiceTypes.MemoryEngine, healthOk);
  container.registerMock(ServiceTypes.GraphEngine, healthOk);
  container.registerMock(ServiceTypes.SearchEngine, healthOk);
  container.registerMock(ServiceTypes.WorkflowEngine, healthOk);
  container.registerMock(ServiceTypes.CriticEngine, healthOk);

  return container;
}

export function setupGatewayDeps(): void {
  ConfigManager.resetInstance();
  const container = createTestContainer();
  const deps = buildGatewayDeps(container);
  setGatewayDeps(deps);
}

export async function startE2EServer(): Promise<string> {
  setupGatewayDeps();

  const server = createServer(createGatewayRequestHandler(gatewayRoutes));
  testServers.push(server);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('E2E test server did not expose an address');
  }

  return `http://127.0.0.1:${address.port}`;
}

export async function stopAllServers(): Promise<void> {
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
  ConfigManager.resetInstance();
}

export async function fetchJSON<T = unknown>(
  url: string,
  options?: RequestInit,
): Promise<{ status: number; data: T }> {
  const target = new URL(url);
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'http://localhost',
    ...((options?.headers as Record<string, string> | undefined) ?? {}),
  };

  return await new Promise<{ status: number; data: T }>((resolve, reject) => {
    const request = httpRequest(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: options?.method ?? 'GET',
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: response.statusCode ?? 0,
              data: (raw ? JSON.parse(raw) : null) as T,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    request.on('error', reject);

    if (options?.body != null) {
      request.write(typeof options.body === 'string' ? options.body : String(options.body));
    }

    request.end();
  });
}
