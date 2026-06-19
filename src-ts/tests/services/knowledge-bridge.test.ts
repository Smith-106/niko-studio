import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NowledgeMemKnowledgeBridge } from '../../services/nowledge-mem-knowledge-bridge';
import { CompositeKnowledgeMemoryBridge } from '../../services/composite-knowledge-memory-bridge';
import type { INowledgeMemService } from '../../protocols/nowledge-mem';
import type { KnowledgeMemoryEngineAdapter } from '../../protocols/knowledge';

function createMockNowledgeMemService(connected: boolean): INowledgeMemService {
  return {
    status: vi.fn().mockResolvedValue({ connected, version: '1.0.0' }),
    addMemory: vi.fn().mockResolvedValue({ id: 'mem-1', content: 'test' }),
    searchMemories: vi.fn().mockResolvedValue({ memories: [], total: 0 }),
    getMemory: vi.fn().mockResolvedValue(null),
    updateMemory: vi.fn().mockResolvedValue({ id: 'mem-1', content: 'updated' }),
    deleteMemory: vi.fn().mockResolvedValue(true),
    expandGraph: vi.fn().mockResolvedValue({ memoryId: 'mem-1', relations: [] }),
    addToLibrary: vi.fn().mockResolvedValue([]),
    searchLibrary: vi.fn().mockResolvedValue([]),
    readArtifact: vi.fn().mockResolvedValue(''),
    getWorkingMemory: vi.fn().mockResolvedValue({ date: '', content: '' }),
    setWorkingMemory: vi.fn().mockResolvedValue(undefined),
    listCommunities: vi.fn().mockResolvedValue([]),
    getFeed: vi.fn().mockResolvedValue([]),
    initialize: vi.fn().mockResolvedValue(undefined),
    healthCheck: vi.fn().mockResolvedValue(connected),
    shutdown: vi.fn().mockResolvedValue(undefined),
  } as unknown as INowledgeMemService;
}

function createMockPrimaryEngine(): KnowledgeMemoryEngineAdapter {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue({ id: 'primary-1' }),
    store: vi.fn().mockResolvedValue(undefined),
  };
}

describe('NowledgeMemKnowledgeBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects availability on initialize', async () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    expect(service.status).toHaveBeenCalled();
  });

  it('marks unavailable when Nowledge Mem is disconnected', async () => {
    const service = createMockNowledgeMemService(false);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.add({ content: 'test' });
    expect(result).toEqual({});
    expect(service.addMemory).not.toHaveBeenCalled();
  });

  it('forwards add to Nowledge Mem when available', async () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.add({
      content: 'test content',
      tags: ['tag1'],
      importance: 5,
    });

    expect(service.addMemory).toHaveBeenCalledWith('test content', {
      labels: ['tag1'],
      importance: 5,
    });
    expect(result.id).toBe('mem-1');
    expect(result.source).toBe('nowledge-mem:mem-1');
  });

  it('extracts layer and dimension as labels', async () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await bridge.add({
      content: 'test',
      layer: 'L1',
      dimension: 'D1',
      tags: ['existing'],
    });

    expect(service.addMemory).toHaveBeenCalledWith('test', {
      labels: ['existing', 'L1', 'D1'],
      importance: undefined,
    });
  });

  it('returns empty on add error', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.addMemory).mockRejectedValue(new Error('fail'));
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.add({ content: 'test' });
    expect(result).toEqual({});
  });

  it('store serializes and forwards to addMemory', async () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await bridge.store('key', { foo: 'bar' });

    expect(service.addMemory).toHaveBeenCalledWith('{"foo":"bar"}', {
      labels: ['knowledge-store'],
    });
  });

  it('store passes strings directly', async () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await bridge.store('key', 'plain text');

    expect(service.addMemory).toHaveBeenCalledWith('plain text', {
      labels: ['knowledge-store'],
    });
  });

  it('store degrades silently on error', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.addMemory).mockRejectedValue(new Error('fail'));
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(bridge.store('key', 'value')).resolves.toBeUndefined();
  });

  it('store returns early when bridge is unavailable', async () => {
    const service = createMockNowledgeMemService(false);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(bridge.store('key', 'value')).resolves.toBeUndefined();
    expect(service.addMemory).not.toHaveBeenCalled();
  });

  it('forwards addToLibrary to Nowledge Mem when available', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.addToLibrary).mockResolvedValue([
      { id: 'lib-1', name: 'test.md', type: 'file', summary: 'A test file' },
    ]);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.addToLibrary(['/path/to/test.md']);

    expect(service.addToLibrary).toHaveBeenCalledWith(['/path/to/test.md']);
    expect(result).toEqual([{ id: 'lib-1', name: 'test.md', type: 'file', summary: 'A test file' }]);
  });

  it('returns empty when addToLibrary called while unavailable', async () => {
    const service = createMockNowledgeMemService(false);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.addToLibrary(['/path/to/test.md']);
    expect(result).toEqual([]);
    expect(service.addToLibrary).not.toHaveBeenCalled();
  });

  it('returns empty on addToLibrary error', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.addToLibrary).mockRejectedValue(new Error('fail'));
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.addToLibrary(['/path/to/test.md']);
    expect(result).toEqual([]);
  });

  it('forwards searchLibrary to Nowledge Mem when available', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.searchLibrary).mockResolvedValue([
      { id: 'lib-1', name: 'result.md', type: 'file', summary: 'Search result' },
    ]);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.searchLibrary('test query', { limit: 5 });

    expect(service.searchLibrary).toHaveBeenCalledWith('test query', { limit: 5 });
    expect(result).toEqual([{ id: 'lib-1', name: 'result.md', type: 'file', summary: 'Search result' }]);
  });

  it('returns empty when searchLibrary called while unavailable', async () => {
    const service = createMockNowledgeMemService(false);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    const result = await bridge.searchLibrary('test');
    expect(result).toEqual([]);
    expect(service.searchLibrary).not.toHaveBeenCalled();
  });

  it('marks bridge unavailable when initialize status check throws', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.status).mockRejectedValue(new Error('offline'));
    const bridge = new NowledgeMemKnowledgeBridge(service);

    await expect(bridge.initialize()).resolves.toBeUndefined();
    await expect(bridge.add({ content: 'test' })).resolves.toEqual({});
    expect(service.addMemory).not.toHaveBeenCalled();
  });

  it('returns empty on searchLibrary error', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.searchLibrary).mockRejectedValue(new Error('search-fail'));
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(bridge.searchLibrary('test query', { limit: 3 })).resolves.toEqual([]);
  });

  it('syncs current temporal state and deletes superseded memories', async () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(
      bridge.temporalSync('entity-1', 'current content', ['old-1', 'old-2']),
    ).resolves.toBeUndefined();

    expect(service.addMemory).toHaveBeenCalledWith('current content', {
      labels: ['temporal-current', 'entity-1'],
      importance: 0.7,
    });
    expect(service.deleteMemory).toHaveBeenCalledTimes(2);
    expect(service.deleteMemory).toHaveBeenNthCalledWith(1, 'old-1');
    expect(service.deleteMemory).toHaveBeenNthCalledWith(2, 'old-2');
  });

  it('continues temporal sync when one superseded delete fails', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.deleteMemory)
      .mockRejectedValueOnce(new Error('delete-fail'))
      .mockResolvedValueOnce(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(
      bridge.temporalSync('entity-2', 'replacement content', ['old-a', 'old-b']),
    ).resolves.toBeUndefined();

    expect(service.deleteMemory).toHaveBeenCalledTimes(2);
  });

  it('degrades silently when the temporal current-state write fails', async () => {
    const service = createMockNowledgeMemService(true);
    vi.mocked(service.addMemory).mockRejectedValue(new Error('write-fail'));
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(
      bridge.temporalSync('entity-3', 'replacement content', ['old-a']),
    ).resolves.toBeUndefined();

    expect(service.deleteMemory).not.toHaveBeenCalled();
  });

  it('returns early from temporal sync when bridge is unavailable', async () => {
    const service = createMockNowledgeMemService(false);
    const bridge = new NowledgeMemKnowledgeBridge(service);
    await bridge.initialize();

    await expect(
      bridge.temporalSync('entity-4', 'replacement content', ['old-a']),
    ).resolves.toBeUndefined();

    expect(service.addMemory).not.toHaveBeenCalled();
    expect(service.deleteMemory).not.toHaveBeenCalled();
  });

  it('filters superseded memories from Nowledge Mem results', () => {
    const service = createMockNowledgeMemService(true);
    const bridge = new NowledgeMemKnowledgeBridge(service);

    expect(
      bridge.filterSuperseded(
        [
          { id: 'keep-1', labels: ['current'] },
          { id: 'drop-1', labels: ['superseded'] },
          { id: 'keep-2' },
        ],
        new Set(['drop-1']),
      ),
    ).toEqual([
      { id: 'keep-1', labels: ['current'] },
      { id: 'keep-2' },
    ]);
  });
});

