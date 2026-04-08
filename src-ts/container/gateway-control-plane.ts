import { setConfigAccess } from '../mcp/endpoints/config';
import { setGatewayDeps } from '../mcp/endpoints/health';
import { setMcpServiceState } from '../mcp/endpoints/mcp-admin';
import { setUiBridgeEnabled } from '../mcp/endpoints/workflow';
import {
  buildConfigAccess,
  buildGatewayDeps,
  createGatewayRuntimeState,
  type GatewayRuntimeState,
} from '../mcp/gateway-state';
import { getContainer, ServiceContainer } from './ServiceContainer';

export interface GatewayControlPlaneState extends GatewayRuntimeState {
  container: ServiceContainer;
}

export function initializeGatewayControlPlane(
  container: ServiceContainer = getContainer(),
): GatewayControlPlaneState {
  const state = createGatewayRuntimeState();

  setGatewayDeps(buildGatewayDeps(container, state));
  setConfigAccess(buildConfigAccess());
  setMcpServiceState(state.mcpConfigs, state.healthCache);
  setUiBridgeEnabled(process.env.NIKO_UI_BRIDGE_ENABLED === 'true');

  return {
    container,
    ...state,
  };
}

export async function prewarmGatewayControlPlane(container: ServiceContainer): Promise<void> {
  try {
    await container.initializeAll();
  } catch (error) {
    console.warn('Engine pre-warm warning:', error);
  }
}
