import type { GatewayRoute, GatewayRouteMatch } from '../gateway-route-types';
import { adminRoutes } from './admin';
import { agentRoutes } from './agents';
import { contentRoutes } from './content';
import { m10Routes } from './m10';
import { m11Routes } from './m11';
import { platformRoutes } from './platform';
import { workflowRoutes } from './workflow';

export function createGatewayRoutes(): GatewayRoute[] {
  return [
    ...platformRoutes,
    ...contentRoutes,
    ...agentRoutes,
    ...workflowRoutes,
    ...adminRoutes,
    ...m10Routes,
    ...m11Routes,
  ];
}

export const gatewayRoutes = createGatewayRoutes();

function buildRouteParams(route: GatewayRoute, match: RegExpMatchArray): Record<string, string> {
  const params: Record<string, string> = {};
  for (let i = 0; i < (route.paramNames?.length ?? 0); i += 1) {
    const paramName = route.paramNames?.[i];
    if (!paramName) continue;
    params[paramName] = match[i + 1] ?? '';
  }
  return params;
}

export function matchGatewayRoute(
  method: string,
  path: string,
  routes: readonly GatewayRoute[] = gatewayRoutes,
): GatewayRouteMatch | null {
  const normalizedMethod = method.toUpperCase();

  for (const route of routes) {
    if (route.method !== normalizedMethod) {
      continue;
    }

    const match = path.match(route.pattern);
    if (match) {
      return {
        route,
        params: buildRouteParams(route, match),
      };
    }
  }

  return null;
}
