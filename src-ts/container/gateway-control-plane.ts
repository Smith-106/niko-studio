import { ConfigManager } from '../config';
import { setConfigAccess } from '../mcp/endpoints/config';
import { resolveUiBridgeEnabled, setLlmAvailabilityProbe } from '../mcp/config';
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
import {
  setWorkflowEngineRuntimeProvider,
  type IWorkflowEngineRuntime,
} from './workflow-runtime-provider';

export interface GatewayControlPlaneState extends GatewayRuntimeState {
  container: ServiceContainer;
}

function bindWorkflowRuntimeProvider(container: ServiceContainer): void {
  const workflow = container.workflow;
  if (!workflow) {
    return;
  }

  setWorkflowEngineRuntimeProvider(({ workspace, sessionNamespace }) => {
    if (typeof workflow.createRuntime === 'function') {
      return workflow.createRuntime({ workspace, sessionNamespace });
    }
    return workflow as unknown as IWorkflowEngineRuntime;
  });
}

const uiBridgeConfigListeners = new WeakMap<ConfigManager, () => void>();
let activeUiBridgeConfigManager: ConfigManager | null = null;

function syncUiBridgeRuntime(): void {
  setUiBridgeEnabled(resolveUiBridgeEnabled());
}

function bindUiBridgeConfigRuntime(configManager: ConfigManager): void {
  if (activeUiBridgeConfigManager && activeUiBridgeConfigManager !== configManager) {
    const previousListener = uiBridgeConfigListeners.get(activeUiBridgeConfigManager);
    if (previousListener) {
      activeUiBridgeConfigManager.offChange(previousListener);
    }
  }

  if (!uiBridgeConfigListeners.has(configManager)) {
    const listener = () => {
      syncUiBridgeRuntime();
    };
    configManager.onChange(listener);
    uiBridgeConfigListeners.set(configManager, listener);
  }

  activeUiBridgeConfigManager = configManager;
  syncUiBridgeRuntime();
}

export function initializeGatewayControlPlane(
  container: ServiceContainer = getContainer(),
): GatewayControlPlaneState {
  const state = createGatewayRuntimeState();

  bindWorkflowRuntimeProvider(container);
  setGatewayDeps(buildGatewayDeps(container, state));
  setConfigAccess(buildConfigAccess(syncUiBridgeRuntime));
  setMcpServiceState(state.mcpConfigs, state.healthCache);
  setLlmAvailabilityProbe(() => container.llm != null);
  bindUiBridgeConfigRuntime(ConfigManager.getInstance());

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
