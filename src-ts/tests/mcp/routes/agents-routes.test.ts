import { describe, expect, it } from 'vitest';

import { agentRoutes } from '../../../mcp/routes/agents';
import type { GatewayRoute } from '../../../mcp/gateway-route-types';

function findRoute(method: string, path: string): GatewayRoute | undefined {
  return agentRoutes.find((r) => r.method === method && r.pattern.test(path));
}

function extractParams(route: GatewayRoute, path: string): Record<string, string> {
  const match = path.match(route.pattern);
  if (!match) return {};
  const names = route.paramNames ?? [];
  const params: Record<string, string> = {};
  names.forEach((name, i) => {
    params[name] = match[i + 1];
  });
  return params;
}

describe('agentRoutes', () => {
  it('should have 15 route entries', () => {
    expect(agentRoutes).toHaveLength(15);
  });

  it('each route has a valid method, pattern, and handler', () => {
    const validMethods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    for (const route of agentRoutes) {
      expect(validMethods.has(route.method)).toBe(true);
      expect(route.pattern).toBeInstanceOf(RegExp);
      expect(typeof route.handler).toBe('function');
    }
  });

  describe('agent endpoints', () => {
    const endpoints = [
      { method: 'POST', path: '/agent/route' },
      { method: 'POST', path: '/agent/write' },
      { method: 'POST', path: '/agent/revise' },
      { method: 'POST', path: '/agent/context' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
        expect(typeof route!.handler).toBe('function');
      });
    }
  });

  describe('critic endpoints', () => {
    const endpoints = [
      { method: 'POST', path: '/critic/evaluate' },
      { method: 'POST', path: '/critic/suggestions' },
      { method: 'POST', path: '/critic/consistency' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('consistency endpoints', () => {
    it('has POST /consistency/check', () => {
      const route = findRoute('POST', '/consistency/check');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });
  });

  describe('skills endpoints', () => {
    const endpoints = [
      { method: 'GET', path: '/skills/list' },
      { method: 'POST', path: '/skills/load' },
      { method: 'POST', path: '/skills/match' },
      { method: 'POST', path: '/skills/chain' },
      { method: 'POST', path: '/skills/create' },
      { method: 'POST', path: '/skills/save' },
      { method: 'POST', path: '/skills/delete' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('negative pattern matching', () => {
    it('GET /agent/route does NOT match any route', () => {
      expect(findRoute('GET', '/agent/route')).toBeUndefined();
    });

    it('PATCH /critic/evaluate does NOT match any route', () => {
      expect(findRoute('PATCH', '/critic/evaluate')).toBeUndefined();
    });

    it('POST /skills/listX does NOT match /skills/list', () => {
      expect(findRoute('POST', '/skills/listX')).toBeUndefined();
    });
  });

  describe('param extraction', () => {
    it('has no parametrized routes', () => {
      const parametrized = agentRoutes.filter((r) => r.paramNames);
      expect(parametrized).toHaveLength(0);
    });

    it('extractParams returns empty object for non-parametrized routes', () => {
      const route = findRoute('GET', '/skills/list')!;
      expect(extractParams(route, '/skills/list')).toEqual({});
    });
  });

  describe('handler import verification', () => {
    it('all handlers are distinct functions', () => {
      const handlers = agentRoutes.map((r) => r.handler);
      for (const h of handlers) {
        expect(typeof h).toBe('function');
      }
      expect(new Set(handlers).size).toBe(handlers.length);
    });
  });
});
