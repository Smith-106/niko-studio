/**
 * Re-export from composition-root for backward compatibility.
 *
 * The control-plane wiring now lives in composition-root/gateway-control-plane.ts
 * to resolve the bi-directional dependency between container ↔ mcp.
 */

/**
 * Gracefully shut down all control plane services.
 * Flushes persistent state, closes connections, and cleans up resources.
 */
export async function shutdownGatewayControlPlane(): Promise<void> {
  const plane = _controlPlane;
  if (!plane) return;

  _log.info('Shutting down control plane...');

  // Flush workflow engine state if it has a persist method
  try {
    const we = plane.container.workflowEngine;
    if (we && typeof (we as any).persist === 'function') {
      await (we as any).persist();
    }
  } catch (e) {
    _log.warn('Failed to persist workflow engine state', { error: String(e) });
  }

  // Close memory engine connections if available
  try {
    const me = plane.container.memoryEngine;
    if (me && typeof (me as any).close === 'function') {
      await (me as any).close();
    }
  } catch (e) {
    _log.warn('Failed to close memory engine', { error: String(e) });
  }

  // Close graph store if available
  try {
    const gs = plane.container.graphStore;
    if (gs && typeof (gs as any).close === 'function') {
      await (gs as any).close();
    }
  } catch (e) {
    _log.warn('Failed to close graph store', { error: String(e) });
  }

  _log.info('Control plane shutdown complete');
}

export {
  initializeGatewayControlPlane,
  prewarmGatewayControlPlane,
  type GatewayControlPlaneState,
} from '../composition-root/gateway-control-plane.js';