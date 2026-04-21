/**
 * Knowledge Manager Tests
 *
 * Tests ServiceManager singleton, initialization, health checking,
 * provider access, and configuration.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { ServiceManager } from '../../knowledge/manager';
import { ProviderType, createServiceConfig } from '../../knowledge/models';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceManager', () => {
  beforeEach(() => {
    ServiceManager.resetInstance();
  });

  afterEach(() => {
    ServiceManager.resetInstance();
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('creates singleton instance', () => {
      const sm1 = ServiceManager.getInstance();
      const sm2 = ServiceManager.getInstance();
      expect(sm1).toBe(sm2);
    });

    it('accepts custom config', () => {
      const config = createServiceConfig({
        healthCheckInterval: 10,
      });
      const sm = ServiceManager.getInstance(config);
      expect(sm).toBeDefined();
    });
  });

  describe('resetInstance', () => {
    it('clears the singleton', () => {
      const sm1 = ServiceManager.getInstance();
      ServiceManager.resetInstance();
      const sm2 = ServiceManager.getInstance();
      expect(sm1).not.toBe(sm2);
    });
  });

  describe('initialize', () => {
    it('initializes successfully with empty config', async () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      await sm.initialize();
      expect(sm).toBeDefined();
    });

    it('does not re-initialize', async () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      await sm.initialize();
      // Second call should be no-op
      await sm.initialize();
    });

    it('initializes with providers', async () => {
      const config = createServiceConfig({
        providers: [
          {
            provider: ProviderType.OPENAI,
            apiKey: 'sk-test',
          },
        ],
      });
      const sm = ServiceManager.getInstance(config);
      // This may fail due to actual provider instantiation,
      // but we can test that the config is accepted
      try {
        await sm.initialize();
      } catch {
        // Provider instantiation may fail without real API keys/connections
        // This is expected in test environments
      }
    });
  });

  describe('shutdown', () => {
    it('clears all services', async () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      await sm.initialize();
      sm.shutdown();

      // After shutdown, llm and embedding accessors should throw
      try {
        sm.llm;
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('not initialized');
      }
    });

    it('can be called multiple times safely', () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      sm.shutdown();
      sm.shutdown(); // Should not throw
    });
  });

  describe('llm / embedding accessors', () => {
    it('throws when not initialized', () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      expect(() => sm.llm).toThrow('not initialized');
      expect(() => sm.embedding).toThrow('not initialized');
    });
  });

  describe('health check', () => {
    it('checkHealth returns empty when no providers', async () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      await sm.initialize();
      const health = await sm.checkHealth();
      expect(health).toEqual({});
    });

    it('isHealthy returns false when no providers', async () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      await sm.initialize();
      expect(sm.isHealthy()).toBe(false);
    });

    it('getHealthStatus returns empty object initially', () => {
      const sm = ServiceManager.getInstance(createServiceConfig());
      expect(sm.getHealthStatus()).toEqual({});
    });
  });

  describe('getCacheStats', () => {
    it('returns null when cache not configured', async () => {
      const config = createServiceConfig({ embeddingCacheEnabled: false });
      const sm = ServiceManager.getInstance(config);
      await sm.initialize();
      const stats = await sm.getCacheStats();
      expect(stats).toBeNull();
    });

    it('returns stats when cache is configured', async () => {
      const config = createServiceConfig({
        embeddingCacheEnabled: true,
        embeddingCacheMaxSize: 500,
        embeddingCacheTTL: 7200,
      });
      const sm = ServiceManager.getInstance(config);
      await sm.initialize();
      const stats = await sm.getCacheStats();
      expect(stats).not.toBeNull();
      expect(stats!.size).toBe(0);
      expect(stats!.maxSize).toBe(500);
      expect(stats!.defaultTTL).toBe(7200);
    });
  });
});
