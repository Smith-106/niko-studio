/**
 * Re-export from composition-root for backward compatibility.
 *
 * The control-plane wiring now lives in composition-root/gateway-control-plane.ts
 * to resolve the bi-directional dependency between container ↔ mcp.
 */

export {
  initializeGatewayControlPlane,
  prewarmGatewayControlPlane,
  type GatewayControlPlaneState,
} from '../composition-root/gateway-control-plane.js';