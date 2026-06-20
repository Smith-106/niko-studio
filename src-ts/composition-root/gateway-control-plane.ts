/**
 * Gateway Control Plane — Composition Root
 *
 * This module wires together the container layer and the MCP presentation layer.
 * It sits above both, so neither container nor mcp imports from the other.
 *
 * Migrated from container/gateway-control-plane.ts to resolve the
 * bi-directional dependency between container ↔ mcp.
 */

import { ConfigManager } from '../config';
import { GraphManager, type IEntityVectorSearch } from '../graph/graph-manager';
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
import { getContainer, ServiceContainer } from '../container/ServiceContainer';
import {
  setWorkflowEngineRuntimeProvider,
  type IWorkflowEngineRuntime,
} from '../container/workflow-runtime-provider';
import { invalidateCorsCache } from '../mcp/gateway-http-adapter';
import { createLogger } from '../logger/index.js';

const log = createLogger('control-plane');

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
  invalidateCorsCache();
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

/**
 * Wire the container's VectorSearch into GraphManager so semantic-search
 * embedding hooks fire on entity create/update/delete.
 *
 * Failures are logged but never throw — the sidecar must still start even
 * without semantic search.
 */
function wireVectorSearchIntoGraphManager(container: ServiceContainer): void {
  try {
    const vectorSearch = container.vectorSearch as unknown as IEntityVectorSearch;
    if (!vectorSearch || typeof vectorSearch.add !== 'function') {
      GraphManager.setDefaultVectorSearch(null);
      return;
    }
    GraphManager.setDefaultVectorSearch(vectorSearch);
  } catch (error) {
    log.warn('VectorSearch → GraphManager wiring skipped', { error: String(error) });
    GraphManager.setDefaultVectorSearch(null);
  }
}

export function initializeGatewayControlPlane(
  container: ServiceContainer = getContainer(),
): GatewayControlPlaneState {
  const state = createGatewayRuntimeState();

  bindWorkflowRuntimeProvider(container);
  wireVectorSearchIntoGraphManager(container);
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
    log.error('Engine pre-warm failed — some services may be unavailable', { error: String(error) });
    // Expose degraded state via health endpoint so the frontend can detect it
    setGatewayDeps(buildGatewayDeps(container, createGatewayRuntimeState()));
  }
}

/**
 * Gracefully shut down all control plane services.
 *
 * Flushes the WorkflowEngine, shuts down the ServiceContainer, and resets
 * global mutable state set by the set*() functions during initialization.
 */
export async function shutdownGatewayControlPlane(container?: ServiceContainer): Promise<void> {
  const c = container ?? getContainer();
  try {
    await c.shutdown();
    log.info('ServiceContainer shutdown complete');
  } catch (error) {
    log.error('Error during ServiceContainer shutdown', { error: String(error) });
  }

  // Reset global mutable state to prevent stale references after shutdown
  setGatewayDeps(null as unknown as Parameters<typeof setGatewayDeps>[0]);
  setConfigAccess(null as unknown as Parameters<typeof setConfigAccess>[0]);
  setLlmAvailabilityProbe(null);

  log.info('Control plane shutdown complete');
}