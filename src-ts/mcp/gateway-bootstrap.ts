import { createServer, type Server } from 'node:http';

import { initializeGatewayControlPlane, prewarmGatewayControlPlane, shutdownGatewayControlPlane } from '../container/gateway-control-plane';
import { resolveGatewayHostPort } from './config';
import { createGatewayRequestHandler } from './gateway-request-handler';
import { gatewayRoutes } from './routes';
import { WorkflowEventRelay } from './gateway-ws';
import { createLogger } from '../logger/index.js';
import { initConfig, validateConfig, ensureEnvironment } from '../config/index.js';

const _log = createLogger('mcp-bootstrap');

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

function logGatewayStartup(host: string, port: number, wsEnabled: boolean): void {
  _log.info('NIKO Studio Gateway started', { host, port });
  _log.info('Endpoints available', {
    health: `http://localhost:${port}/health`,
    memory: `http://localhost:${port}/memory/search`,
    graph: `http://localhost:${port}/graph/query`,
    skills: `http://localhost:${port}/skills/list`,
    workflow: `http://localhost:${port}/workflow/route`,
    ws: wsEnabled ? `ws://localhost:${port}/ws/events` : 'disabled',
  });
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, host, () => resolve());
  });
}

export async function startGatewayServer(
  options: GatewayServerStartOptions = {},
): Promise<Server> {
  // Initialize config from project file + validate
  initConfig();
  ensureEnvironment(false);
  const { errors, warnings } = validateConfig();
  if (errors.length > 0) {
    _log.error('Config validation failed', { errors });
    throw new Error(`Config validation errors:\n- ${errors.join('\n- ')}`);
  }
  for (const w of warnings) {
    _log.warn('Config warning', { warning: w });
  }

  const { host, port } = resolveGatewayServerStartOptions(options);
  const { container } = initializeGatewayControlPlane();

  await prewarmGatewayControlPlane(container);

  const server = createServer(createGatewayRequestHandler(gatewayRoutes, container.phaseOrchestrator));

  const wsRelay = container.wsRelay;
  (wsRelay as unknown as { initialize(server: Server): void }).initialize(server);

  await listen(server, host, port);
  logGatewayStartup(host, port, true);

  // Graceful shutdown: flush WorkflowEngine state, close WebSocket relay, then close HTTP server
  const shutdown = async (signal: string) => {
    _log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await shutdownGatewayControlPlane();
    } catch (e) {
      _log.error('Error during control plane shutdown', { error: String(e) });
    }
    server.close(() => {
      _log.info('Gateway server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

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