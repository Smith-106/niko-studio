/**
 * MCP Gateway Engine Accessors
 *
 * Engine accessor functions that delegate to the service container.
 *
 * Migrated from src/mcp/engine.py
 */

import { getContainer } from '../container/ServiceContainer';

/**
 * Get memory engine (delegates to container).
 */
export function getMemoryEngine() {
  return getContainer().memory;
}

/**
 * Get graph engine (delegates to container).
 */
export function getGraphEngine() {
  return getContainer().graph;
}

/**
 * Get search engine (delegates to container).
 */
export function getSearchEngine() {
  return getContainer().search;
}

/**
 * Get workflow engine (delegates to container).
 */
export function getWorkflowEngine() {
  return getContainer().workflow;
}

/**
 * Get critic engine (delegates to container).
 */
export function getCriticEngine() {
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
