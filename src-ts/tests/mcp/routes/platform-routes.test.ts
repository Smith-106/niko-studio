import { describe, expect, it } from 'vitest';

import { platformRoutes } from '../../../mcp/routes/platform';

describe('platformRoutes', () => {
  it('should have 11 routes', () => {
    expect(platformRoutes).toHaveLength(11);
  });

  it('every route has a valid method', () => {
    const validMethods = new Set(['GET', 'PUT', 'POST', 'DELETE', 'PATCH']);
    for (const route of platformRoutes) {
      expect(validMethods.has(route.method)).toBe(true);
    }
  });

  it('every route has a RegExp pattern', () => {
    for (const route of platformRoutes) {
      expect(route.pattern).toBeInstanceOf(RegExp);
    }
  });

  it('every route handler is a function', () => {
    for (const route of platformRoutes) {
      expect(typeof route.handler).toBe('function');
    }
  });

  describe('pattern matching', () => {
    const matchCases: [string, string, boolean][] = [
      ['GET', '/health', true],
      ['GET', '/health/', false],
      ['GET', '/health/extra', false],
      ['GET', '/metrics', true],
      ['GET', '/tools', true],
      ['GET', '/models', true],
      ['GET', '/config', true],
      ['PUT', '/config', true],
      ['POST', '/config', true],
      ['GET', '/config/secrets', true],
      ['PUT', '/config/secrets', true],
      ['POST', '/config/secrets', true],
      ['POST', '/config/reload', true],
      ['GET', '/config/reload', false],
      ['GET', '/configx', false],
      ['GET', '/configs', false],
      ['POST', '/health', false],
      ['DELETE', '/config', false],
    ];

    for (const [method, path, shouldMatch] of matchCases) {
      it(`${shouldMatch ? 'matches' : 'does NOT match'} ${method} ${path}`, () => {
        const found = platformRoutes.find((r) => {
          if (r.method !== method) return false;
          return r.pattern.test(path);
        });
        if (shouldMatch) {
          expect(found).toBeDefined();
        } else {
          expect(found).toBeUndefined();
        }
      });
    }
  });

  describe('method distribution', () => {
    it('has 6 GET routes', () => {
      expect(platformRoutes.filter((r) => r.method === 'GET')).toHaveLength(6);
    });

    it('has 1 PUT route for /config', () => {
      const putConfig = platformRoutes.filter(
        (r) => r.method === 'PUT' && r.pattern.test('/config'),
      );
      expect(putConfig).toHaveLength(1);
    });

    it('has 1 POST route for /config', () => {
      const postConfig = platformRoutes.filter(
        (r) => r.method === 'POST' && r.pattern.test('/config'),
      );
      expect(postConfig).toHaveLength(1);
    });

    it('has 1 GET route for /config/secrets', () => {
      const getSecrets = platformRoutes.filter(
        (r) => r.method === 'GET' && r.pattern.test('/config/secrets'),
      );
      expect(getSecrets).toHaveLength(1);
    });

    it('has 1 PUT route for /config/secrets', () => {
      const putSecrets = platformRoutes.filter(
        (r) => r.method === 'PUT' && r.pattern.test('/config/secrets'),
      );
      expect(putSecrets).toHaveLength(1);
    });

    it('has 1 POST route for /config/secrets', () => {
      const postSecrets = platformRoutes.filter(
        (r) => r.method === 'POST' && r.pattern.test('/config/secrets'),
      );
      expect(postSecrets).toHaveLength(1);
    });

    it('has 1 POST route for /config/reload', () => {
      const postReload = platformRoutes.filter(
        (r) => r.method === 'POST' && r.pattern.test('/config/reload'),
      );
      expect(postReload).toHaveLength(1);
    });
  });
});
