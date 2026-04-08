import {
  agentContextEndpoint,
  agentReviseEndpoint,
  agentRouteEndpoint,
  agentWriteEndpoint,
  criticEvaluateEndpoint,
  criticSuggestionsEndpoint,
  skillsChainEndpoint,
  skillsListEndpoint,
  skillsLoadEndpoint,
  skillsMatchEndpoint,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const agentRoutes: GatewayRoute[] = [
  { method: 'POST', pattern: /^\/agent\/route$/, handler: agentRouteEndpoint },
  { method: 'POST', pattern: /^\/agent\/write$/, handler: agentWriteEndpoint },
  { method: 'POST', pattern: /^\/agent\/revise$/, handler: agentReviseEndpoint },
  { method: 'POST', pattern: /^\/agent\/context$/, handler: agentContextEndpoint },
  { method: 'POST', pattern: /^\/critic\/evaluate$/, handler: criticEvaluateEndpoint },
  { method: 'POST', pattern: /^\/critic\/suggestions$/, handler: criticSuggestionsEndpoint },
  { method: 'GET', pattern: /^\/skills\/list$/, handler: skillsListEndpoint },
  { method: 'POST', pattern: /^\/skills\/load$/, handler: skillsLoadEndpoint },
  { method: 'POST', pattern: /^\/skills\/match$/, handler: skillsMatchEndpoint },
  { method: 'POST', pattern: /^\/skills\/chain$/, handler: skillsChainEndpoint },
];
