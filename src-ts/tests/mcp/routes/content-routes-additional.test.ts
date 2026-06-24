import { describe, expect, it } from 'vitest';

import { contentRoutes } from '../../../mcp/routes/content';
import type { GatewayRoute } from '../../../mcp/gateway-route-types';

function findRoute(method: string, path: string): GatewayRoute | undefined {
  return contentRoutes.find((r) => r.method === method && r.pattern.test(path));
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

describe('contentRoutes (additional groups)', () => {
  it('should have 66 routes total', () => {
    expect(contentRoutes).toHaveLength(66);
  });

  it('every route has a valid method', () => {
    const validMethods = new Set(['GET', 'POST', 'PUT', 'DELETE']);
    for (const route of contentRoutes) {
      expect(validMethods.has(route.method)).toBe(true);
    }
  });

  it('every route handler is a function', () => {
    for (const route of contentRoutes) {
      expect(typeof route.handler).toBe('function');
    }
  });

  it('every route has a RegExp pattern', () => {
    for (const route of contentRoutes) {
      expect(route.pattern).toBeInstanceOf(RegExp);
    }
  });

  describe('writing-craft routes', () => {
    const endpoints = [
      { method: 'POST', path: '/writing-craft/analyze' },
      { method: 'POST', path: '/writing-craft/llm-analyze' },
      { method: 'POST', path: '/writing-craft/emotional-arc' },
      { method: 'POST', path: '/writing-craft/voice-consistency' },
      { method: 'POST', path: '/writing-craft/reader-immersion' },
      { method: 'POST', path: '/writing-craft/pacing-navigator' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('plugin routes', () => {
    const endpoints = [
      { method: 'GET', path: '/plugins/list' },
      { method: 'POST', path: '/plugins/execute' },
      { method: 'POST', path: '/plugins/register' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('sync routes', () => {
    const endpoints = [
      { method: 'GET', path: '/sync/status' },
      { method: 'POST', path: '/sync/push' },
      { method: 'POST', path: '/sync/pull' },
      { method: 'POST', path: '/sync/full' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('foreshadow routes', () => {
    const endpoints = [
      { method: 'POST', path: '/foreshadow/plant' },
      { method: 'GET', path: '/foreshadow/stats' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('character routes', () => {
    const endpoints = [
      { method: 'POST', path: '/character/profile' },
      { method: 'POST', path: '/character/depth' },
      { method: 'POST', path: '/character/relationships' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('analysis routes', () => {
    const endpoints = [
      { method: 'POST', path: '/analysis/patterns' },
      { method: 'POST', path: '/analysis/sessions' },
      { method: 'POST', path: '/analysis/narrative-visualization' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('learning routes', () => {
    const endpoints = [
      { method: 'POST', path: '/learning/import' },
      { method: 'POST', path: '/learning/style-feedback' },
      { method: 'POST', path: '/learning/style-drift' },
      { method: 'GET', path: '/learning/rules' },
      { method: 'POST', path: '/learning/reading-session' },
      { method: 'POST', path: '/learning/reading-extract' },
      { method: 'GET', path: '/learning/status' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('story-bible routes', () => {
    it('has POST /story-bible/entities/list', () => {
      const route = findRoute('POST', '/story-bible/entities/list');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });

    it('has GET /story-bible/entity/:entityId', () => {
      const route = findRoute('GET', '/story-bible/entity/abc-123');
      expect(route).toBeDefined();
      expect(route!.method).toBe('GET');
      expect(route!.paramNames).toEqual(['entityId']);
    });

    it('extracts entityId from GET /story-bible/entity/:entityId', () => {
      const route = findRoute('GET', '/story-bible/entity/abc-123');
      expect(route).toBeDefined();
      const params = extractParams(route!, '/story-bible/entity/abc-123');
      expect(params.entityId).toBe('abc-123');
    });

    it('has POST /story-bible/entities', () => {
      const route = findRoute('POST', '/story-bible/entities');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });

    it('has PUT /story-bible/entity/:entityId', () => {
      const route = findRoute('PUT', '/story-bible/entity/abc-123');
      expect(route).toBeDefined();
      expect(route!.method).toBe('PUT');
      expect(route!.paramNames).toEqual(['entityId']);
    });

    it('has DELETE /story-bible/entity/:entityId', () => {
      const route = findRoute('DELETE', '/story-bible/entity/abc-123');
      expect(route).toBeDefined();
      expect(route!.method).toBe('DELETE');
      expect(route!.paramNames).toEqual(['entityId']);
    });

    it('has POST /story-bible/extract', () => {
      const route = findRoute('POST', '/story-bible/extract');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });

    it('has POST /story-bible/completeness', () => {
      const route = findRoute('POST', '/story-bible/completeness');
      expect(route).toBeDefined();
      expect(route!.method).toBe('POST');
    });

    it('does NOT match /story-bible/entity without entityId', () => {
      expect(findRoute('GET', '/story-bible/entity')).toBeUndefined();
    });
  });

  describe('qc routes', () => {
    const endpoints = [
      { method: 'POST', path: '/qc/validate' },
      { method: 'POST', path: '/qc/creativity-config' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('cowriting routes', () => {
    const endpoints = [
      { method: 'POST', path: '/cowriting/generate/auto' },
      { method: 'POST', path: '/cowriting/generate/guided' },
      { method: 'GET', path: '/cowriting/modes' },
      { method: 'GET', path: '/cowriting/creativity-presets' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('reader routes', () => {
    const endpoints = [
      { method: 'POST', path: '/reader/analyze' },
      { method: 'GET', path: '/reader/personas' },
      { method: 'POST', path: '/reader/personas/custom' },
      { method: 'POST', path: '/reader/overlay' },
      { method: 'POST', path: '/reader/ai-flavor' },
      { method: 'POST', path: '/reader/feedback' },
      { method: 'POST', path: '/reader/compare' },
      { method: 'POST', path: '/reader/de-ai' },
    ];

    for (const { method, path } of endpoints) {
      it(`has ${method} ${path}`, () => {
        const route = findRoute(method, path);
        expect(route).toBeDefined();
        expect(route!.method).toBe(method);
      });
    }
  });

  describe('pattern specificity', () => {
    it('/cowriting/generate/auto does NOT match /cowriting/generate/autoX', () => {
      const auto = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.source === '^\\/cowriting\\/generate\\/auto$',
      );
      expect(auto).toBeDefined();
      expect(auto!.pattern.test('/cowriting/generate/autoX')).toBe(false);
    });

    it('/reader/personas/custom does NOT match /reader/personas', () => {
      const custom = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.source === '^\\/reader\\/personas\\/custom$',
      );
      expect(custom).toBeDefined();
      expect(custom!.pattern.test('/reader/personas')).toBe(false);
    });
  });

  describe('handler import verification', () => {
    it('all content route handlers are functions', () => {
      for (const route of contentRoutes) {
        expect(typeof route.handler).toBe('function');
      }
    });
  });
});
