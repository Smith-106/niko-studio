import { createServer, type Server } from 'node:http';

import { initializeGatewayControlPlane, prewarmGatewayControlPlane } from '../container/gateway-control-plane';
import { resolveGatewayHostPort } from './config';
import { createGatewayRequestHandler } from './gateway-request-handler';
import { gatewayRoutes } from './routes';

export interface GatewayServerStartOptions {
  host?: string;
  port?: number;
}

export function resolveGatewayServerStartOptions(
  options: GatewayServerStartOptions = {},
): { host: string; port: number } {
  const { host: defaultHost, port: defaultPort } = resolveGatewayHostPort();
  const host =
    typeof options.host === 'string' && options.host.trim()
      ? options.host.trim()
      : defaultHost;
  const port =
    typeof options.port === 'number' && Number.isFinite(options.port)
      ? options.port
      : defaultPort;

  return { host, port };
}

function logGatewayStartup(host: string, port: number): void {
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
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve());
  });
}

export async function startGatewayServer(
  options: GatewayServerStartOptions = {},
): Promise<Server> {
  const { host, port } = resolveGatewayServerStartOptions(options);
  const { container } = initializeGatewayControlPlane();

  await prewarmGatewayControlPlane(container);

  const server = createServer(createGatewayRequestHandler(gatewayRoutes));
  await listen(server, host, port);
  logGatewayStartup(host, port);

  return server;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let portOverride: number | undefined;
  let hostOverride: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port' && argv[i + 1]) {
      portOverride = parseInt(argv[i + 1], 10);
    }
    if (argv[i] === '--host' && argv[i + 1]) {
      hostOverride = argv[i + 1];
    }
  }

  await startGatewayServer({ host: hostOverride, port: portOverride });
}
