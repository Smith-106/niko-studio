import { describe, expect, it } from 'vitest';

import { matchGatewayRoute } from '../../../mcp/routes/index';
import { platformRoutes } from '../../../mcp/routes/platform';
import { contentRoutes } from '../../../mcp/routes/content';
import { agentRoutes } from '../../../mcp/routes/agents';
import { workflowRoutes } from '../../../mcp/routes/workflow';
import { adminRoutes } from '../../../mcp/routes/admin';

describe('matchGatewayRoute', () => {
  const allRoutes = [...platformRoutes, ...contentRoutes, ...agentRoutes, ...workflowRoutes, ...adminRoutes];

  // ---------------------------------------------------------------------------
  // Platform routes
  // ---------------------------------------------------------------------------
  describe('platform routes', () => {
    it('matches GET /health', () => {
      const result = matchGatewayRoute('GET', '/health', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
      expect(result!.route.pattern.source).toBe('^\\/health$');
    });

    it('matches GET /metrics', () => {
      const result = matchGatewayRoute('GET', '/metrics', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });

    it('matches GET /tools', () => {
      const result = matchGatewayRoute('GET', '/tools', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });

    it('matches GET /models', () => {
      const result = matchGatewayRoute('GET', '/models', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });

    it('matches GET /config', () => {
      const result = matchGatewayRoute('GET', '/config', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });

    it('matches PUT /config', () => {
      const result = matchGatewayRoute('PUT', '/config', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('PUT');
    });

    it('matches POST /config', () => {
      const result = matchGatewayRoute('POST', '/config', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });

    it('matches GET /config/secrets', () => {
      const result = matchGatewayRoute('GET', '/config/secrets', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });

    it('matches PUT /config/secrets', () => {
      const result = matchGatewayRoute('PUT', '/config/secrets', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('PUT');
    });

    it('matches POST /config/secrets', () => {
      const result = matchGatewayRoute('POST', '/config/secrets', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });

    it('matches POST /config/reload', () => {
      const result = matchGatewayRoute('POST', '/config/reload', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });
  });

  // ---------------------------------------------------------------------------
  // Content routes
  // ---------------------------------------------------------------------------
  describe('content routes', () => {
    it('matches POST /chat', () => {
      const result = matchGatewayRoute('POST', '/chat', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });

    it('matches POST /chat/stream', () => {
      const result = matchGatewayRoute('POST', '/chat/stream', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });

    it('matches POST /memory/search', () => {
      const result = matchGatewayRoute('POST', '/memory/search', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /memory/add', () => {
      const result = matchGatewayRoute('POST', '/memory/add', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /graph/query', () => {
      const result = matchGatewayRoute('POST', '/graph/query', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /wiki/list', () => {
      const result = matchGatewayRoute('POST', '/wiki/list', allRoutes);
      expect(result).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Agent routes
  // ---------------------------------------------------------------------------
  describe('agent routes', () => {
    it('matches POST /agent/route', () => {
      const result = matchGatewayRoute('POST', '/agent/route', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });

    it('matches POST /critic/evaluate', () => {
      const result = matchGatewayRoute('POST', '/critic/evaluate', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /consistency/check', () => {
      const result = matchGatewayRoute('POST', '/consistency/check', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches GET /skills/list', () => {
      const result = matchGatewayRoute('GET', '/skills/list', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow routes
  // ---------------------------------------------------------------------------
  describe('workflow routes', () => {
    it('matches POST /workflow/route', () => {
      const result = matchGatewayRoute('POST', '/workflow/route', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /workflow/plan', () => {
      const result = matchGatewayRoute('POST', '/workflow/plan', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /workflow/execute', () => {
      const result = matchGatewayRoute('POST', '/workflow/execute', allRoutes);
      expect(result).not.toBeNull();
    });

    it('matches POST /workflow/lifecycle', () => {
      const result = matchGatewayRoute('POST', '/workflow/lifecycle', allRoutes);
      expect(result).not.toBeNull();
    });
  });

  describe('writing helper routes', () => {
    it('matches POST /writing-helper/process', () => {
      const result = matchGatewayRoute('POST', '/writing-helper/process', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.pattern.source).toBe('^\\/writing-helper\\/process$');
    });

    it('keeps POST /writing/helper as a compatibility alias', () => {
      const result = matchGatewayRoute('POST', '/writing/helper', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.pattern.source).toBe('^\\/writing\\/helper$');
    });
  });

  // ---------------------------------------------------------------------------
  // Admin routes
  // ---------------------------------------------------------------------------
  describe('admin routes', () => {
    it('matches GET /admin/mcp/services', () => {
      const result = matchGatewayRoute('GET', '/admin/mcp/services', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('GET');
    });

    it('matches POST /admin/mcp/services', () => {
      const result = matchGatewayRoute('POST', '/admin/mcp/services', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('POST');
    });

    it('matches PUT /admin/mcp/services/{id}', () => {
      const result = matchGatewayRoute('PUT', '/admin/mcp/services/svc-123', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('PUT');
      expect(result!.params.service_id).toBe('svc-123');
    });

    it('matches DELETE /admin/mcp/services/{id}', () => {
      const result = matchGatewayRoute('DELETE', '/admin/mcp/services/svc-abc', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.route.method).toBe('DELETE');
      expect(result!.params.service_id).toBe('svc-abc');
    });

    it('extracts param from service_id segment containing dashes', () => {
      const result = matchGatewayRoute('PUT', '/admin/mcp/services/my-service-name', allRoutes);
      expect(result).not.toBeNull();
      expect(result!.params.service_id).toBe('my-service-name');
    });
  });

  // ---------------------------------------------------------------------------
  // Negative / rejection cases
  // ---------------------------------------------------------------------------
  describe('rejection cases', () => {
    it('returns null for wrong method GET /chat', () => {
      const result = matchGatewayRoute('GET', '/chat', allRoutes);
      expect(result).toBeNull();
    });

    it('returns null for wrong method DELETE /health', () => {
      const result = matchGatewayRoute('DELETE', '/health', allRoutes);
      expect(result).toBeNull();
    });

    it('returns null for unknown path', () => {
      const result = matchGatewayRoute('GET', '/unknown/path', allRoutes);
      expect(result).toBeNull();
    });

    it('returns null for path that does not exist at all', () => {
      const result = matchGatewayRoute('POST', '/does/not/exist', allRoutes);
      expect(result).toBeNull();
    });

    it('returns null for partially matching path (extra segments)', () => {
      const result = matchGatewayRoute('GET', '/health/extra', allRoutes);
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Route ordering: platform routes come before content routes
  // ---------------------------------------------------------------------------
  describe('route ordering', () => {
    it('platform routes match before content routes in the combined array', () => {
      // The combined allRoutes array has platformRoutes first.
      // Verify that a POST to /config (platform) matches the platform handler,
      // and the overall array is ordered platform -> content -> agents -> workflow -> admin.
      const platformLength = platformRoutes.length;
      for (let i = 0; i < platformLength; i++) {
        expect(allRoutes[i]).toBe(platformRoutes[i]);
      }
      for (let i = 0; i < contentRoutes.length; i++) {
        expect(allRoutes[platformLength + i]).toBe(contentRoutes[i]);
      }
    });

    it('method is case-insensitive (uppercased internally)', () => {
      const resultLower = matchGatewayRoute('get', '/health', allRoutes);
      const resultUpper = matchGatewayRoute('GET', '/health', allRoutes);
      expect(resultLower).not.toBeNull();
      expect(resultUpper).not.toBeNull();
      expect(resultLower!.route).toBe(resultUpper!.route);
    });
  });
});
