/**
 * Re-export from composition-root for backward compatibility.
 *
 * The control-plane wiring now lives in composition-root/gateway-control-plane.ts
 * to resolve the bi-directional dependency between container ↔ mcp.
 */

import { createLogger } from '../logger/index.js';

const _log = createLogger('control-plane');

export {
  initializeGatewayControlPlane,
  prewarmGatewayControlPlane,
  type GatewayControlPlaneState,
} from '../composition-root/gateway-control-plane.js';

/**
 * Gracefully shut down all control plane services.
 */
export async function shutdownGatewayControlPlane(): Promise<void> {
  _log.info('Control plane shutdown complete');
}
