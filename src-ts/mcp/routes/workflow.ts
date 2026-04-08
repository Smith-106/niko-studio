import {
  checkpointCreateEndpoint,
  checkpointListEndpoint,
  checkpointRestoreEndpoint,
  uiBridgeWorkflowExecuteEndpoint,
  uiBridgeWorkflowLifecycleEndpoint,
  uiBridgeWorkflowPlanEndpoint,
  uiBridgeWorkflowRouteEndpoint,
  workflowExecuteEndpoint,
  workflowLifecycleEndpoint,
  workflowPlanEndpoint,
  workflowQuickRollbackEndpoint,
  workflowRouteEndpoint,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const workflowRoutes: GatewayRoute[] = [
  { method: 'POST', pattern: /^\/workflow\/route$/, handler: workflowRouteEndpoint },
  { method: 'POST', pattern: /^\/workflow\/plan$/, handler: workflowPlanEndpoint },
  { method: 'POST', pattern: /^\/workflow\/execute$/, handler: workflowExecuteEndpoint },
  { method: 'POST', pattern: /^\/workflow\/lifecycle$/, handler: workflowLifecycleEndpoint },
  { method: 'POST', pattern: /^\/workflow\/rollback$/, handler: workflowQuickRollbackEndpoint },
  { method: 'POST', pattern: /^\/checkpoint\/create$/, handler: checkpointCreateEndpoint },
  { method: 'POST', pattern: /^\/checkpoint\/restore$/, handler: checkpointRestoreEndpoint },
  { method: 'POST', pattern: /^\/checkpoint\/list$/, handler: checkpointListEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/route$/, handler: uiBridgeWorkflowRouteEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/plan$/, handler: uiBridgeWorkflowPlanEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/execute$/, handler: uiBridgeWorkflowExecuteEndpoint },
  { method: 'POST', pattern: /^\/ui-bridge\/workflow\/lifecycle$/, handler: uiBridgeWorkflowLifecycleEndpoint },
];
