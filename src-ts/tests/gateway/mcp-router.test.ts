import { describe, expect, it, vi } from 'vitest';

import type { MCPProviderSpec } from '../../gateway/mcp-router.js';
import { MCPRequestRouter } from '../../gateway/mcp-router.js';

function createProvider(overrides: Partial<MCPProviderSpec> & Pick<MCPProviderSpec, 'name'>): MCPProviderSpec {
  return {
    name: overrides.name,
    capabilities: overrides.capabilities ?? ['tools/call'],
    handler: overrides.handler ?? vi.fn(async () => ({ ok: true })),
    priority: overrides.priority ?? 0,
    healthStatus: overrides.healthStatus ?? 'healthy',
  };
}

describe('MCPRequestRouter', () => {
  it('throws when no capable provider is registered', async () => {
    const router = new MCPRequestRouter();

    await expect(router.route({ method: 'tools/call', params: {} })).rejects.toThrow(
      'No provider registered for method: tools/call',
    );
  });

  it('returns the registered providers', () => {
    const router = new MCPRequestRouter();
    const alpha = createProvider({ name: 'alpha' });
    const beta = createProvider({ name: 'beta', capabilities: ['resources/read'] });

    router.registerProvider(alpha);
    router.registerProvider(beta);

    expect(router.getProviders()).toEqual([alpha, beta]);
  });

  it('prefers healthy providers over degraded ones and preserves fallback order', async () => {
    const router = new MCPRequestRouter();
    const degradedHighPriority = createProvider({
      name: 'degraded-high',
      priority: 20,
      healthStatus: 'degraded',
    });
    const healthyMidPriority = createProvider({
      name: 'healthy-mid',
      priority: 10,
      healthStatus: 'healthy',
    });
    const healthyLowPriority = createProvider({
      name: 'healthy-low',
      priority: 5,
      healthStatus: 'healthy',
    });

    router.registerProvider(degradedHighPriority);
    router.registerProvider(healthyMidPriority);
    router.registerProvider(healthyLowPriority);

    const result = await router.route({ method: 'tools/call', params: {} });

    expect(result.provider).toBe('healthy-mid');
    expect(result.handler).toBe(healthyMidPriority.handler);
    expect(result.fallbackProviders).toEqual(['healthy-low', 'degraded-high']);
  });

  it('skips unavailable providers and providers blocked by an open circuit', async () => {
    const circuitBreakerRegistry = {
      allow: vi.fn((providerName: string) => providerName !== 'blocked'),
    };
    const router = new MCPRequestRouter(circuitBreakerRegistry as never);

    router.registerProvider(createProvider({
      name: 'unavailable',
      priority: 30,
      healthStatus: 'unavailable',
    }));
    router.registerProvider(createProvider({
      name: 'blocked',
      priority: 20,
      healthStatus: 'healthy',
    }));
    const available = createProvider({
      name: 'available',
      priority: 10,
      healthStatus: 'healthy',
    });
    router.registerProvider(available);

    const result = await router.route({ method: 'tools/call', params: {} });

    expect(result.provider).toBe('available');
    expect(result.fallbackProviders).toEqual([]);
    expect(circuitBreakerRegistry.allow).toHaveBeenCalledWith('blocked');
    expect(circuitBreakerRegistry.allow).toHaveBeenCalledWith('available');
  });

  it('skips providers that do not declare the requested capability', async () => {
    const router = new MCPRequestRouter();
    router.registerProvider(createProvider({
      name: 'resources-only',
      capabilities: ['resources/read'],
      priority: 50,
    }));
    const toolsProvider = createProvider({
      name: 'tools-provider',
      capabilities: ['tools/call'],
      priority: 10,
    });
    router.registerProvider(toolsProvider);

    const result = await router.route({ method: 'tools/call', params: {} });

    expect(result.provider).toBe('tools-provider');
    expect(result.handler).toBe(toolsProvider.handler);
    expect(result.fallbackProviders).toEqual([]);
  });

  it('throws when candidates exist but none are healthy or degraded', async () => {
    const router = new MCPRequestRouter();
    router.registerProvider(createProvider({
      name: 'unknown-health',
      healthStatus: 'healthy' as MCPProviderSpec['healthStatus'],
    }));
    (router.getProviders()[0] as unknown as { healthStatus: string }).healthStatus = 'unknown';

    await expect(router.route({ method: 'tools/call', params: {} })).rejects.toThrow(
      'No healthy or degraded providers available',
    );
  });
});
