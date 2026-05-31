import {
  worldviewExtractEndpoint,
  worldviewGetEndpoint,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const m11Routes: GatewayRoute[] = [
  { method: 'POST', pattern: /^\/worldview\/extract$/, handler: worldviewExtractEndpoint },
  { method: 'GET', pattern: /^\/worldview\/(.+)$/, handler: worldviewGetEndpoint, paramNames: ['projectId'] },
];