describe('CompositeKnowledgeMemoryBridge', () => {
  let primary: KnowledgeMemoryEngineAdapter;
  let secondary: KnowledgeMemoryEngineAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    primary = createMockPrimaryEngine();
    secondary = {
      initialize: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue({ id: 'sec-1', source: 'nowledge-mem:mem-1' }),
      store: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('initializes both engines', async () => {
    const bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);
    await bridge.initialize();

    expect(primary.initialize).toHaveBeenCalled();
    expect(secondary.initialize).toHaveBeenCalled();
  });

  it('continues if secondary initialize fails', async () => {
    vi.mocked(secondary.initialize!).mockRejectedValue(new Error('fail'));
    const bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);

    await expect(bridge.initialize()).resolves.toBeUndefined();
  });

  it('calls add on both engines and merges results', async () => {
    const bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);

    const result = await bridge.add({ content: 'test' });

    expect(primary.add).toHaveBeenCalledWith({ content: 'test' });
    expect(secondary.add).toHaveBeenCalledWith({ content: 'test' });
    // secondary result overwrites same keys from primary
    expect(result.id).toBe('sec-1');
    expect(result.source).toBe('nowledge-mem:mem-1');
  });

  it('returns primary result if secondary fails', async () => {
    vi.mocked(secondary.add!).mockRejectedValue(new Error('fail'));
    const bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);

    const result = await bridge.add({ content: 'test' });
    expect(result).toEqual({ id: 'primary-1' });
  });

  it('calls store on both engines', async () => {
    const bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);

    await bridge.store('key', 'value');

    expect(primary.store).toHaveBeenCalledWith('key', 'value');
    expect(secondary.store).toHaveBeenCalledWith('key', 'value');
  });

  it('continues if secondary store fails', async () => {
    vi.mocked(secondary.store!).mockRejectedValue(new Error('fail'));
    const bridge = new CompositeKnowledgeMemoryBridge(primary, secondary);

    await expect(bridge.store('key', 'value')).resolves.toBeUndefined();
    expect(primary.store).toHaveBeenCalledWith('key', 'value');
  });

  it('works with primary only (no secondary)', async () => {
    const bridge = new CompositeKnowledgeMemoryBridge(primary);

    const result = await bridge.add({ content: 'test' });
    expect(result).toEqual({ id: 'primary-1' });

    await bridge.store('key', 'value');
    expect(primary.store).toHaveBeenCalledWith('key', 'value');
  });

  it('merges addToLibrary results from both engines', async () => {
    const primaryWithLib = {
      ...primary,
      addToLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-1', name: 'a.md', type: 'file', summary: 'from primary' },
      ]),
    };
    const secondaryWithLib = {
      ...secondary,
      addToLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-2', name: 'b.md', type: 'file', summary: 'from secondary' },
      ]),
    };
    const bridge = new CompositeKnowledgeMemoryBridge(primaryWithLib, secondaryWithLib);

    const result = await bridge.addToLibrary(['/path/a.md', '/path/b.md']);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(['lib-1', 'lib-2']);
  });

  it('dedupes addToLibrary results by id', async () => {
    const primaryWithLib = {
      ...primary,
      addToLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-1', name: 'a.md', type: 'file', summary: 'primary' },
      ]),
    };
    const secondaryWithLib = {
      ...secondary,
      addToLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-1', name: 'a.md', type: 'file', summary: 'secondary' },
      ]),
    };
    const bridge = new CompositeKnowledgeMemoryBridge(primaryWithLib, secondaryWithLib);

    const result = await bridge.addToLibrary(['/path/a.md']);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('lib-1');
  });

  it('returns primary results on secondary addToLibrary failure', async () => {
    const primaryWithLib = {
      ...primary,
      addToLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-1', name: 'a.md', type: 'file', summary: 'primary' },
      ]),
    };
    const secondaryWithLib = {
      ...secondary,
      addToLibrary: vi.fn().mockRejectedValue(new Error('fail')),
    };
    const bridge = new CompositeKnowledgeMemoryBridge(primaryWithLib, secondaryWithLib);

    const result = await bridge.addToLibrary(['/path/a.md']);

    expect(result).toEqual([{ id: 'lib-1', name: 'a.md', type: 'file', summary: 'primary' }]);
  });

  it('merges searchLibrary results from both engines', async () => {
    const primaryWithLib = {
      ...primary,
      searchLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-1', name: 'a.md', type: 'file', summary: 'primary' },
      ]),
    };
    const secondaryWithLib = {
      ...secondary,
      searchLibrary: vi.fn().mockResolvedValue([
        { id: 'lib-2', name: 'b.md', type: 'file', summary: 'secondary' },
      ]),
    };
    const bridge = new CompositeKnowledgeMemoryBridge(primaryWithLib, secondaryWithLib);

    const result = await bridge.searchLibrary('test');

    expect(result).toHaveLength(2);
  });
});
