/**
 * MCP Endpoints - barrel exports
 */

export {
  healthCheck,
  metricsEndpoint,
  listTools,
  listModels,
  setGatewayDeps,
} from './health';

export {
  getConfig,
  updateConfig,
  getSecrets,
  updateSecrets,
  reloadConfig,
  setConfigAccess,
} from './config';

export {
  chatEndpoint,
  chatStreamEndpoint,
  adaptiveChunkContent,
} from './chat';

export {
  agentRouteEndpoint,
  agentWriteEndpoint,
  agentReviseEndpoint,
  agentContextEndpoint,
} from './agent';

export {
  criticEvaluateEndpoint,
  criticSuggestionsEndpoint,
} from './critic';

export {
  graphQueryEndpoint,
  graphCharacterEndpoint,
  graphForeshadowsEndpoint,
} from './graph';

export {
  workspaceContextEndpoint,
} from './workspace';

export {
  memorySearchEndpoint,
  memoryAddEndpoint,
  memoryUploadEndpoint,
  memoryTemporalEndpoint,
} from './memory';

export {
  skillsListEndpoint,
  skillsLoadEndpoint,
  skillsMatchEndpoint,
  skillsChainEndpoint,
} from './skills';

export {
  workflowRouteEndpoint,
  workflowPlanEndpoint,
  workflowExecuteEndpoint,
  workflowLifecycleEndpoint,
  workflowQuickRollbackEndpoint,
  workflowSchedulerRegisterEndpoint,
  workflowSchedulerListEndpoint,
  workflowSchedulerPauseEndpoint,
  workflowSchedulerResumeEndpoint,
  workflowSchedulerRunNowEndpoint,
  setUiBridgeEnabled,
  uiBridgeWorkflowRouteEndpoint,
  uiBridgeWorkflowPlanEndpoint,
  uiBridgeWorkflowExecuteEndpoint,
  uiBridgeWorkflowLifecycleEndpoint,
  uiBridgeWorkflowSchedulerRegisterEndpoint,
  uiBridgeWorkflowSchedulerListEndpoint,
  uiBridgeWorkflowSchedulerPauseEndpoint,
  uiBridgeWorkflowSchedulerResumeEndpoint,
  uiBridgeWorkflowSchedulerRunNowEndpoint,
  checkpointCreateEndpoint,
  checkpointRestoreEndpoint,
  checkpointListEndpoint,
} from './workflow';

export {
  novelQualityCheckEndpoint,
  writingHelperProcessEndpoint,
  writingStreamEndpoint,
} from './writing';

export {
  wikiListEndpoint,
  wikiPromoteEndpoint,
  wikiReadPageEndpoint,
} from './wiki';

export {
  listMcpServices,
  createMcpService,
  updateMcpService,
  deleteMcpService,
  setMcpServiceEnabled,
  probeMcpServiceHealth,
  setMcpServiceState,
} from './mcp-admin';
