/**
 * MCP Gateway Engine Accessors
 *
 * Engine accessor functions that delegate to the service container.
 *
 * Migrated from src/mcp/engine.py
 */

import { getContainer } from '../container/ServiceContainer';
import type { IMemoryEngine, IGraphEngine, ISearchEngine, IWorkflowEngine, ICriticEngine } from '../container/types';

export function getMemoryEngine(): IMemoryEngine {
  return getContainer().memory;
}

export function getGraphEngine(): IGraphEngine {
  return getContainer().graph;
}

export function getSearchEngine(): ISearchEngine {
  return getContainer().search;
}

export function getWorkflowEngine(): IWorkflowEngine {
  return getContainer().workflow;
}

export function getCriticEngine(): ICriticEngine {
  return getContainer().critic;
}

/**
 * Pre-warm critical engines at startup using parallel initialization.
 *
 * This reduces cold start latency by initializing engines before first request.
 */
export async function prewarmEngines(): Promise<void> {
  await getContainer().initializeAll();
}
