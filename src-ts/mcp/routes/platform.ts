import {
  getConfig,
  getSecrets,
  healthCheck,
  listModels,
  listTools,
  metricsEndpoint,
  updateConfig,
  updateSecrets,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const platformRoutes: GatewayRoute[] = [
  { method: 'GET', pattern: /^\/health$/, handler: healthCheck },
  { method: 'GET', pattern: /^\/metrics$/, handler: metricsEndpoint },
  { method: 'GET', pattern: /^\/tools$/, handler: listTools },
  { method: 'GET', pattern: /^\/models$/, handler: listModels },
  { method: 'GET', pattern: /^\/config$/, handler: getConfig },
  { method: 'POST', pattern: /^\/config$/, handler: updateConfig },
  { method: 'GET', pattern: /^\/config\/secrets$/, handler: getSecrets },
  { method: 'POST', pattern: /^\/config\/secrets$/, handler: updateSecrets },
];
