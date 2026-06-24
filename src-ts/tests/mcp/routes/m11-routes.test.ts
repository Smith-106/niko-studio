import { describe, expect, it } from 'vitest';

import { m11Routes } from '../../../mcp/routes/m11';
import type { GatewayRoute } from '../../../mcp/gateway-route-types';

function findRoute(method: string, path: string): GatewayRoute | undefined {
  return m11Routes.find((r) => r.method === method && r.pattern.test(path));
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

describe('m11Routes', () => {
  it('should have 2 route entries', () => {
    expect(m11Routes).toHaveLength(2);
  });

  it('each route has a valid method, pattern, and handler', () => {
    const validMethods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    for (const route of m11Routes) {
      expect(validMethods.has(route.method)).toBe(true);
      expect(route.pattern).toBeInstanceOf(RegExp);
      expect(typeof route.handler).toBe('function');
    }
  });

  describe('worldview endpoints', () => {
    it('has POST /worldview/extract', () => {
      const route = findRoute('POST', '/worldview/extract');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });

    it('has GET /worldview/:projectId', () => {
      const route = findRoute('GET', '/worldview/project-123');
      expect(route).toBeDefined();
      expect(route!.method).toBe('GET');
    });

    it('extracts projectId from GET /worldview/:projectId', () => {
      const route = findRoute('GET', '/worldview/project-123');
      expect(route).toBeDefined();
      expect(route!.paramNames).toEqual(['projectId']);
      const params = extractParams(route!, '/worldview/project-123');
      expect(params.projectId).toBe('project-123');
    });
  });

  describe('negative pattern matching', () => {
    it('POST /worldview/:projectId does NOT match any route', () => {
      expect(findRoute('POST', '/worldview/project-123')).toBeUndefined();
    });

    it('GET /worldview does NOT match any route', () => {
      expect(findRoute('GET', '/worldview')).toBeUndefined();
    });
  });

  describe('param extraction', () => {
    it('only the worldview GET route declares paramNames', () => {
      const parametrized = m11Routes.filter((r) => r.paramNames);
      expect(parametrized).toHaveLength(1);
      expect(parametrized[0].paramNames).toEqual(['projectId']);
    });
  });

  describe('handler import verification', () => {
    it('all handlers are distinct functions', () => {
      const handlers = m11Routes.map((r) => r.handler);
      for (const h of handlers) {
        expect(typeof h).toBe('function');
      }
      expect(new Set(handlers).size).toBe(handlers.length);
    });
  });
});
