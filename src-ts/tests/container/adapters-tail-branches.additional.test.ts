import { afterEach, describe, expect, it, vi } from 'vitest';

const memorySearchMock = vi.hoisted(() => vi.fn());
const graphSearchEntitiesByNameMock = vi.hoisted(() => vi.fn());
const graphExecuteCypherMock = vi.hoisted(() => vi.fn());

vi.mock('../../memory/unified-memory', () => ({
  UnifiedMemoryEngine: class {
    initialize = vi.fn().mockResolvedValue(undefined);
    add = vi.fn().mockResolvedValue(undefined);
    search = memorySearchMock;
    getTemporalFacts = vi.fn();
    detectConflicts = vi.fn();
    resolveConflict = vi.fn();
  },
}));

vi.mock('../../graph/graph-engine', () => ({
  GraphEngine: class {
    initialize = vi.fn().mockResolvedValue(undefined);
    createEntity = vi.fn().mockResolvedValue(undefined);
    createRelation = vi.fn().mockResolvedValue(undefined);
    searchEntitiesByName = graphSearchEntitiesByNameMock;
    executeCypher = graphExecuteCypherMock;
    getCharacter = vi.fn();
    getRelationships = vi.fn();
    getForeshadows = vi.fn();
  },
}));

describe('container/adapters tail branch coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('covers memory-search default limit forwarding', async () => {
    memorySearchMock.mockResolvedValueOnce([{ id: 'mem-default-limit' }]);

    const { MemoryEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new MemoryEngineAdapter({
      flags: { elasticsearchEnabled: false },
      storageShadow: { shadowWriteMemory: vi.fn() },
    } as never);

    await expect(adapter.search('needle')).resolves.toEqual([{ id: 'mem-default-limit' }]);
    expect(memorySearchMock).toHaveBeenCalledWith({ query: 'needle', limit: 10 });
  });

  it('covers graph traverse fallback depth and missing-name branch', async () => {
    graphSearchEntitiesByNameMock.mockResolvedValueOnce([{ id: 'node-no-name' }]);
    graphExecuteCypherMock.mockResolvedValueOnce([{ id: 'child-node' }]);

    const { GraphEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new GraphEngineAdapter();

    await expect(adapter.traverse('node-no-name')).resolves.toEqual([{ id: 'child-node' }]);
    expect(graphSearchEntitiesByNameMock).toHaveBeenCalledWith('', 'node-no-name', 1);
    expect(graphExecuteCypherMock).toHaveBeenCalledWith(
      "MATCH (n)-[r*1..3]-(m) WHERE n.id = 'node-no-name' RETURN m, r",
    );
  });

  it('covers typed search filtering when indexed documents have no metadata', async () => {
    const retriever = {
      hybridSearch: vi.fn().mockResolvedValue([]),
    };

    const { SearchEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new SearchEngineAdapter(retriever as never);

    await adapter.index({
      id: 'doc-no-meta',
      content: 'alpha beta',
    });

    await expect(
      adapter.search('alpha', {
        filters: { type: 'plan' },
      }),
    ).resolves.toEqual([]);
    expect(retriever.hybridSearch).toHaveBeenCalledWith(
      'alpha',
      'all',
      10,
      undefined,
      0,
      undefined,
      false,
      'hybrid',
      300,
    );
  });
});
