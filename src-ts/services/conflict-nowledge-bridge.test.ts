import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictNowledgeBridge } from './conflict-nowledge-bridge.js';

function createMockService() {
  return {
    status: vi.fn().mockResolvedValue({ connected: true, version: '1.0.0' }),
    deleteMemory: vi.fn().mockResolvedValue(true),
    addMemory: vi.fn().mockResolvedValue({ id: 'mem-new', content: 'merged' }),
    searchMemories: vi.fn().mockResolvedValue({
      memories: [
        { id: 'mem-conflict', content: 'conflicting data', similarityScore: 0.8 },
      ],
      total: 1,
    }),
  };
}

describe('ConflictNowledgeBridge', () => {
  let bridge: ConflictNowledgeBridge;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    bridge = new ConflictNowledgeBridge(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService);
  });

  describe('initialize', () => {
    it('sets available when connected', async () => {
      await bridge.initialize();
      // Should work (no throw)
      await bridge.syncResolution({
        action: 'delete',
        obsoleteIds: ['old-1'],
        mergedContent: null,
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.deleteMemory).toHaveBeenCalledWith('old-1');
    });

    it('sets unavailable when not connected', async () => {
      service.status.mockResolvedValue({ connected: false });
      await bridge.initialize();
      await bridge.syncResolution({
        action: 'delete',
        obsoleteIds: ['old-1'],
        mergedContent: null,
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.deleteMemory).not.toHaveBeenCalled();
    });
  });

  describe('syncResolution', () => {
    it('deletes obsolete memories from Nowledge Mem', async () => {
      await bridge.initialize();
      await bridge.syncResolution({
        action: 'delete',
        obsoleteIds: ['old-1', 'old-2'],
        mergedContent: null,
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.deleteMemory).toHaveBeenCalledTimes(2);
      expect(service.deleteMemory).toHaveBeenCalledWith('old-1');
      expect(service.deleteMemory).toHaveBeenCalledWith('old-2');
    });

    it('adds merged content when action is merge', async () => {
      await bridge.initialize();
      await bridge.syncResolution({
        action: 'merge',
        obsoleteIds: ['old-1'],
        mergedContent: 'merged result',
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.deleteMemory).toHaveBeenCalledWith('old-1');
      expect(service.addMemory).toHaveBeenCalledWith('merged result', {
        labels: ['conflict-merge'],
        importance: 0.7,
      });
    });

    it('does not add content when action is delete', async () => {
      await bridge.initialize();
      await bridge.syncResolution({
        action: 'delete',
        obsoleteIds: ['old-1'],
        mergedContent: null,
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.addMemory).not.toHaveBeenCalled();
    });

    it('handles individual delete failures gracefully', async () => {
      await bridge.initialize();
      service.deleteMemory.mockRejectedValueOnce(new Error('not found'));
      await bridge.syncResolution({
        action: 'delete',
        obsoleteIds: ['old-1', 'old-2'],
        mergedContent: null,
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.deleteMemory).toHaveBeenCalledTimes(2);
    });

    it('does nothing when unavailable', async () => {
      service.status.mockResolvedValue({ connected: false });
      await bridge.initialize();
      await bridge.syncResolution({
        action: 'delete',
        obsoleteIds: ['old-1'],
        mergedContent: null,
        keptIds: [],
        reason: 'test',
        requiresManual: false,
        metadata: {},
      });
      expect(service.deleteMemory).not.toHaveBeenCalled();
    });
  });

  describe('detectReverseConflicts', () => {
    it('returns matching memories from Nowledge Mem', async () => {
      await bridge.initialize();
      const results = await bridge.detectReverseConflicts('some content', 'entity-1');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('mem-conflict');
    });

    it('searches with correct labels', async () => {
      await bridge.initialize();
      await bridge.detectReverseConflicts('some content', 'entity-1');
      expect(service.searchMemories).toHaveBeenCalledWith('some content', {
        labels: ['conflict-merge', 'entity-1'],
        limit: 10,
      });
    });

    it('returns empty when unavailable', async () => {
      service.status.mockResolvedValue({ connected: false });
      await bridge.initialize();
      const results = await bridge.detectReverseConflicts('content', 'entity-1');
      expect(results).toHaveLength(0);
    });

    it('returns empty on search failure', async () => {
      await bridge.initialize();
      service.searchMemories.mockRejectedValue(new Error('down'));
      const results = await bridge.detectReverseConflicts('content', 'entity-1');
      expect(results).toHaveLength(0);
    });
  });
});