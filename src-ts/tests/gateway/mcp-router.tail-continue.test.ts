import { describe, expect, it, vi } from 'vitest';

import { MCPRequestRouter } from '../../gateway/mcp-router.js';

describe('gateway/mcp-router tail continue coverage', () => {
  it('skips providers that do not declare the requested capability', async () => {
    const router = new MCPRequestRouter();

    router.registerProvider({
      name: 'resources-only',
      capabilities: ['resources/read'],
      handler: vi.fn(async () => ({ ok: true })),
      priority: 50,
      healthStatus: 'healthy',
    });
    router.registerProvider({
      name: 'tools-provider',
      capabilities: ['tools/call'],
      handler: vi.fn(async () => ({ ok: true })),
      priority: 10,
      healthStatus: 'healthy',
    });

    const result = await router.route({ method: 'tools/call', params: {} });

    expect(result.provider).toBe('tools-provider');
    expect(result.fallbackProviders).toEqual([]);
  });
});
