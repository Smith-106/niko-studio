import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  resolveGatewayServerStartOptions,
} from '../../mcp/gateway-bootstrap';

// Mock the container initialization so we can test pure config logic
vi.mock('../../composition-root/gateway-control-plane', () => ({
  initializeGatewayControlPlane: () => ({ container: { id: 'test-container' } }),
  prewarmGatewayControlPlane: vi.fn(),
}));

vi.mock('../../mcp/config', () => ({
  resolveGatewayHostPort: () => ({ host: '0.0.0.0', port: 8000 }),
}));

vi.mock('../../mcp/routes/index', () => ({
  gatewayRoutes: [],
}));

describe('gateway-bootstrap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveGatewayServerStartOptions', () => {
    it('falls back to defaults when no options are provided', () => {
      const result = resolveGatewayServerStartOptions();
      expect(result.host).toBe('0.0.0.0');
      expect(result.port).toBe(8000);
    });

    it('uses explicit host when a non-empty string is given', () => {
      const result = resolveGatewayServerStartOptions({ host: '127.0.0.1' });
      expect(result.host).toBe('127.0.0.1');
      expect(result.port).toBe(8000);
    });

    it('uses explicit port when a finite number is given', () => {
      const result = resolveGatewayServerStartOptions({ port: 3000 });
      expect(result.host).toBe('0.0.0.0');
      expect(result.port).toBe(3000);
    });

    it('ignores whitespace-only host strings and falls back', () => {
      const result = resolveGatewayServerStartOptions({ host: '   ' });
      expect(result.host).toBe('0.0.0.0');
    });

    it('ignores NaN port and falls back', () => {
      const result = resolveGatewayServerStartOptions({ port: NaN });
      expect(result.port).toBe(8000);
    });

    it('ignores Infinity port and falls back', () => {
      const result = resolveGatewayServerStartOptions({ port: Infinity });
      expect(result.port).toBe(8000);
    });

    it('overrides both host and port simultaneously', () => {
      const result = resolveGatewayServerStartOptions({ host: 'localhost', port: 9090 });
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(9090);
    });
  });
});
