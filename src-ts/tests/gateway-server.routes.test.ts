import { describe, expect, it } from 'vitest';

import { gatewayRoutes, matchGatewayRoute } from '../mcp/routes';

describe('gateway route registry', () => {
  it('assembles the public endpoint families behind reusable route modules', () => {
    const routePatterns = gatewayRoutes.map((route) => `${route.method}:${route.pattern.source}`);

    expect(routePatterns).toEqual(
      expect.arrayContaining([
        'GET:^\\/health$',
        'POST:^\\/chat$',
        'POST:^\\/workflow\\/execute$',
        'POST:^\\/ui-bridge\\/workflow\\/route$',
        'POST:^\\/writing-helper\\/process$',
        'DELETE:^\\/admin\\/mcp\\/services\\/([^/]+)$',
      ]),
    );
  });

  it('maps admin service ids with the param name expected by MCP admin endpoints', () => {
    const match = matchGatewayRoute('PUT', '/admin/mcp/services/shadow-admin');

    expect(match).not.toBeNull();
    expect(match?.params).toEqual({ service_id: 'shadow-admin' });
  });
});
