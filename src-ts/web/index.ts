/**
 * Web module - Web UI Backend (compatibility path)
 *
 * Legacy: Desktop client + MCP Gateway is the primary delivery path.
 */

export {
  createApp,
  setupWebSocket,
  ConnectionManager,
  serializeState,
  isWebWorkflowEnabled,
  ORIGINS,
} from './app';
