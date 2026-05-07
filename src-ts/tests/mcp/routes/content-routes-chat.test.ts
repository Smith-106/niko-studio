import { describe, expect, it } from 'vitest';

import { contentRoutes } from '../../../mcp/routes/content';

describe('contentRoutes', () => {
  it('should have 26 routes', () => {
    expect(contentRoutes).toHaveLength(26);
  });

  it('every route has a valid method', () => {
    const validMethods = new Set(['GET', 'PUT', 'POST', 'DELETE', 'PATCH']);
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

  describe('chat routes', () => {
    it('has a POST /chat route', () => {
      const chat = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.test('/chat'),
      );
      expect(chat).toBeDefined();
    });

    it('has a POST /chat/stream route', () => {
      const stream = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.test('/chat/stream'),
      );
      expect(stream).toBeDefined();
    });

    it('/chat pattern does NOT match /chat/stream', () => {
      const chat = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.source === '^\\/chat$',
      );
      expect(chat).toBeDefined();
      expect(chat!.pattern.test('/chat/stream')).toBe(false);
    });

    it('/chat/stream pattern matches correctly', () => {
      const stream = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.source === '^\\/chat\\/stream$',
      );
      expect(stream).toBeDefined();
      expect(stream!.pattern.test('/chat/stream')).toBe(true);
    });

    it('/chat/stream pattern does NOT match /chat', () => {
      const stream = contentRoutes.find(
        (r) => r.method === 'POST' && r.pattern.source === '^\\/chat\\/stream$',
      );
      expect(stream).toBeDefined();
      expect(stream!.pattern.test('/chat')).toBe(false);
    });
  });

  describe('memory routes', () => {
    it('has POST /memory/search', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/memory/search'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /memory/add', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/memory/add'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /memory/upload', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/memory/upload'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /memory/temporal', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/memory/temporal'),
      );
      expect(r).toBeDefined();
    });
  });

  describe('graph routes', () => {
    it('has POST /graph/query', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/graph/query'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /graph/character', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/graph/character'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /graph/foreshadows', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/graph/foreshadows'),
      );
      expect(r).toBeDefined();
    });
  });

  describe('wiki routes', () => {
    it('has POST /wiki/promote', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/wiki/promote'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /wiki/list', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/wiki/list'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /wiki/page', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/wiki/page'),
      );
      expect(r).toBeDefined();
    });
  });

  describe('writing routes', () => {
    it('has POST /writing/quality', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/writing/quality'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /writing/helper', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/writing/helper'),
      );
      expect(r).toBeDefined();
    });

    it('has POST /writing/stream', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/writing/stream'),
      );
      expect(r).toBeDefined();
    });
  });

  describe('workspace route', () => {
    it('has POST /workspace/context', () => {
      const r = contentRoutes.find(
        (rt) => rt.method === 'POST' && rt.pattern.test('/workspace/context'),
      );
      expect(r).toBeDefined();
    });
  });

  describe('all routes are POST or GET method', () => {
    it('every content route uses POST or GET method', () => {
      for (const route of contentRoutes) {
        expect(['POST', 'GET']).toContain(route.method);
      }
    });
  });
});
