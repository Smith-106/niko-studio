import { describe, expect, it, vi } from 'vitest';

import {
  MCPAllProvidersFailedError,
  ProviderFallbackChain,
  type MCPRequest,
  type MCPRouteResult,
} from '../../gateway/provider-fallback.js';

function makeRouteResult(overrides?: Partial<MCPRouteResult>): MCPRouteResult {
  return {
    provider: 'primary',
    handler: vi.fn(),
    fallbackProviders: ['secondary', 'tertiary'],
    ...overrides,
  };
}

describe('gateway/provider-fallback', () => {
  const request: MCPRequest = {
    method: 'tools/call',
    params: { query: 'atlas' },
  };

  it('returns the primary handler result and records success', async () => {
    const registry = {
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    };
    const handler = vi.fn().mockResolvedValue({ provider: 'primary' });
    const chain = new ProviderFallbackChain(registry as never);
    const routeResult = makeRouteResult({ handler });

    await expect(chain.execute(request, routeResult)).resolves.toEqual({ provider: 'primary' });
    expect(handler).toHaveBeenCalledWith(request);
    expect(registry.recordSuccess).toHaveBeenCalledWith('primary');
    expect(registry.recordFailure).not.toHaveBeenCalled();
  });

  it('falls back through registered handlers and records failures along the way', async () => {
    const registry = {
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    };
    const primary = vi.fn().mockRejectedValue(new Error('primary boom'));
    const secondary = vi.fn().mockResolvedValue({ provider: 'secondary' });
    const chain = new ProviderFallbackChain(registry as never);
    chain.registerFallbackHandler('secondary', secondary);

    const routeResult = makeRouteResult({ handler: primary });
    const result = await chain.execute(request, routeResult);

    expect(result).toEqual({ provider: 'secondary' });
    expect(registry.recordFailure).toHaveBeenCalledWith('primary');
    expect(registry.recordSuccess).toHaveBeenCalledWith('secondary');
  });

  it('skips unresolved fallback handlers and throws a typed aggregate error when all providers fail', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('primary boom'));
    const secondary = vi.fn().mockRejectedValue(new Error('secondary boom'));
    const chain = new ProviderFallbackChain();
    chain.registerFallbackHandler('secondary', secondary);

    const routeResult = makeRouteResult({
      handler: primary,
      fallbackProviders: ['missing', 'secondary'],
    });

    await expect(chain.execute(request, routeResult)).rejects.toThrow(MCPAllProvidersFailedError);

    try {
      await chain.execute(request, routeResult);
    } catch (error) {
      expect(error).toBeInstanceOf(MCPAllProvidersFailedError);
      expect((error as MCPAllProvidersFailedError).failures).toHaveLength(2);
      expect((error as Error).message).toContain('primary');
      expect((error as Error).message).toContain('secondary');
    }
  });

  it('does not touch circuit-breaker hooks when none are provided', async () => {
    const secondary = vi.fn().mockResolvedValue({ provider: 'secondary' });
    const chain = new ProviderFallbackChain();
    chain.registerFallbackHandler('secondary', secondary);

    const routeResult = makeRouteResult({
      handler: vi.fn().mockRejectedValue(new Error('primary boom')),
      fallbackProviders: ['secondary'],
    });

    await expect(chain.execute(request, routeResult)).resolves.toEqual({ provider: 'secondary' });
  });
});
