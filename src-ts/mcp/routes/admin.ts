import {
  createMcpService,
  deleteMcpService,
  listMcpServices,
  probeMcpServiceHealth,
  setMcpServiceEnabled,
  updateMcpService,
} from '../endpoints';
import type { GatewayRoute } from '../gateway-route-types';

export const adminRoutes: GatewayRoute[] = [
  { method: 'GET', pattern: /^\/admin\/mcp\/services$/, handler: listMcpServices },
  { method: 'POST', pattern: /^\/admin\/mcp\/services$/, handler: createMcpService },
  {
    method: 'PUT',
    pattern: /^\/admin\/mcp\/services\/([^/]+)$/,
    handler: updateMcpService,
    paramNames: ['service_id'],
  },
  {
    method: 'DELETE',
    pattern: /^\/admin\/mcp\/services\/([^/]+)$/,
    handler: deleteMcpService,
    paramNames: ['service_id'],
  },
  {
    method: 'POST',
    pattern: /^\/admin\/mcp\/services\/([^/]+)\/enabled$/,
    handler: setMcpServiceEnabled,
    paramNames: ['service_id'],
  },
  {
    method: 'POST',
    pattern: /^\/admin\/mcp\/services\/([^/]+)\/probe$/,
    handler: probeMcpServiceHealth,
    paramNames: ['service_id'],
  },
];
