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

import { main } from './mcp/gateway-bootstrap';

export { buildConfigAccess, buildGatewayDeps } from './mcp/gateway-state';
export { type GatewayServerStartOptions, main, startGatewayServer } from './mcp/gateway-bootstrap';

const runningAsMain = (() => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
})();

if (runningAsMain) {
  main().catch((error) => {
    console.error('Gateway failed to start:', error);
    process.exit(1);
  });
}
