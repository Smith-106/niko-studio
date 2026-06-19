import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphWikiLinkBridgeImpl } from '../../services/graph-wiki-bridge.js';

interface SearchResult {
  name: string;
  path: string;
  relativePath: string;
}

class EventBusStub {
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();
  publish = vi.fn();
  subscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    list.push(handler);
    this.handlers.set(channel, list);
  });

  emit(channel: string, payload: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) {
      handler(payload);
    }
  }
}

class ObsidianStub {
  readonly notes = new Map<string, string | null>();
  readonly searchResults = new Map<string, SearchResult[]>();
  files: string[] = [];

  readNote = vi.fn(async (_vaultPath: string, notePath: string) => {
    return this.notes.get(notePath) ?? null;
  });

  search = vi.fn((_: string, query: string, _searchContent?: boolean, limit?: number) => {
    return (this.searchResults.get(query) ?? []).slice(0, limit ?? 50);
  });

  getFiles = vi.fn((_vaultPath: string, _pattern?: string) => {
    return [...this.files];
  });
}

class GraphEngineStub {
  readonly nodes = new Map<string, unknown>();
  traverseZero: unknown[] = [];
  traverseOne: unknown[] = [];

  getNode = vi.fn(async (entityId: string) => {
    return this.nodes.get(entityId) ?? null;
  });

  traverse = vi.fn(async (startId: string, depth = 0) => {
    if (startId === '__all__' && depth === 0) {
      return this.traverseZero;
    }
    if (startId === '__all__' && depth === 1) {
      return this.traverseOne;
    }
    return [];
  });
}

function createSearchResult(path: string): SearchResult {
  return {
    name: path.replace(/\.md$/, '').split('/').pop() ?? path,
    path,
    relativePath: path,
  };
}

function createHarness(options?: { vaultPath?: string }) {
  const eventBus = new EventBusStub();
  const obsidian = new ObsidianStub();
  const graphEngine = new GraphEngineStub();
  const bridge = new GraphWikiLinkBridgeImpl({
    graphEngine: graphEngine as never,
    obsidianService: obsidian as never,
    eventBus: eventBus as never,
    ...(options?.vaultPath === undefined ? {} : { vaultPath: options.vaultPath }),
  });

  return {
    bridge,
    eventBus,
    obsidian,
    graphEngine,
    internals: bridge as unknown as {
      byEntity: Map<string, { entityId: string; wikiPath: string; lastResolved: number; isOrphaned: boolean }>;
      byWikiPath: Map<string, string>;
      removeFromIndex: (entityId: string, markOrphanedIfReferenced?: string) => void;
    },
  };
}

describe('services/graph-wiki-bridge branch gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the default vault path when none is provided', async () => {
    const { bridge, obsidian } = createHarness();
    obsidian.searchResults.set('hero', [createSearchResult('characters/Hero.md')]);

    await expect(bridge.resolveGraphToWiki('hero')).resolves.toBe('characters/Hero.md');
    expect(obsidian.search).toHaveBeenCalledWith('.writing/vault', 'hero', false, 1);
  });

  it('falls back to the original wiki path and page name when pop or node id are missing', async () => {
    const { bridge, graphEngine } = createHarness({ vaultPath: '/vault' });
    graphEngine.nodes.set('notes/Fallback.md', {});

    vi.spyOn(Array.prototype, 'pop').mockImplementationOnce(() => undefined as never);

    await expect(bridge.resolveWikiToGraph('notes/Fallback.md')).resolves.toBe('notes/Fallback.md');
    expect(graphEngine.getNode).toHaveBeenCalledWith('notes/Fallback.md');
  });

  it('returns an empty result when a note resolves to empty content', async () => {
    const { bridge } = createHarness({ vaultPath: '/vault' });

    await expect(bridge.resolveWikiLinks('notes/Empty.md')).resolves.toEqual([]);
  });

  it('rebuilds the index by falling back to entity id when graph nodes have no name', async () => {
    const { bridge, obsidian, graphEngine, internals } = createHarness({ vaultPath: '/vault' });
    graphEngine.traverseZero = [{ id: 'id-only' }];
    obsidian.searchResults.set('id-only', [createSearchResult('notes/IdOnly.md')]);

    await expect(bridge.rebuildIndex()).resolves.toBe(1);
    expect(internals.byEntity.get('id-only')).toMatchObject({
      wikiPath: 'notes/IdOnly.md',
      isOrphaned: false,
    });
  });

  it('reads edge sourceId and targetId fallback fields during orphan detection', async () => {
    const { bridge, graphEngine } = createHarness({ vaultPath: '/vault' });
    graphEngine.traverseOne = [{ type: 'edge', sourceId: 'source-only', targetId: 'target-only' }];

    await bridge.detectOrphanedLinks();

    expect(graphEngine.traverse).toHaveBeenCalledWith('__all__', 1);
  });

  it('returns early when removing an entity that is not indexed', () => {
    const { eventBus, internals } = createHarness({ vaultPath: '/vault' });

    internals.removeFromIndex('missing-entity', 'story-root');

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('falls back to file path and page name when a changed file cannot derive a node id', async () => {
    const { eventBus, graphEngine, internals } = createHarness({ vaultPath: '/vault' });
    graphEngine.nodes.set('notes/FreshFallback.md', {});

    vi.spyOn(Array.prototype, 'pop').mockImplementationOnce(() => undefined as never);

    eventBus.emit('obsidian:file-changed', { path: 'notes/FreshFallback.md' });
    await Promise.resolve();
    await Promise.resolve();

    expect(graphEngine.getNode).toHaveBeenCalledWith('notes/FreshFallback.md');
    expect(internals.byEntity.get('notes/FreshFallback.md')).toMatchObject({
      entityId: 'notes/FreshFallback.md',
      wikiPath: 'notes/FreshFallback.md',
      isOrphaned: false,
    });
  });
});
