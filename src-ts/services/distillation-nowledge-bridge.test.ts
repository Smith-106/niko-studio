import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DistillationNowledgeBridge } from './distillation-nowledge-bridge.js';
import { DistillationTemplate } from './distill-service.js';

function createMockService() {
  return {
    status: vi.fn().mockResolvedValue({ connected: true, version: '1.0.0' }),
    addMemory: vi.fn().mockResolvedValue({ id: 'mem-1', content: 'test' }),
    createRelation: vi.fn().mockResolvedValue(undefined),
    summarizeMemories: vi.fn().mockResolvedValue('summary-abc'),
  };
}

describe('DistillationNowledgeBridge', () => {
  let bridge: DistillationNowledgeBridge;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    bridge = new DistillationNowledgeBridge(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService);
  });

  describe('initialize', () => {
    it('sets available when service is connected', async () => {
      await bridge.initialize();
      const result = await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: ['s1'],
        template: DistillationTemplate.SUMMARY,
        content: 'hello',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(result).toBe('mem-1');
    });

    it('sets unavailable when service fails', async () => {
      service.status.mockResolvedValue({ connected: false });
      await bridge.initialize();
      const result = await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: [],
        template: DistillationTemplate.SUMMARY,
        content: 'hello',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(result).toBeNull();
    });
  });

  describe('persistDistillation', () => {
    it('persists content with correct labels', async () => {
      await bridge.initialize();
      await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: ['source-a'],
        template: DistillationTemplate.KEY_POINTS,
        content: 'key insight',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(service.addMemory).toHaveBeenCalledWith('key insight', {
        labels: ['distillation', 'key_points', 'source:source-a'],
        importance: 0.8,
      });
    });

    it('creates graph relations to sources', async () => {
      await bridge.initialize();
      await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: ['s1', 's2'],
        template: DistillationTemplate.SUMMARY,
        content: 'summary',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(service.createRelation).toHaveBeenCalledTimes(2);
      expect(service.createRelation).toHaveBeenCalledWith('mem-1', 's1', { type: 'DISTILLED_FROM' as any });
      expect(service.createRelation).toHaveBeenCalledWith('mem-1', 's2', { type: 'DISTILLED_FROM' as any });
    });

    it('returns null when addMemory fails', async () => {
      await bridge.initialize();
      service.addMemory.mockRejectedValue(new Error('down'));
      const result = await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: [],
        template: DistillationTemplate.SUMMARY,
        content: 'fail',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(result).toBeNull();
    });
  });

  describe('autoSummarize', () => {
    it('summarizes when threshold reached', async () => {
      bridge = new DistillationNowledgeBridge(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService, {
        autoSummarizeThreshold: 3,
      });
      await bridge.initialize();

      for (let i = 0; i < 3; i++) {
        service.addMemory.mockResolvedValue({ id: `mem-${i}`, content: `content-${i}` });
        await bridge.persistDistillation({
          resultId: `dist-${i}`,
          sourceIds: [],
          template: DistillationTemplate.SUMMARY,
          content: `content-${i}`,
          derivedFrom: [],
          createdAt: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(service.summarizeMemories).toHaveBeenCalled();
      const ids = service.summarizeMemories.mock.calls[0][0] as string[];
      expect(ids).toHaveLength(3);
    });

    it('creates SUMMARIZES relations after summary', async () => {
      bridge = new DistillationNowledgeBridge(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService, {
        autoSummarizeThreshold: 2,
        linkToSources: true,
      });
      await bridge.initialize();

      for (let i = 0; i < 2; i++) {
        service.addMemory.mockResolvedValue({ id: `mem-${i}`, content: `content-${i}` });
        await bridge.persistDistillation({
          resultId: `dist-${i}`,
          sourceIds: [],
          template: DistillationTemplate.SUMMARY,
          content: `content-${i}`,
          derivedFrom: [],
          createdAt: new Date().toISOString(),
          metadata: {},
        });
      }

      // 2 SUMMARIZES relations (summary → each distilled memory)
      const summarizeCalls = service.createRelation.mock.calls.filter(
        (c: any[]) => c[2]?.type === 'SUMMARIZES',
      );
      expect(summarizeCalls.length).toBe(2);
    });

    it('skips linking when linkToSources is false', async () => {
      bridge = new DistillationNowledgeBridge(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService, {
        autoSummarizeThreshold: 2,
        linkToSources: false,
      });
      await bridge.initialize();

      for (let i = 0; i < 2; i++) {
        service.addMemory.mockResolvedValue({ id: `mem-${i}`, content: `content-${i}` });
        await bridge.persistDistillation({
          resultId: `dist-${i}`,
          sourceIds: ['s1'],
          template: DistillationTemplate.SUMMARY,
          content: `content-${i}`,
          derivedFrom: [],
          createdAt: new Date().toISOString(),
          metadata: {},
        });
      }

      expect(service.createRelation).not.toHaveBeenCalled();
    });
  });

  describe('getDistilledMemoryIds / getPendingCount', () => {
    it('tracks persisted IDs', async () => {
      await bridge.initialize();
      service.addMemory.mockResolvedValue({ id: 'mem-a', content: 'test' });
      await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: [],
        template: DistillationTemplate.SUMMARY,
        content: 'test',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(bridge.getDistilledMemoryIds()).toContain('mem-a');
      expect(bridge.getPendingCount()).toBe(1);
    });

    it('clears pending after summarize', async () => {
      bridge = new DistillationNowledgeBridge(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService, {
        autoSummarizeThreshold: 1,
      });
      await bridge.initialize();
      service.addMemory.mockResolvedValue({ id: 'mem-x', content: 'test' });
      await bridge.persistDistillation({
        resultId: 'dist-1',
        sourceIds: [],
        template: DistillationTemplate.SUMMARY,
        content: 'test',
        derivedFrom: [],
        createdAt: new Date().toISOString(),
        metadata: {},
      });
      expect(bridge.getPendingCount()).toBe(0);
    });
  });
});