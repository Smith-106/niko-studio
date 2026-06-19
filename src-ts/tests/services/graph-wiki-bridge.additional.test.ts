import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphWikiLinkBridgeImpl } from '../../services/graph-wiki-bridge.js';

interface SearchResult {
  name: string;
  path: string;
  relativePath: string;
}

function createSearchResult(path: string): SearchResult {
  return {
    name: path.replace(/\.md$/, '').split('/').pop() ?? path,
    path,
    relativePath: path,
  };
}

class MockEventBus {
  publish = vi.fn();
  subscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    list.push(handler);
    this.handlers.set(channel, list);
  });
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();

  emit(channel: string, payload: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) {
      handler(payload);
    }
  }
}

class MockObsidianService {
  readonly searchResults = new Map<string, SearchResult[]>();
  readonly searchFailures = new Set<string>();
  readonly getFilesFailures = new Set<string>();
  files: string[] = [];

  readNote = vi.fn(async () => '');

  search = vi.fn((_: string, query: string, _searchContent?: boolean, limit?: number) => {
    if (this.searchFailures.has(query)) {
      throw new Error(`search failed: ${query}`);
    }
    return (this.searchResults.get(query) ?? []).slice(0, limit ?? 50);
  });

  getFiles = vi.fn((vaultPath: string) => {
    if (this.getFilesFailures.has(vaultPath)) {
      throw new Error(`getFiles failed: ${vaultPath}`);
    }
    return [...this.files];
  });
}

class MockGraphEngine {
  readonly nodes = new Map<string, unknown>();
  readonly nodeFailures = new Set<string>();
  traverseFailureByDepth = new Map<number, Error>();

  getNode = vi.fn(async (entityId: string) => {
    if (this.nodeFailures.has(entityId)) {
      throw new Error(`getNode failed: ${entityId}`);
    }
    return this.nodes.get(entityId) ?? null;
  });

  traverse = vi.fn(async (_startId: string, depth = 0) => {
    const failure = this.traverseFailureByDepth.get(depth);
    if (failure) {
      throw failure;
    }
    return [];
  });
}

function createHarness() {
  const eventBus = new MockEventBus();
  const obsidian = new MockObsidianService();
  const graphEngine = new MockGraphEngine();
  const bridge = new GraphWikiLinkBridgeImpl({
    graphEngine: graphEngine as never,
    obsidianService: obsidian as never,
    eventBus: eventBus as never,
    vaultPath: '/vault',
  });

  return {
    bridge,
    eventBus,
    obsidian,
    graphEngine,
    internals: bridge as unknown as {
      byEntity: Map<string, { entityId: string; wikiPath: string; lastResolved: number; isOrphaned: boolean }>;
    },
  };
}

describe('services/graph-wiki-bridge additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers resolveWikiToGraph failure and rebuild fallback error branches', async () => {
    const { bridge, obsidian, graphEngine } = createHarness();

    graphEngine.nodeFailures.add('BrokenPage');
    await expect(bridge.resolveWikiToGraph('notes/BrokenPage.md')).resolves.toBeNull();

    graphEngine.traverseFailureByDepth.set(0, new Error('depth-zero failed'));
    obsidian.getFilesFailures.add('/vault');
    await expect(bridge.rebuildIndex()).resolves.toBe(0);
  });

  it('covers orphan detection scan failures without aborting the report', async () => {
    const { bridge, obsidian, graphEngine } = createHarness();

    obsidian.getFilesFailures.add('/vault');
    graphEngine.traverseFailureByDepth.set(1, new Error('depth-one failed'));

    await expect(bridge.detectOrphanedLinks()).resolves.toEqual([]);
  });

  it('covers event-driven orphan insertion and search error branches', async () => {
    const { bridge, eventBus, obsidian, internals } = createHarness();

    eventBus.emit('knowledge:entity-created', { id: 'orphan-entity' });
    expect(internals.byEntity.get('orphan-entity')).toMatchObject({
      wikiPath: '',
      isOrphaned: true,
    });

    obsidian.searchFailures.add('broken-entity');
    eventBus.emit('knowledge:entity-created', { id: 'broken-entity' });
    expect(internals.byEntity.has('broken-entity')).toBe(false);

    obsidian.searchFailures.add('update-target');
    eventBus.emit('knowledge:entity-updated', { id: 'update-target' });
    expect(internals.byEntity.has('update-target')).toBe(false);
  });

  it('covers successful update indexing without replacement publishing side effects', async () => {
    const { eventBus, obsidian, internals } = createHarness();

    obsidian.searchResults.set('Hero', [createSearchResult('notes/Hero.md')]);
    eventBus.emit('knowledge:entity-created', { id: 'hero', label: 'Hero' });
    expect(internals.byEntity.get('hero')).toMatchObject({
      wikiPath: 'notes/Hero.md',
      isOrphaned: false,
    });

    obsidian.searchResults.set('Hero', [createSearchResult('notes/Hero-Updated.md')]);
    eventBus.emit('knowledge:entity-updated', { id: 'hero', label: 'Hero' });
    expect(internals.byEntity.get('hero')?.wikiPath).toBe('notes/Hero-Updated.md');
  });
});
