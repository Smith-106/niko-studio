import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictNowledgeBridge } from './conflict-nowledge-bridge.js';

function createMockService() {
  return {
    status: vi.fn().mockResolvedValue({ connected: true, version: '1.0.0' }),
    deleteMemory: vi.fn().mockResolvedValue(true),
    addMemory: vi.fn().mockResolvedValue({ id: 'mem-new', content: 'merged' }),
    searchMemories: vi.fn().mockResolvedValue({ memories: [], total: 0 }),
  };
}

describe('ConflictNowledgeBridge additional coverage', () => {
  let bridge: ConflictNowledgeBridge;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    bridge = new ConflictNowledgeBridge(
      service as unknown as import('../protocols/nowledge-mem').INowledgeMemService,
    );
  });

  it('marks the bridge unavailable when status checks throw', async () => {
    service.status.mockRejectedValue(new Error('status down'));

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

  it('swallows merged-content persistence failures', async () => {
    service.addMemory.mockRejectedValue(new Error('write failed'));
    await bridge.initialize();

    await expect(bridge.syncResolution({
      action: 'merge',
      obsoleteIds: ['old-1'],
      mergedContent: 'merged result',
      keptIds: [],
      reason: 'test',
      requiresManual: false,
      metadata: {},
    })).resolves.toBeUndefined();

    expect(service.deleteMemory).toHaveBeenCalledWith('old-1');
    expect(service.addMemory).toHaveBeenCalledWith('merged result', {
      labels: ['conflict-merge'],
      importance: 0.7,
    });
  });

  it('swallows outer sync failures caused by invalid obsolete id iterables', async () => {
    await bridge.initialize();

    const badResult = {
      action: 'delete',
      obsoleteIds: {
        [Symbol.iterator]() {
          throw new Error('iterator exploded');
        },
      },
      mergedContent: null,
      keptIds: [],
      reason: 'test',
      requiresManual: false,
      metadata: {},
    } as unknown as import('../memory/conflict-resolver.js').ResolutionResult;

    await expect(bridge.syncResolution(badResult)).resolves.toBeUndefined();
    expect(service.deleteMemory).not.toHaveBeenCalled();
  });
});
