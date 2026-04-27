import { describe, it, expect } from 'vitest';
import { adminRoutes } from '../../../mcp/routes/admin.js';
import type { GatewayRoute } from '../../../mcp/gateway-route-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the first route whose pattern matches `path`, or undefined. */
function findRoute(
  method: string,
  path: string,
): GatewayRoute | undefined {
  return adminRoutes.find(
    (r) => r.method === method && r.pattern.test(path),
  );
}

/**
 * Execute a route's regex against `path` and return captured groups as a
 * record keyed by the route's `paramNames`.
 */
function extractParams(
  route: GatewayRoute,
  path: string,
): Record<string, string> {
  const match = path.match(route.pattern);
  if (!match) return {};
  const names = route.paramNames ?? [];
  const params: Record<string, string> = {};
  names.forEach((name, i) => {
    params[name] = match[i + 1];
  });
  return params;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adminRoutes', () => {
  // ---- 1. Route count -----------------------------------------------------

  it('should have 6 route entries', () => {
    expect(adminRoutes).toHaveLength(6);
  });

  // ---- 2. Each route has correct shape ------------------------------------

  it('each route has a valid method, pattern, and handler', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE'];

    for (const route of adminRoutes) {
      expect(validMethods).toContain(route.method);
      expect(route.pattern).toBeInstanceOf(RegExp);
      expect(typeof route.handler).toBe('function');
    }
  });

  // ---- 3. Positive pattern matching --------------------------------------

  it('GET /admin/mcp/services matches listMcpServices route', () => {
    const route = findRoute('GET', '/admin/mcp/services');
    expect(route).toBeDefined();
    expect(route!.method).toBe('GET');
    expect(typeof route!.handler).toBe('function');
  });

  it('POST /admin/mcp/services matches createMcpService route', () => {
    const route = findRoute('POST', '/admin/mcp/services');
    expect(route).toBeDefined();
    expect(route!.method).toBe('POST');
    expect(typeof route!.handler).toBe('function');
  });

  it('PUT /admin/mcp/services/my-service-id matches and extracts service_id', () => {
    const route = findRoute('PUT', '/admin/mcp/services/my-service-id');
    expect(route).toBeDefined();
    const params = extractParams(route!, '/admin/mcp/services/my-service-id');
    expect(params.service_id).toBe('my-service-id');
  });

  it('DELETE /admin/mcp/services/test-svc matches and extracts service_id', () => {
    const route = findRoute('DELETE', '/admin/mcp/services/test-svc');
    expect(route).toBeDefined();
    const params = extractParams(route!, '/admin/mcp/services/test-svc');
    expect(params.service_id).toBe('test-svc');
  });

  it('POST /admin/mcp/services/abc/enabled matches and extracts service_id', () => {
    const route = findRoute('POST', '/admin/mcp/services/abc/enabled');
    expect(route).toBeDefined();
    const params = extractParams(route!, '/admin/mcp/services/abc/enabled');
    expect(params.service_id).toBe('abc');
  });

  it('POST /admin/mcp/services/xyz/probe matches and extracts service_id', () => {
    const route = findRoute('POST', '/admin/mcp/services/xyz/probe');
    expect(route).toBeDefined();
    const params = extractParams(route!, '/admin/mcp/services/xyz/probe');
    expect(params.service_id).toBe('xyz');
  });

  // ---- 4. Negative pattern matching ---------------------------------------

  it('GET /admin/mcp/services/abc does NOT match any route', () => {
    // No GET route with a path parameter is defined
    const route = findRoute('GET', '/admin/mcp/services/abc');
    expect(route).toBeUndefined();
  });

  it('PATCH /admin/mcp/services does NOT match any route', () => {
    const route = findRoute('PATCH', '/admin/mcp/services');
    expect(route).toBeUndefined();
  });

  it('PUT /admin/mcp/services does NOT match (missing service_id)', () => {
    // PUT requires a trailing service_id segment
    const route = findRoute('PUT', '/admin/mcp/services');
    expect(route).toBeUndefined();
  });

  // ---- 5. Param extraction ------------------------------------------------

  it('parametrized routes declare paramNames as ["service_id"]', () => {
    const parametrized = adminRoutes.filter((r) => r.paramNames);
    // Routes with params: PUT, DELETE, POST enabled, POST probe = 4
    expect(parametrized).toHaveLength(4);

    for (const route of parametrized) {
      expect(route.paramNames).toEqual(['service_id']);
    }
  });

  it('non-parametrized routes have no paramNames', () => {
    const plain = adminRoutes.filter((r) => !r.paramNames);
    // GET list + POST create = 2
    expect(plain).toHaveLength(2);

    for (const route of plain) {
      expect(route.paramNames).toBeUndefined();
    }
  });

  // ---- 6. Handler import verification -------------------------------------

  it('all handlers are distinct functions', () => {
    const handlers = adminRoutes.map((r) => r.handler);

    // Every handler is a function
    for (const h of handlers) {
      expect(typeof h).toBe('function');
    }

    // All handlers are distinct references
    const unique = new Set(handlers);
    expect(unique.size).toBe(handlers.length);
  });
});
