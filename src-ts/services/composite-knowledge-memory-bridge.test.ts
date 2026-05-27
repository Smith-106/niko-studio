import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositeKnowledgeMemoryBridge, BridgeHealth, BridgeMetrics } from './composite-knowledge-memory-bridge.js';

function createMockAdapter(overrides?: Record<string, unknown>) {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue({ id: 'primary-1' }),
    store: vi.fn().mockResolvedValue(undefined),
    addToLibrary: vi.fn().mockResolvedValue([{ id: 'lib-1', name: 'doc.pdf', type: 'file' }]),
    searchLibrary: vi.fn().mockResolvedValue([{ id: 'lib-1', name: 'doc.pdf', type: 'file' }]),
    ...overrides,
  };
}

describe('CompositeKnowledgeMemoryBridge', () => {
  let bridge: CompositeKnowledgeMemoryBridge;
  let primary: ReturnType<typeof createMockAdapter>;
  let secondary: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    primary = createMockAdapter();
    secondary = createMockAdapter({
      add: vi.fn().mockResolvedValue({ id: 'secondary-1', source: 'nowledge-mem:secondary-1' }),
      addToLibrary: vi.fn().mockResolvedValue([{ id: 'lib-2', name: 'doc2.pdf', type: 'file' }]),
      searchLibrary: vi.fn().mockResolvedValue([{ id: 'lib-2', name: 'doc2.pdf', type: 'file' }]),
    });
    bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);
  });

  describe('initialize', () => {
    it('initializes both adapters', async () => {
      await bridge.initialize();
      expect(primary.initialize).toHaveBeenCalled();
      expect(secondary.initialize).toHaveBeenCalled();
    });

    it('continues when secondary fails', async () => {
      secondary.initialize.mockRejectedValue(new Error('unreachable'));
      await bridge.initialize();
      expect(primary.initialize).toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('writes to primary and secondary, merges results', async () => {
      const result = await bridge.add({ content: 'hello' });
      expect(result).toEqual({ id: 'secondary-1', source: 'nowledge-mem:secondary-1' });
      expect(primary.add).toHaveBeenCalled();
      expect(secondary.add).toHaveBeenCalled();
    });

    it('returns primary result when secondary fails', async () => {
      secondary.add.mockRejectedValue(new Error('down'));
      const result = await bridge.add({ content: 'hello' });
      expect(result).toEqual({ id: 'primary-1' });
    });

    it('tracks metrics on add', async () => {
      await bridge.add({ content: 'hello' });
      const m = bridge.getMetrics();
      expect(m.writes.primary).toBe(1);
      expect(m.writes.secondary).toBe(1);
      expect(m.writes.failures).toBe(0);
    });

    it('tracks failure metric when secondary fails', async () => {
      secondary.add.mockRejectedValue(new Error('down'));
      await bridge.add({ content: 'hello' });
      const m = bridge.getMetrics();
      expect(m.writes.primary).toBe(1);
      expect(m.writes.secondary).toBe(1);
      expect(m.writes.failures).toBe(1);
    });
  });

  describe('store', () => {
    it('stores to both adapters', async () => {
      await bridge.store('key', 'value');
      expect(primary.store).toHaveBeenCalledWith('key', 'value');
      expect(secondary.store).toHaveBeenCalledWith('key', 'value');
    });

    it('tracks metrics on store', async () => {
      await bridge.store('key', 'value');
      const m = bridge.getMetrics();
      expect(m.writes.primary).toBe(1);
      expect(m.writes.secondary).toBe(1);
    });
  });

  describe('addToLibrary', () => {
    it('merges results from both adapters', async () => {
      const result = await bridge.addToLibrary(['/path/doc.pdf']);
      expect(result).toHaveLength(2);
      expect(primary.addToLibrary).toHaveBeenCalled();
      expect(secondary.addToLibrary).toHaveBeenCalled();
    });

    it('deduplicates by id', async () => {
      secondary.addToLibrary.mockResolvedValue([{ id: 'lib-1', name: 'duplicate.pdf', type: 'file' }]);
      const result = await bridge.addToLibrary(['/path']);
      expect(result).toHaveLength(1);
    });

    it('tracks metrics on addToLibrary', async () => {
      await bridge.addToLibrary(['/path']);
      const m = bridge.getMetrics();
      expect(m.writes.primary).toBe(1);
      expect(m.writes.secondary).toBe(1);
    });
  });

  describe('searchLibrary', () => {
    it('merges results from both adapters', async () => {
      const result = await bridge.searchLibrary('pdf');
      expect(result).toHaveLength(2);
    });

    it('tracks read metrics', async () => {
      await bridge.searchLibrary('pdf');
      const m = bridge.getMetrics();
      expect(m.reads.primary).toBe(1);
      expect(m.reads.secondary).toBe(1);
    });

    it('tracks fallback metric when secondary fails', async () => {
      secondary.searchLibrary.mockRejectedValue(new Error('down'));
      await bridge.searchLibrary('pdf');
      const m = bridge.getMetrics();
      expect(m.reads.primary).toBe(1);
      expect(m.reads.fallbacks).toBe(1);
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when both adapters are available', async () => {
      const health = await bridge.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.primary.available).toBe(true);
      expect(health.secondary.available).toBe(true);
    });

    it('returns degraded when secondary fails', async () => {
      secondary.initialize.mockRejectedValue(new Error('unreachable'));
      const health = await bridge.healthCheck();
      expect(health.status).toBe('degraded');
      expect(health.primary.available).toBe(true);
      expect(health.secondary.available).toBe(false);
      expect(health.secondary.error).toBe('unreachable');
    });

    it('returns healthy when no secondary configured', async () => {
      const noSecondaryBridge = new CompositeKnowledgeMemoryBridge(primary);
      const health = await noSecondaryBridge.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.primary.available).toBe(true);
      expect(health.secondary.available).toBe(false);
    });

    it('returns down when primary fails', async () => {
      primary.initialize.mockRejectedValue(new Error('broken'));
      const health = await bridge.healthCheck();
      expect(health.status).toBe('down');
      expect(health.primary.available).toBe(false);
    });

    it('includes latency and lastCheck', async () => {
      const health = await bridge.healthCheck();
      expect(health.lastCheck).toBeTruthy();
      expect(typeof health.primary.latencyMs).toBe('number');
    });
  });

  describe('getMetrics / resetMetrics', () => {
    it('returns fresh metrics snapshot', async () => {
      await bridge.add({ content: 'test' });
      await bridge.store('k', 'v');
      const m = bridge.getMetrics();
      expect(m.writes.primary).toBe(2);
      expect(m.writes.secondary).toBe(2);
    });

    it('reset clears all counters', async () => {
      await bridge.add({ content: 'test' });
      bridge.resetMetrics();
      const m = bridge.getMetrics();
      expect(m.writes.primary).toBe(0);
      expect(m.writes.failures).toBe(0);
    });

    it('getMetrics returns copy not reference', () => {
      const m1 = bridge.getMetrics();
      const m2 = bridge.getMetrics();
      m1.writes.primary = 999;
      expect(m2.writes.primary).toBe(0);
    });
  });
});