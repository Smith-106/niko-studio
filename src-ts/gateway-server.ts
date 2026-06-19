/**
 * REST Gateway Server
 *
 * Node.js HTTP server that routes URL paths to MCP endpoint functions.
 * Replaces the Python uvicorn gateway (src/mcp/gateway.py).
 *
 * Usage:
 *   npx ts-node gateway-server.ts
 *   npx ts-node gateway-server.ts --port 8000 --host 0.0.0.0
 */

import 'reflect-metadata';
import { pathToFileURL } from 'node:url';

import { logger } from './logger/index.js';
import { main } from './mcp/gateway-bootstrap.js';

export { buildConfigAccess, buildGatewayDeps } from './mcp/gateway-state.js';
export { type GatewayServerStartOptions, main, startGatewayServer } from './mcp/gateway-bootstrap.js';

const runningAsMain = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
})();

/* v8 ignore next -- @preserve */
if (runningAsMain) {
  main().catch((error) => {
    logger.error('Gateway failed to start', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    process.exit(1);
  });
}
