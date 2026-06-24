import { describe, expect, it } from 'vitest';

import { m10Routes } from '../../../mcp/routes/m10';
import type { GatewayRoute } from '../../../mcp/gateway-route-types';

function findRoute(method: string, path: string): GatewayRoute | undefined {
  return m10Routes.find((r) => r.method === method && r.pattern.test(path));
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

describe('m10Routes', () => {
  it('should have 6 route entries', () => {
    expect(m10Routes).toHaveLength(6);
  });

  it('each route has a valid method, pattern, and handler', () => {
    const validMethods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    for (const route of m10Routes) {
      expect(validMethods.has(route.method)).toBe(true);
      expect(route.pattern).toBeInstanceOf(RegExp);
      expect(typeof route.handler).toBe('function');
    }
  });

  describe('agent endpoints', () => {
    it('has POST /agent/revise-multi-pass', () => {
      const route = findRoute('POST', '/agent/revise-multi-pass');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });
  });

  describe('style endpoints', () => {
    const endpoints = [
      { method: 'POST', path: '/style/extract' },
      { method: 'GET', path: '/style/profile/project-123' },
      { method: 'POST', path: '/style/apply' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }

    it('extracts projectId from GET /style/profile/:projectId', () => {
      const route = findRoute('GET', '/style/profile/project-123');
      expect(route).toBeDefined();
      expect(route!.paramNames).toEqual(['projectId']);
      const params = extractParams(route!, '/style/profile/project-123');
      expect(params.projectId).toBe('project-123');
    });

    it('does NOT match GET /style/profile without projectId', () => {
      expect(findRoute('GET', '/style/profile')).toBeUndefined();
    });
  });

  describe('consistency endpoints', () => {
    it('has POST /consistency/cross-chapter', () => {
      const route = findRoute('POST', '/consistency/cross-chapter');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });
  });

  describe('suggestions endpoints', () => {
    it('has POST /suggestions/context-aware', () => {
      const route = findRoute('POST', '/suggestions/context-aware');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });
  });

  describe('negative pattern matching', () => {
    it('GET /style/extract does NOT match any route', () => {
      expect(findRoute('GET', '/style/extract')).toBeUndefined();
    });

    it('POST /style/profile/:projectId does NOT match any route', () => {
      expect(findRoute('POST', '/style/profile/project-123')).toBeUndefined();
    });

    it('PATCH /agent/revise-multi-pass does NOT match any route', () => {
      expect(findRoute('PATCH', '/agent/revise-multi-pass')).toBeUndefined();
    });
  });

  describe('param extraction', () => {
    it('only the style/profile route declares paramNames', () => {
      const parametrized = m10Routes.filter((r) => r.paramNames);
      expect(parametrized).toHaveLength(1);
      expect(parametrized[0].paramNames).toEqual(['projectId']);
    });
  });

  describe('handler import verification', () => {
    it('all handlers are distinct functions', () => {
      const handlers = m10Routes.map((r) => r.handler);
      for (const h of handlers) {
        expect(typeof h).toBe('function');
      }
      expect(new Set(handlers).size).toBe(handlers.length);
    });
  });
});
